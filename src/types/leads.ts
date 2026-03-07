/**
 * Leads / CRM Types — Worker Brain
 *
 * Type definitions for the LEADS channel: individual lead records,
 * GHL webhook payloads, and aggregated funnel metrics.
 *
 * Firestore collection: `leads`
 * Document ID: auto-generated or `{clientId}__{ghlContactId}`
 */

// ── Lead Status Enums ─────────────────────────────────

export type LeadQualification = 'pending' | 'calificado' | 'no_calificado' | 'spam' | 'verificando';

export type LeadPostCallStatus =
  | 'pendiente'        // Not yet called
  | 'nuevo_cliente'    // Closed deal
  | 'seguimiento'      // Follow-up needed
  | 'reprogramado'     // Rescheduled
  | 'no_asistio'       // No-show
  | 'cancelo';         // Cancelled

export type LeadQualityScore = 1 | 2 | 3 | null;

export type LeadSource = 'ghl_webhook' | 'manual' | 'csv_import';

export type LeadsMode = 'full_funnel' | 'whatsapp_simple';

// ── Individual Lead Record ────────────────────────────

export interface Lead {
  id: string;
  clientId: string;

  // Contact info (from GHL or manual entry)
  name: string;
  email?: string;
  phone?: string;
  country?: string;

  // Calendar / booking info (full_funnel mode)
  calendarType?: string;               // e.g., "Llamada De Descubrimiento"
  scheduledDate?: string;              // ISO date of the scheduled call
  confirmationStatus?: string;         // GHL confirmation response

  // Assignment
  closerAssigned?: string;             // Closer name (María, Sebastian, etc.)

  // UTM tracking (from Meta Ads → GHL)
  utm?: {
    source?: string;                   // utm_source
    medium?: string;                   // utm_medium
    campaign?: string;                 // utm_campaign — often the ad set/campaign name
    content?: string;                  // utm_content — often the ad ID or creative name
    term?: string;                     // utm_term
  };

  // ── Qualification (filled by closer AFTER the call) ──
  qualification: LeadQualification;
  qualityScore: LeadQualityScore;
  attendance: boolean | null;          // null = not yet determined
  postCallStatus: LeadPostCallStatus;
  revenue: number;                     // Revenue if closed ($), 0 otherwise
  closerComments?: string;

  // ── Metadata ──
  source: LeadSource;
  ghlContactId?: string;              // GHL internal contact ID (for dedup)
  ghlLocationId?: string;             // GHL location/sub-account ID
  createdAt: string;                   // ISO 8601 — when lead entered
  updatedAt: string;                   // ISO 8601 — last update
  qualifiedAt?: string;               // ISO 8601 — when closer qualified
}

// ── GHL Webhook Payload ───────────────────────────────

/**
 * Normalized subset of GoHighLevel webhook payload fields.
 * GHL sends different shapes depending on the trigger type
 * (ContactCreate, AppointmentCreate, etc.). We normalize to this.
 */
export interface GHLWebhookPayload {
  type?: string;                       // e.g., "ContactCreate", "AppointmentCreate"
  contact_id?: string;
  location_id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  country?: string;

  // Calendar fields
  calendar_name?: string;
  appointment_status?: string;
  start_time?: string;

  // UTM fields (captured by GHL from landing page)
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;

  // Assignment
  assigned_to?: string;

  // GHL custom fields (key-value pairs)
  customField?: Record<string, string>;
  tags?: string[];
}

// ── Client Config Extension ───────────────────────────

export interface LeadsConfig {
  closers: string[];                   // List of closer names for assignment
  calendarTypes: string[];             // Configurable calendar type labels
  mode: LeadsMode;                     // full_funnel or whatsapp_simple
}

// ── Aggregated Funnel Metrics (for channel_snapshots rawData) ──

export interface LeadsFunnelStage {
  stage: string;                       // e.g., "leads", "calificados", "asistieron", "nuevos_clientes"
  count: number;
  conversionRate?: number;             // % from previous stage
}

export interface LeadsCloserBreakdown {
  closer: string;
  totalLeads: number;
  qualified: number;
  attended: number;
  newClients: number;
  revenue: number;
  qualificationRate: number;
  attendanceRate: number;
  closeRate: number;
}

export interface LeadsUtmBreakdown {
  campaign: string;                    // utm_campaign value
  content?: string;                    // utm_content (ad ID/name)
  totalLeads: number;
  qualified: number;
  qualificationRate: number;
  revenue: number;
}
