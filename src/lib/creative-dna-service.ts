import { db } from "@/lib/firebase-admin";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { reportError } from "@/lib/error-reporter";
import {
    CreativeDNA,
    CreativeFormat,
    DiversityScore,
    VisualStyle,
    HookType,
    CtaType,
    MessageType,
    SettingType,
    EmotionalTone
} from "@/types/creative-dna";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const VISION_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export class CreativeDNAService {

    /**
     * Analyze all new creatives for a client that don't have DNA yet.
     * Returns the number of creatives analyzed.
     */
    static async analyzeNewCreatives(clientId: string): Promise<number> {
        // 1. Get all active creatives
        const creativesSnap = await db.collection("meta_creatives")
            .where("clientId", "==", clientId)
            .where("status", "==", "ACTIVE")
            .get();

        if (creativesSnap.empty) return 0;

        // 2. Get existing DNA records
        const existingDnaSnap = await db.collection("creative_dna")
            .where("clientId", "==", clientId)
            .get();

        const existingHashes = new Set(existingDnaSnap.docs.map(d => d.data().creativeHash));

        // 3. Filter creatives that need analysis
        const toAnalyze = creativesSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((c: any) => {
                const hash = c.fingerprint || c.creativeHash || c.id;
                return !existingHashes.has(hash);
            });

        if (toAnalyze.length === 0) return 0;

        console.log(`[CreativeDNA] ${toAnalyze.length} creatives to analyze for ${clientId}`);

        let analyzed = 0;

        for (const creative of toAnalyze) {
            try {
                const dna = await this.analyzeCreative(clientId, creative as any);
                if (dna) {
                    const docId = `${clientId}__${dna.adId}`;
                    await db.collection("creative_dna").doc(docId).set(dna);
                    analyzed++;
                }
            } catch (err: any) {
                reportError("CreativeDNA Analysis", err, { clientId, metadata: { adId: (creative as any).adId } });
            }
        }

        // 4. Update diversity score
        await this.updateDiversityScore(clientId);

        return analyzed;
    }

    /**
     * Analyze a single creative using Gemini Vision + text analysis.
     */
    private static async analyzeCreative(clientId: string, creative: any): Promise<CreativeDNA | null> {
        const adId = creative.adId || creative.id?.split('__')[1] || '';
        const format = this.detectFormat(creative);
        const thumbnailUrl = creative.thumbnailUrl || creative.imageUrl || creative.videoThumbnailUrl;
        const bodyText = creative.body || creative.message || '';
        const headline = creative.title || creative.headline || '';
        const cta = creative.callToAction || creative.call_to_action?.type || '';

        // Vision analysis (if we have an image/thumbnail URL)
        let vision = this.defaultVision();
        if (thumbnailUrl) {
            try {
                vision = await this.analyzeVisual(thumbnailUrl, format);
            } catch (err: any) {
                console.warn(`[CreativeDNA] Vision analysis failed for ${adId}: ${err.message}`);
            }
        }

        // Copy analysis
        const copy = this.analyzeCopy(bodyText, headline, cta);

        // Estimate entity group from visual + copy attributes
        const estimatedEntityGroup = `${vision.visualStyle}_${vision.hookType}_${vision.settingType}`;

        return {
            clientId,
            adId,
            creativeHash: creative.fingerprint || creative.creativeHash || adId,
            format,
            meta: {
                headline,
                bodyText: bodyText.substring(0, 500),
                callToAction: cta,
                linkUrl: creative.linkUrl || creative.website_url,
                videoDuration: creative.videoDuration,
                thumbnailUrl
            },
            vision,
            copy,
            estimatedEntityGroup,
            analyzedAt: new Date().toISOString()
        };
    }

    /**
     * Use Gemini Vision to analyze the creative's visual attributes.
     */
    private static async analyzeVisual(imageUrl: string, format: CreativeFormat): Promise<CreativeDNA['vision']> {
        const model = genAI.getGenerativeModel({ model: VISION_MODEL });

        const prompt = `Analyze this ad creative image and respond ONLY with a JSON object (no markdown, no explanation):
{
  "visualStyle": one of "ugc", "polished", "meme", "testimonial", "product-shot", "lifestyle",
  "hookType": one of "question", "shock", "problem", "social-proof", "offer", "curiosity",
  "dominantColor": hex color string,
  "hasText": boolean,
  "hasFace": boolean,
  "hasProduct": boolean,
  "settingType": one of "studio", "outdoor", "home", "office", "abstract",
  "emotionalTone": one of "urgency", "trust", "excitement", "fear", "calm"
}`;

        const response = await model.generateContent([
            prompt,
            { inlineData: { mimeType: 'image/jpeg', data: await this.fetchImageAsBase64(imageUrl) } }
        ]);

        const text = response.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return this.defaultVision();

        const parsed = JSON.parse(jsonMatch[0]);
        return {
            visualStyle: parsed.visualStyle || 'polished',
            hookType: parsed.hookType || 'offer',
            dominantColor: parsed.dominantColor || '#000000',
            hasText: parsed.hasText ?? false,
            hasFace: parsed.hasFace ?? false,
            hasProduct: parsed.hasProduct ?? true,
            settingType: parsed.settingType || 'studio',
            emotionalTone: parsed.emotionalTone || 'trust'
        };
    }

    /**
     * Analyze copy/text attributes without AI (deterministic).
     */
    private static analyzeCopy(body: string, headline: string, cta: string): CreativeDNA['copy'] {
        const fullText = `${headline} ${body}`.toLowerCase();
        const words = fullText.split(/\s+/).filter(w => w.length > 0);

        // Detect message type
        let messageType: MessageType = 'benefit';
        if (/\d+%|descuento|oferta|promo|gratis|free/i.test(fullText)) messageType = 'offer';
        else if (/dijo|dice|testimoni|review|estrella/i.test(fullText)) messageType = 'testimonial';
        else if (/característica|feature|incluye|tiene/i.test(fullText)) messageType = 'feature';
        else if (/historia|cuando|era|fue/i.test(fullText)) messageType = 'story';

        // Detect CTA type
        let ctaType: CtaType = 'other';
        const ctaLower = (cta || '').toLowerCase();
        if (/shop|compra|buy/i.test(ctaLower)) ctaType = 'shop-now';
        else if (/learn|más info|saber/i.test(ctaLower)) ctaType = 'learn-more';
        else if (/sign|regist|suscri/i.test(ctaLower)) ctaType = 'sign-up';
        else if (/offer|oferta|descuento/i.test(ctaLower)) ctaType = 'get-offer';
        else if (/whatsapp|mensaje|chat/i.test(ctaLower)) ctaType = 'whatsapp';

        return {
            messageType,
            hasNumbers: /\d/.test(fullText),
            hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(fullText),
            wordCount: words.length,
            ctaType
        };
    }

    /**
     * Calculate diversity score for a client's active creatives.
     */
    static async updateDiversityScore(clientId: string): Promise<DiversityScore | null> {
        const dnaSnap = await db.collection("creative_dna")
            .where("clientId", "==", clientId)
            .get();

        if (dnaSnap.empty) return null;

        const dnas = dnaSnap.docs.map(d => d.data() as CreativeDNA);

        // Count unique entity groups
        const groups = new Set(dnas.map(d => d.estimatedEntityGroup));

        // Format distribution
        const formatDist: Record<CreativeFormat, number> = { VIDEO: 0, IMAGE: 0, CAROUSEL: 0, CATALOG: 0 };
        for (const d of dnas) {
            formatDist[d.format] = (formatDist[d.format] || 0) + 1;
        }

        // Find dominant style and hook
        const styleCounts = this.countField(dnas, d => d.vision.visualStyle);
        const hookCounts = this.countField(dnas, d => d.vision.hookType);

        const score: DiversityScore = {
            clientId,
            totalActiveAds: dnas.length,
            uniqueEntityGroups: groups.size,
            score: dnas.length > 0 ? groups.size / dnas.length : 0,
            dominantStyle: this.topKey(styleCounts) as VisualStyle,
            dominantHookType: this.topKey(hookCounts) as HookType,
            formatDistribution: formatDist,
            computedAt: new Date().toISOString()
        };

        await db.collection("creative_diversity_scores").doc(clientId).set(score);
        return score;
    }

    // ─── Helpers ─────────────────────────────────────────────

    private static detectFormat(creative: any): CreativeFormat {
        const format = (creative.format || creative.creative_type || '').toUpperCase();
        if (format.includes('VIDEO')) return 'VIDEO';
        if (format.includes('CAROUSEL')) return 'CAROUSEL';
        if (format.includes('CATALOG') || format.includes('DPA')) return 'CATALOG';
        return 'IMAGE';
    }

    private static defaultVision(): CreativeDNA['vision'] {
        return {
            visualStyle: 'polished',
            hookType: 'offer',
            dominantColor: '#000000',
            hasText: false,
            hasFace: false,
            hasProduct: true,
            settingType: 'studio',
            emotionalTone: 'trust'
        };
    }

    private static async fetchImageAsBase64(url: string): Promise<string> {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer).toString('base64');
    }

    private static countField<T>(items: T[], getter: (item: T) => string): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const item of items) {
            const val = getter(item);
            counts[val] = (counts[val] || 0) + 1;
        }
        return counts;
    }

    private static topKey(counts: Record<string, number>): string | undefined {
        let maxKey: string | undefined;
        let maxVal = 0;
        for (const [key, val] of Object.entries(counts)) {
            if (val > maxVal) { maxVal = val; maxKey = key; }
        }
        return maxKey;
    }
}
