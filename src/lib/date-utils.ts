/**
 * Date Utilities — Worker Brain V2
 *
 * Standardized date handling for all Channel Brains.
 *
 * Key Features:
 * - Timezone-aware date range construction
 * - Dashbo date format parsing ("YYYYMMDD" → Date)
 * - Standard windows: today, yesterday, last7days, last30days, mtd
 *
 * Critical for:
 * - International clients (respect their timezone for "yesterday")
 * - Dashbo MCP integration (uses "YYYYMMDD" format in responses)
 * - Consistent date logic across Meta/Google/GA4/Ecommerce brains
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
 * Parse Dashbo date format to Date object
 *
 * Dashbo MCP returns dates as "YYYYMMDD" strings (e.g., "20260224").
 * This function converts them to Date objects for processing.
 *
 * @param raw - Date string in YYYYMMDD format
 * @returns Date object
 *
 * @example
 * parseDashboDate("20260224")  // Date(2026, 1, 24)  // Note: month is 0-indexed
 * parseDashboDate("20260101")  // Date(2026, 0, 1)
 */
export function parseDashboDate(raw: string): Date {
  if (raw.length !== 8) {
    throw new Error(`Invalid Dashbo date format: "${raw}". Expected YYYYMMDD (8 digits).`);
  }

  const year = parseInt(raw.slice(0, 4), 10);
  const month = parseInt(raw.slice(4, 6), 10) - 1;  // 0-indexed
  const day = parseInt(raw.slice(6, 8), 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid Dashbo date: "${raw}". Could not parse year/month/day.`);
  }

  return new Date(year, month, day);
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
