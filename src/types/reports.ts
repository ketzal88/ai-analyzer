/**
 * Gemini Report Interface
 */
export interface GeminiReport {
    id: string;
    accountId: string;
    digest: string;
    summary: any;
    analysis: {
        diagnosis: string[];
        hypotheses: {
            title: string;
            probability: "low" | "medium" | "high";
            reasoning: string;
        }[];
        actions_next_72h: {
            action: string;
            priority: "critical" | "high" | "medium";
            expected_impact: string;
        }[];
        questions_to_confirm: string[];
    };
    createdAt: string;
}
