export interface BackfillTask {
    id: string;
    clientId: string;
    date: string; // YYYY-MM-DD
    status: 'pending' | 'processing' | 'completed' | 'failed';
    attempts: number;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
    priority: number;
}

export interface BackfillStats {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    processing: number;
}
