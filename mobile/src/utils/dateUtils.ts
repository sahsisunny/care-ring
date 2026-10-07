/**
 * Date & Time Formatting Utilities for Life360 Mobile
 * 
 * Ensures all dates and times are presented in the user's local timezone (e.g., IST in India),
 * displaying time-only for today's events and including dates for past events (e.g., Yesterday or Oct 5).
 */

/**
 * Safely parses any date input (string, number, Date) into a valid Date object.
 * Handles ISO strings with/without timezone, SQL timestamps, and numeric timestamps.
 */
export function safeParseDate(input: any): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check if numeric string (e.g. "1728200000000")
    if (/^\d{10,}$/.test(trimmed)) {
      const d = new Date(Number(trimmed));
      if (!isNaN(d.getTime())) return d;
    }

    // Replace SQL space separator with ISO 'T'
    let iso = trimmed;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(iso)) {
      iso = iso.replace(' ', 'T');
    }

    // If UTC timestamp without timezone offset/Z suffix, append 'Z' so device converts from UTC to local
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(iso)) {
      iso = iso + 'Z';
    }

    const d = new Date(iso);
    if (!isNaN(d.getTime())) return d;

    const fallback = new Date(trimmed);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  return null;
}

/**
 * Checks if the given date is today in the device's local timezone.
 */
export function isToday(date: any): boolean {
  const d = safeParseDate(date);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/**
 * Checks if the given date is yesterday in the device's local timezone.
 */
export function isYesterday(date: any): boolean {
  const d = safeParseDate(date);
  if (!d) return false;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  );
}

/**
 * Checks if the date is in the current year.
 */
export function isThisYear(date: any): boolean {
  const d = safeParseDate(date);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear();
}

/**
 * Formats time-only in local 12-hour format (e.g., "10:45 AM").
 */
export function formatLocalTime(date: any): string {
  const d = safeParseDate(date);
  if (!d) return '';
  return d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats an event date & time according to local timezone:
 * - If today: "10:45 AM"
 * - If yesterday: "Yesterday, 10:45 AM"
 * - If earlier this year: "Oct 5, 10:45 AM" (or "5 Oct, 10:45 AM" depending on locale)
 * - If past year: "Oct 5, 2025, 10:45 AM"
 */
export function formatEventDateTime(
  timestamp?: string | number | Date | null,
  fallback?: string
): string {
  const d = safeParseDate(timestamp);
  if (!d) return fallback || '';

  const timeStr = formatLocalTime(d);

  if (isToday(d)) {
    return timeStr;
  }

  if (isYesterday(d)) {
    return `Yesterday, ${timeStr}`;
  }

  const dateOptions: Intl.DateTimeFormatOptions = isThisYear(d)
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };

  const dateStr = d.toLocaleDateString([], dateOptions);
  return `${dateStr}, ${timeStr}`;
}

/**
 * Formats alert notifications:
 * - If under 1 minute ago: "Just now"
 * - If today: "10:45 AM"
 * - If yesterday: "Yesterday, 10:45 AM"
 * - If older: "Oct 5, 10:45 AM"
 */
export function formatAlertDateTime(
  timestamp?: string | number | Date | null,
  fallback?: string
): string {
  const d = safeParseDate(timestamp);
  if (!d) return fallback || '';

  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs >= 0 && diffMs < 60000) {
    return 'Just now';
  }

  return formatEventDateTime(d, fallback);
}

/**
 * Formats day label for trips / drive cards:
 * - If today: "Today"
 * - If yesterday: "Yesterday"
 * - If older: "Mon, Oct 5"
 */
export function formatTripDayLabel(
  timestamp?: string | number | Date | null,
  fallback?: string
): string {
  const d = safeParseDate(timestamp);
  if (!d) return fallback || 'Drive';

  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';

  const dateOptions: Intl.DateTimeFormatOptions = isThisYear(d)
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };

  return d.toLocaleDateString([], dateOptions);
}

/**
 * Formats a trip start-end time range in local timezone (e.g., "10:30 AM - 11:15 AM").
 */
export function formatTripTimeRange(
  startTimestamp?: string | number | Date | null,
  endTimestamp?: string | number | Date | null,
  fallbackStart?: string,
  fallbackEnd?: string
): string {
  const start = safeParseDate(startTimestamp);
  const end = safeParseDate(endTimestamp);

  const startStr = start ? formatLocalTime(start) : (fallbackStart || '');
  const endStr = end ? formatLocalTime(end) : (fallbackEnd || '');

  if (startStr && endStr) return `${startStr} - ${endStr}`;
  return startStr || endStr || '';
}
