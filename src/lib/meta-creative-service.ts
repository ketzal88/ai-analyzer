import { db } from "@/lib/firebase-admin";
import { MetaCreativeDoc, CreativeSyncMetrics, CreativeFormat } from "@/types/meta-creative";
import { createHash } from "crypto";

const META_API_VERSION = process.env.META_API_VERSION || "v24.0";
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const MAX_ADS_PER_SYNC = 2000; // Hard limit to prevent runaway costs

/**
 * Recursively removes keys with undefined values from an object.
 * Necessary for Firestore even with ignoreUndefinedProperties enabled
 * to maintain a clean schema.
 */
function sanitizeForFirestore<T>(obj: any): T {
    if (Array.isArray(obj)) {
        return obj.map(v => sanitizeForFirestore(v)) as any;
    } else if (obj !== null && typeof obj === "object") {
        return Object.fromEntries(
            Object.entries(obj)
                .filter(([_, v]) => v !== undefined)
                .map(([k, v]) => [k, sanitizeForFirestore(v)])
        ) as any;
    }
    return obj;
}

/**
 * AG-41: Fetch active/paused ads from Meta with creative details
 * Returns normalized creative metadata without storing raw payloads
 */
export async function fetchMetaCreatives(
    adAccountId: string,
    accessToken: string
): Promise<any[]> {
    const cleanId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

    const fields = [
        "id",
        "name",
        "effective_status",
        "campaign{id,name,objective,buying_type,effective_status}",
        "adset{id,name,optimization_goal,billing_event,promoted_object,effective_status}",
        "creative{id,object_story_spec,asset_feed_spec,effective_object_story_id}"
    ].join(",");

    const baseUrl = `https://graph.facebook.com/${META_API_VERSION}/${cleanId}/ads`;
    const params = new URLSearchParams({
        fields,
        effective_status: JSON.stringify(["ACTIVE"]),
        limit: "100",
        access_token: accessToken
    });

    let allAds: any[] = [];
    let url = `${baseUrl}?${params.toString()}`;
    let pageCount = 0;

    while (url && allAds.length < MAX_ADS_PER_SYNC) {
        pageCount++;
        console.log(`Fetching Meta Ads page ${pageCount}...`);

        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(`Meta API Error: ${JSON.stringify(err)}`);
        }

        const data = await res.json();
        allAds = allAds.concat(data.data || []);

        // Check for next page
        url = data.paging?.next || "";

        if (allAds.length >= MAX_ADS_PER_SYNC) {
            console.warn(`Hit MAX_ADS_PER_SYNC limit (${MAX_ADS_PER_SYNC}). Stopping pagination.`);
            break;
        }
    }

    console.log(`Fetched ${allAds.length} ads from Meta in ${pageCount} pages.`);
    return allAds;
}

/**
 * Normalize a Meta Ad object to our MetaCreativeDoc schema
 * Extracts only essential metadata, no raw payloads
 */
export function normalizeMetaAdToCreativeDoc(
    ad: any,
    clientId: string,
    metaAccountId: string
): MetaCreativeDoc {
    const creative = ad.creative || {};
    const objectStorySpec = creative.object_story_spec || {};
    const assetFeedSpec = creative.asset_feed_spec || {};
    const linkData = objectStorySpec.link_data || {};
    const videoData = objectStorySpec.video_data || {};

    // Determine format
    let format: CreativeFormat = "IMAGE";
    let isDynamicProductAd = false;
    let hasCatalog = false;

    if (assetFeedSpec.videos?.length > 0 || videoData.video_id) {
        format = "VIDEO";
    } else if (assetFeedSpec.link_urls?.length > 1 || linkData.child_attachments?.length > 0) {
        format = "CAROUSEL";
    } else if (ad.adset?.promoted_object?.catalog_id || assetFeedSpec.product_set_id) {
        format = "CATALOG";
        isDynamicProductAd = true;
        hasCatalog = true;
    }

    // Extract copy
    const primaryText = linkData.message || assetFeedSpec.bodies?.[0]?.text || "";
    const headline = linkData.name || assetFeedSpec.titles?.[0]?.text || "";
    const description = linkData.description || assetFeedSpec.descriptions?.[0]?.text || "";
    const ctaType = linkData.call_to_action?.type || "";
    const destinationUrl = linkData.link || assetFeedSpec.link_urls?.[0]?.website_url || "";

    // Extract assets (refs only)
    const videoId = videoData.video_id || assetFeedSpec.videos?.[0]?.video_id || null;
    const imageHash = linkData.image_hash || assetFeedSpec.images?.[0]?.hash || null;

    // Carousel items (max 10)
    let carousel = null;
    if (format === "CAROUSEL") {
        const childAttachments = linkData.child_attachments || [];
        carousel = {
            items: childAttachments.slice(0, 10).map((item: any) => ({
                headline: item.name || "",
                description: item.description || "",
                destinationUrl: item.link || "",
                imageHash: item.image_hash || ""
            }))
        };
    }

    // Catalog info
    let catalog = null;
    if (hasCatalog) {
        catalog = {
            catalogId: ad.adset?.promoted_object?.catalog_id || "",
            productSetId: assetFeedSpec.product_set_id || "",
            templateName: creative.template_url_spec?.name || ""
        };
    }

    // Generate fingerprint for deduplication
    const fingerprintData = {
        format,
        primaryText,
        headline,
        ctaType,
        destinationUrl,
        videoId,
        imageHash,
        carouselItemsSummary: carousel?.items.map((i: any) => `${i.headline}|${i.destinationUrl}|${i.imageHash}`).join("||") || "",
        productSetId: catalog?.productSetId || ""
    };
    const fingerprint = createHash("sha256").update(JSON.stringify(fingerprintData)).digest("hex");

    const now = new Date().toISOString();
    const isActive = ad.effective_status === "ACTIVE";

    return {
        clientId,
        metaAccountId,
        status: ad.effective_status,
        effectiveStatus: ad.effective_status,
        lastSeenActiveAt: isActive ? now : "", // Will be merged with existing
        firstSeenAt: now, // Will be preserved on merge
        updatedAt: now,

        campaign: {
            id: ad.campaign?.id || "",
            name: ad.campaign?.name || "",
            objective: ad.campaign?.objective || "",
            buyingType: ad.campaign?.buying_type || ""
        },

        adset: {
            id: ad.adset?.id || "",
            name: ad.adset?.name || "",
            optimizationGoal: ad.adset?.optimization_goal || "",
            billingEvent: ad.adset?.billing_event || "",
            promotedObject: {
                ...(ad.adset?.promoted_object?.pixel_id ? { pixelId: ad.adset.promoted_object.pixel_id } : {}),
                ...(ad.adset?.promoted_object?.custom_event_type ? { customEventType: ad.adset.promoted_object.custom_event_type } : {}),
                ...(ad.adset?.promoted_object?.catalog_id ? { catalogId: ad.adset.promoted_object.catalog_id } : {})
            }
        },

        ad: {
            id: ad.id,
            name: ad.name
        },

        creative: {
            id: creative.id || "",
            format,
            isDynamicProductAd,
            hasCatalog,
            primaryText,
            headline,
            description,
            ctaType,
            destinationUrl,
            pageId: objectStorySpec.page_id,
            instagramActorId: objectStorySpec.instagram_actor_id,
            assets: {
                ...(videoId ? { videoId } : {}),
                ...(imageHash ? { imageHash } : {}),
                ...(carousel ? { carousel } : {}),
                ...(catalog ? { catalog } : {})
            }
        },

        labels: {},
        fingerprint
    };
}

/**
 * Upsert creative docs to Firestore (idempotent)
 * DocID = ${clientId}__${adId}
 */
export async function upsertCreativeDocs(
    docs: MetaCreativeDoc[]
): Promise<{ created: number; updated: number; skipped: number }> {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    // Process in batches of 500 (Firestore batch limit)
    const batchSize = 500;
    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + batchSize);

        for (const doc of chunk) {
            const docId = `${doc.clientId}__${doc.ad.id}`;
            const docRef = db.collection("meta_creatives").doc(docId);

            // Check if exists to determine created vs updated
            const existing = await docRef.get();

            if (!existing.exists) {
                // New doc: set all fields
                batch.set(docRef, sanitizeForFirestore(doc));
                created++;
            } else {
                const existingData = existing.data() as MetaCreativeDoc;

                // Skip if fingerprint unchanged
                if (existingData.fingerprint === doc.fingerprint) {
                    skipped++;
                    continue;
                }

                // Update: preserve firstSeenAt, update lastSeenActiveAt only if currently active
                const updateData: any = { ...doc };
                updateData.firstSeenAt = existingData.firstSeenAt;

                if (doc.status !== "ACTIVE") {
                    updateData.lastSeenActiveAt = existingData.lastSeenActiveAt;
                }

                batch.set(docRef, sanitizeForFirestore(updateData), { merge: true });
                updated++;
            }
        }

        await batch.commit();
        console.log(`Committed batch ${Math.floor(i / batchSize) + 1}: ${chunk.length} docs`);
    }

    return { created, updated, skipped };
}

/**
 * Main sync function: Fetch from Meta → Normalize → Upsert to Firestore
 */
export async function syncMetaCreatives(
    clientId: string,
    metaAdAccountId: string
): Promise<CreativeSyncMetrics & { durationMs: number; counters: any }> {
    const startTime = Date.now();
    const errors: string[] = [];
    const counters = {
        fetchedTotal: 0,
        keptActiveReal: 0,
        skippedByAdStatus: 0,
        skippedByCampaignStatus: 0,
        skippedByAdsetStatus: 0,
        skippedMissingParents: 0
    };

    try {
        if (!META_ACCESS_TOKEN) {
            throw new Error("META_ACCESS_TOKEN not configured");
        }

        console.log(`Starting creative sync for client ${clientId}, account ${metaAdAccountId}`);

        // 1. Fetch from Meta
        const rawAds = await fetchMetaCreatives(metaAdAccountId, META_ACCESS_TOKEN);
        counters.fetchedTotal = rawAds.length;

        // 2. Strict Filering (ACTIVE REAL)
        const activeRealAds = rawAds.filter(ad => {
            if (ad.effective_status !== "ACTIVE") {
                counters.skippedByAdStatus++;
                return false;
            }
            if (!ad.campaign || !ad.adset) {
                counters.skippedMissingParents++;
                return false;
            }
            if (ad.campaign.effective_status !== "ACTIVE") {
                counters.skippedByCampaignStatus++;
                return false;
            }
            if (ad.adset.effective_status !== "ACTIVE") {
                counters.skippedByAdsetStatus++;
                return false;
            }
            return true;
        });

        counters.keptActiveReal = activeRealAds.length;
        console.log(`Filtering complete: ${counters.keptActiveReal} kept as ACTIVE REAL out of ${counters.fetchedTotal}`);

        // 3. Normalize
        const normalizedDocs = activeRealAds.map(ad =>
            normalizeMetaAdToCreativeDoc(ad, clientId, metaAdAccountId)
        );

        // 4. Upsert to Firestore
        const { created, updated, skipped } = await upsertCreativeDocs(normalizedDocs);
        const durationMs = Date.now() - startTime;

        console.log(`Sync complete in ${durationMs}ms: ${created} created, ${updated} updated, ${skipped} skipped`);

        return {
            ok: true,
            totalAdsFetched: counters.fetchedTotal,
            docsCreated: created,
            docsUpdated: updated,
            docsSkipped: skipped,
            errors,
            syncedAt: new Date().toISOString(),
            durationMs,
            counters
        };

    } catch (error: any) {
        const durationMs = Date.now() - startTime;
        console.error("Creative sync error:", error);
        errors.push(error.message || String(error));

        return {
            ok: false,
            totalAdsFetched: counters.fetchedTotal,
            docsCreated: 0,
            docsUpdated: 0,
            docsSkipped: 0,
            errors,
            syncedAt: new Date().toISOString(),
            durationMs,
            counters
        };
    }
}
