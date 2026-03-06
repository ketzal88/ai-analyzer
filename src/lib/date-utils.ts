/**
 * Date Utilities
 *
 * Standardized date handling for all Channel Brains.
 *
 * Key Features:
 * - Timezone-aware date range construction
 * - Standard windows: today, yesterday, last7days, last30days, mtd
 *
 * Critical for:
 * - International clients (respect their timezone for "yesterday")
 * - Consistent date logic across Meta/Google/Ecommerce/Email brains
 */

/**
 * Standard date range format (YYYY-MM-DD)
 */
export interface DateRange {
  start: string;
  end: string;
}

/**
 * Standard date ranges used by the system
 */
export interface DateRanges {
  /** Current day (use sparingly — incomplete data) */
  today: DateRange;
  /** Most recent complete day (base for daily Briefing) */
  yesterday: DateRange;
  /** Last 7 complete days (creative analysis, weekly trends) */
  last7days: DateRange;
  /** Last 30 complete days (long-term creative performance) */
  last30days: DateRange;
  /** Month-to-date (first day of month → yesterday) */
  mtd: DateRange;
}

/**
 * Format a Date object as YYYY-MM-DD
 *
 * @param date - Date to format
 * @returns String in YYYY-MM-DD format
 *
 * @example
 * formatDate(new Date(2026, 1, 25)) // "2026-02-25"
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Build standard date ranges relative to a reference date
 *
 * @param now - Reference date (defaults to current system time)
 * @returns Object with 5 standard ranges
 *
 * @example
 * const ranges = buildDateRanges();
 * console.log(ranges.yesterday);  // { start: "2026-02-24", end: "2026-02-24" }
 * console.log(ranges.last7days);  // { start: "2026-02-18", end: "2026-02-24" }
 */
export function buildDateRanges(now: Date = new Date()): DateRanges {
  const today = new Date(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    today: {
      start: formatDate(today),
      end: formatDate(today)
    },
    yesterday: {
      start: formatDate(yesterday),
      end: formatDate(yesterday)
    },
    last7days: {
      start: formatDate(sevenDaysAgo),
      end: formatDate(yesterday)
    },
    last30days: {
      start: formatDate(thirtyDaysAgo),
      end: formatDate(yesterday)
    },
    mtd: {
      start: formatDate(firstOfMonth),
      end: formatDate(yesterday)
    }
  };
}

/**
 * Build date ranges for a specific timezone
 *
 * Critical for international clients. A client in Mexico City (GMT-6) at 04:00 UTC
 * is still in "yesterday" locally, so the Briefing should reference the previous day.
 *
 * @param tz - IANA timezone identifier (e.g., "America/Mexico_City", "Europe/Madrid")
 * @returns DateRanges constructed in the client's timezone
 *
 * @example
 * // At 04:00 UTC on 2026-02-25
 * const ranges = buildDateRangesForTimezone("America/Mexico_City");
 * console.log(ranges.yesterday);  // "2026-02-23" (Mexico is 6h behind, still Feb 24 22:00)
 *
 * @example
 * // Same UTC time, but Madrid timezone
 * const ranges = buildDateRangesForTimezone("Europe/Madrid");
 * console.log(ranges.yesterday);  // "2026-02-24" (Madrid is 1h ahead, already Feb 25 05:00)
 */
export function buildDateRangesForTimezone(tz: string): DateRanges {
  try {
    // Get current time in the client's timezone
    const nowInTz = new Date(
      new Date().toLocaleString('en-US', { timeZone: tz })
    );

    return buildDateRanges(nowInTz);
  } catch (error) {
    console.warn(`Invalid timezone "${tz}". Falling back to UTC.`, error);

    // Fallback to UTC if timezone is invalid
    return buildDateRanges(new Date());
  }
}

/**
 * Get the timezone offset in hours for a given timezone
 *
 * Useful for logging and debugging timezone issues.
 *
 * @param tz - IANA timezone identifier
 * @returns Offset in hours (e.g., -6 for Mexico City, +1 for Madrid)
 *
 * @example
 * getTimezoneOffset("America/Argentina/Buenos_Aires")  // -3
 * getTimezoneOffset("America/Mexico_City")             // -6
 * getTimezoneOffset("Europe/Madrid")                   // +1
 */
export function getTimezoneOffset(tz: string): number {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));

    const diffMs = tzDate.getTime() - utcDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours;
  } catch (error) {
    console.warn(`Could not determine offset for timezone "${tz}"`, error);
    return 0;
  }
}

/**
 * Check if a date string (YYYY-MM-DD) is within N days of a reference date
 *
 * Used by PerformanceService to compute rolling windows.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param days - Number of days to look back
 * @param refDate - Reference date (defaults to now)
 * @returns true if dateStr is within the window
 *
 * @example
 * // Today is 2026-02-25
 * isWithinDays("2026-02-24", 7)  // true (yesterday)
 * isWithinDays("2026-02-18", 7)  // true (7 days ago)
 * isWithinDays("2026-02-17", 7)  // false (8 days ago)
 */
export function isWithinDays(dateStr: string, days: number, refDate: Date = new Date()): boolean {
  const date = new Date(dateStr);
  const diffMs = refDate.getTime() - date.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays < days;
}

/**
 * Get a human-readable timezone name
 *
 * @param tz - IANA timezone identifier
 * @returns Formatted timezone string
 *
 * @example
 * getTimezoneLabel("America/Argentina/Buenos_Aires")  // "Buenos Aires (GMT-3)"
 * getTimezoneLabel("America/Mexico_City")             // "Ciudad de México (GMT-6)"
 */
export function getTimezoneLabel(tz: string): string {
  const offset = getTimezoneOffset(tz);
  const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`;

  // Extract city name from timezone ID
  const cityName = tz.split('/').pop()?.replace(/_/g, ' ') || tz;

  return `${cityName} (GMT${offsetStr})`;
}

/**
 * Common timezone presets for the admin UI
 */
export const COMMON_TIMEZONES = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (GMT-3)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Bogota', label: 'Bogotá (GMT-5)' },
  { value: 'America/Santiago', label: 'Santiago (GMT-3/-4)' },
  { value: 'America/Lima', label: 'Lima (GMT-5)' },
  { value: 'America/New_York', label: 'New York (GMT-5/-4)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8/-7)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1/+2)' },
  { value: 'Europe/London', label: 'London (GMT+0/+1)' },
  { value: 'UTC', label: 'UTC (GMT+0)' }
] as const;

// ── Unified Date Range Picker ────────────────────────────

export type DatePreset =
  | "custom"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_7d"
  | "last_week"
  | "last_14d"
  | "mtd"
  | "last_30d"
  | "last_month"
  | "last_90d";

export interface UnifiedDateRange {
  start: string;
  end: string;
  label: string;
  preset?: DatePreset;
}

export const PRESET_LABELS: Record<DatePreset, string> = {
  custom: "Personalizado",
  today: "Hoy",
  yesterday: "Ayer",
  this_week: "Esta semana (lun-Hoy)",
  last_7d: "Últimos 7 días",
  last_week: "La semana pasada (lun-dom)",
  last_14d: "Últimos 14 días",
  mtd: "Este mes",
  last_30d: "Últimos 30 días",
  last_month: "El mes pasado",
  last_90d: "Últimos 90 días",
};

export const PICKER_PRESETS: DatePreset[] = [
  "today",
  "yesterday",
  "this_week",
  "last_7d",
  "last_week",
  "last_14d",
  "mtd",
  "last_30d",
  "last_month",
  "last_90d",
];

export function resolvePreset(preset: DatePreset, refDate: Date = new Date()): UnifiedDateRange {
  const today = new Date(refDate);
  today.setHours(0, 0, 0, 0);

  let start: Date;
  let end: Date;

  switch (preset) {
    case "today":
      start = end = new Date(today);
      break;

    case "yesterday":
      start = end = new Date(today);
      start.setDate(today.getDate() - 1);
      break;

    case "this_week": {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start = new Date(today);
      start.setDate(today.getDate() - diff);
      end = new Date(today);
      break;
    }

    case "last_7d":
      start = new Date(today);
      start.setDate(today.getDate() - 7);
      end = new Date(today);
      end.setDate(today.getDate() - 1);
      break;

    case "last_week": {
      const day = today.getDay();
      const diffToLastSunday = day === 0 ? 7 : day;
      end = new Date(today);
      end.setDate(today.getDate() - diffToLastSunday);
      start = new Date(end);
      start.setDate(end.getDate() - 6);
      break;
    }

    case "last_14d":
      start = new Date(today);
      start.setDate(today.getDate() - 14);
      end = new Date(today);
      end.setDate(today.getDate() - 1);
      break;

    case "mtd":
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today);
      break;

    case "last_30d":
      start = new Date(today);
      start.setDate(today.getDate() - 30);
      end = new Date(today);
      end.setDate(today.getDate() - 1);
      break;

    case "last_month":
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      end = new Date(today.getFullYear(), today.getMonth(), 0);
      break;

    case "last_90d":
      start = new Date(today);
      start.setDate(today.getDate() - 90);
      end = new Date(today);
      end.setDate(today.getDate() - 1);
      break;

    default:
      start = new Date(today);
      start.setDate(today.getDate() - 7);
      end = new Date(today);
      end.setDate(today.getDate() - 1);
      break;
  }

  return {
    start: formatDate(start),
    end: formatDate(end),
    label: PRESET_LABELS[preset] || "Personalizado",
    preset,
  };
}

export function getComparisonRange(range: UnifiedDateRange): UnifiedDateRange {
  const start = new Date(range.start + "T12:00:00");
  const end = new Date(range.end + "T12:00:00");
  const durationMs = end.getTime() - start.getTime();
  const days = Math.floor(durationMs / (24 * 60 * 60 * 1000)) + 1;

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - days + 1);

  return {
    start: formatDate(prevStart),
    end: formatDate(prevEnd),
    label: `Periodo anterior (${days}d)`,
  };
}

export function validateDateRange(range: UnifiedDateRange): { valid: boolean; error?: string } {
  const start = new Date(range.start + "T12:00:00");
  const end = new Date(range.end + "T12:00:00");

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: "Fecha inválida" };
  }
  if (end < start) {
    return { valid: false, error: "La fecha de fin debe ser posterior a la de inicio" };
  }
  const days = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (days > 90) {
    return { valid: false, error: "El rango máximo es 90 días" };
  }
  return { valid: true };
}

export function formatRangeLabel(range: UnifiedDateRange): string {
  if (range.preset && range.preset !== "custom") {
    return PRESET_LABELS[range.preset];
  }
  const fmt = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };
  if (range.start === range.end) return fmt(range.start);
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}
