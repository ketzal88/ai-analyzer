export type CreativeFormat = 'VIDEO' | 'IMAGE' | 'CAROUSEL' | 'CATALOG';

export type VisualStyle = 'ugc' | 'polished' | 'meme' | 'testimonial' | 'product-shot' | 'lifestyle';
export type HookType = 'question' | 'shock' | 'problem' | 'social-proof' | 'offer' | 'curiosity';
export type SettingType = 'studio' | 'outdoor' | 'home' | 'office' | 'abstract';
export type EmotionalTone = 'urgency' | 'trust' | 'excitement' | 'fear' | 'calm';
export type MessageType = 'benefit' | 'feature' | 'testimonial' | 'offer' | 'story';
export type CtaType = 'shop-now' | 'learn-more' | 'sign-up' | 'get-offer' | 'whatsapp' | 'other';

export interface CreativeDNA {
    clientId: string;
    adId: string;
    creativeHash: string;
    format: CreativeFormat;

    // From Meta API (no cost)
    meta: {
        headline?: string;
        bodyText?: string;
        callToAction?: string;
        linkUrl?: string;
        videoDuration?: number;
        thumbnailUrl?: string;
    };

    // From Gemini Vision analysis
    vision: {
        visualStyle: VisualStyle;
        hookType: HookType;
        dominantColor: string;
        hasText: boolean;
        hasFace: boolean;
        hasProduct: boolean;
        settingType: SettingType;
        emotionalTone: EmotionalTone;
    };

    // From NLP on copy
    copy: {
        messageType: MessageType;
        hasNumbers: boolean;
        hasEmoji: boolean;
        wordCount: number;
        ctaType: CtaType;
    };

    // Computed
    estimatedEntityGroup?: string;
    analyzedAt: string;
}

export interface DiversityScore {
    clientId: string;
    totalActiveAds: number;
    uniqueEntityGroups: number;
    score: number; // uniqueGroups / totalActive (0-1)
    dominantStyle?: VisualStyle;
    dominantHookType?: HookType;
    formatDistribution: Record<CreativeFormat, number>;
    computedAt: string;
}
