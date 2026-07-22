import type { OHLCVBar, SessionPreset } from "@/lib/orderflow/types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Calendar day key YYYY-MM-DD in the given IANA timezone. */
export function calendarDayKey(timestampMs: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampMs));

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function sessionTimeZone(preset: SessionPreset): string {
  switch (preset) {
    case "utc_day":
      return "UTC";
    case "america_new_york_day":
    case "rth_us_equities":
      return "America/New_York";
    default:
      return "UTC";
  }
}

/**
 * Session key for a bar. RTH preset still uses calendar day for grouping;
 * IB window uses clock minutes separately.
 */
export function sessionKeyForBar(timestampMs: number, preset: SessionPreset): string {
  const tz = sessionTimeZone(preset);
  const day = calendarDayKey(timestampMs, tz);
  if (preset === "rth_us_equities") {
    return `rth:${day}`;
  }
  return day;
}

/** Minutes from local midnight in session timezone (0–1439). */
export function minutesFromMidnight(timestampMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestampMs));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** US equities RTH filter: 09:30–16:00 America/New_York. */
export function isUsRth(timestampMs: number): boolean {
  const mins = minutesFromMidnight(timestampMs, "America/New_York");
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function filterBarsForSession(
  bars: OHLCVBar[],
  sessionKey: string,
  preset: SessionPreset,
): OHLCVBar[] {
  return bars.filter((bar) => {
    if (sessionKeyForBar(bar.timestamp, preset) !== sessionKey) {
      return false;
    }
    if (preset === "rth_us_equities" && !isUsRth(bar.timestamp)) {
      return false;
    }
    return true;
  });
}

export function listSessionKeys(bars: OHLCVBar[], preset: SessionPreset): string[] {
  const keys = new Set<string>();
  for (const bar of bars) {
    if (preset === "rth_us_equities" && !isUsRth(bar.timestamp)) {
      continue;
    }
    keys.add(sessionKeyForBar(bar.timestamp, preset));
  }
  return Array.from(keys).sort();
}

export function formatSessionDebug(timestampMs: number, preset: SessionPreset) {
  const tz = sessionTimeZone(preset);
  return `${sessionKeyForBar(timestampMs, preset)} (${tz}) ${pad(0)}`;
}
