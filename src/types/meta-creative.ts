/**
 * AG-41: Meta Creative Library Types
 * Normalized schema for storing Meta Ads creative metadata without raw payloads
 */

export type CreativeFormat = "IMAGE" | "VIDEO" | "CAROUSEL" | "CATALOG";
export type CreativeStatus = "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED";

export interface MetaCreativeDoc {
    // Identity
    clientId: string;
    metaAccountId: string;

    // Status & Lifecycle
    status: CreativeStatus;
    effectiveStatus: string;
    lastSeenActiveAt: string;
    firstSeenAt: string;
    updatedAt: string;

    // Campaign Hierarchy
    campaign: {
        id: string;
        name: string;
        objective: string;
        buyingType: string;
    };

    adset: {
        id: string;
        name: string;
        optimizationGoal: string;
        billingEvent: string;
        promotedObject?: {
            pixelId?: string;
            customEventType?: string;
            catalogId?: string;
        };
    };

    ad: {
        id: string;
        name: string;
    };

    // Creative Content
    creative: {
        id: string;
        format: CreativeFormat;
        isDynamicProductAd: boolean;
        hasCatalog: boolean;

        // Copy
        primaryText?: string;
        headline?: string;
        description?: string;
        ctaType?: string;
        destinationUrl?: string;

        // Social
        pageId?: string;
        instagramActorId?: string;

        // Assets (refs only, no media)
        assets: {
            videoId?: string | null;
            imageHash?: string | null;
            carousel?: {
                items: Array<{
                    headline?: string;
                    description?: string;
                    destinationUrl?: string;
                    imageHash?: string;
                }>;
            } | null;
            catalog?: {
                catalogId?: string;
                productSetId?: string;
                templateName?: string;
            } | null;
        };
    };

    // Labels (for future clustering/analysis)
    labels?: {
        conceptTag?: string;
        funnelStage?: string;
        angle?: string;
        avatar?: string;
    };

    // Fingerprint for deduplication
    fingerprint: string;
}

/**
 * Sync metrics returned by the creative sync operation
 */
export interface CreativeSyncMetrics {
    ok: boolean;
    totalAdsFetched: number;
    docsCreated: number;
    docsUpdated: number;
    docsSkipped: number;
    errors: string[];
    syncedAt: string;
}

/**
 * Query filters for creative library endpoint
 */
export interface CreativeLibraryFilters {
    clientId: string;
    campaignId?: string;
    format?: CreativeFormat;
    status?: CreativeStatus;
    activeSince?: string; // ISO date
    limit?: number;
}
