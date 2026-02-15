export interface ConceptBriefDoc {
    id: string; // clientId__conceptId__rangeId__promptVersionId
    clientId: string;
    conceptId: string;
    range: { start: string; end: string };

    // Brief Sections
    context: string;
    evidence: string[];
    diagnosis: string;
    rotationPlan: {
        avatar: string;
        conflict: string;
        proof: string;
        format: string;
        context: string;
    };

    deliverables: {
        title: string;
        hooks: string[];
        script: string;
        visual: string;
        cta: string;
        proofType: string;
    }[];

    successCriteria: string;

    promptVersionId: string;
    createdAt: string;
}
