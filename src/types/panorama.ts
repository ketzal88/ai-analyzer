/**
 * Panorama General — Types for the multi-client team overview panel
 */

export type SemaforoColor = 'green' | 'yellow' | 'red';

/** Single KPI cell data */
export interface PanoramaKPICell {
    value: number;
    previousValue: number;
    momPct: number | null;
    status: SemaforoColor;
}

/** Channel-level KPI groups */
export interface PanoramaAdsKPIs {
    spend: PanoramaKPICell;
    cpa: PanoramaKPICell;
    roas: PanoramaKPICell;
}

export interface PanoramaEcommerceKPIs {
    revenue: PanoramaKPICell;
    orders: PanoramaKPICell;
    aov: PanoramaKPICell;
}

export interface PanoramaEmailKPIs {
    sent: PanoramaKPICell;
    openRate: PanoramaKPICell;
    clickRate: PanoramaKPICell;
}

/** One client row */
export interface PanoramaClientRow {
    clientId: string;
    clientName: string;
    clientSlug: string;
    teamId: string | null;
    meta?: PanoramaAdsKPIs;
    google?: PanoramaAdsKPIs;
    ecommerce?: PanoramaEcommerceKPIs;
    email?: PanoramaEmailKPIs;
}

/** One team group */
export interface PanoramaTeamGroup {
    teamId: string | null;
    teamName: string;
    clients: PanoramaClientRow[];
}

/** Full API response */
export interface PanoramaResponse {
    teams: PanoramaTeamGroup[];
    period: { start: string; end: string; label: string };
    comparisonPeriod: { start: string; end: string; label: string };
}
