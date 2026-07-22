import type { InitialBalance, OHLCVBar, SessionPreset } from "@/lib/orderflow/types";
import { minutesFromMidnight, sessionTimeZone } from "@/lib/orderflow/engine/sessions";

/**
 * Initial Balance: high/low over the first `initialBalanceMinutes` from the
 * first bar of the provided session slice (or from session open clock for RTH).
 */
export function computeInitialBalance(
  sessionBars: OHLCVBar[],
  initialBalanceMinutes: number,
  preset: SessionPreset,
): InitialBalance | null {
  if (!sessionBars.length || initialBalanceMinutes <= 0) {
    return null;
  }

  const ordered = [...sessionBars].sort((a, b) => a.timestamp - b.timestamp);
  const startTimestamp = ordered[0].timestamp;
  const tz = sessionTimeZone(preset);

  let endTimestamp: number;
  if (preset === "rth_us_equities") {
    // IB from 09:30 for N minutes
    const openMins = 9 * 60 + 30;
    const endMins = openMins + initialBalanceMinutes;
    const windowBars = ordered.filter((bar) => {
      const m = minutesFromMidnight(bar.timestamp, tz);
      return m >= openMins && m < endMins;
    });
    if (!windowBars.length) {
      // fall through to time-from-first-bar
      endTimestamp = startTimestamp + initialBalanceMinutes * 60_000;
    } else {
      return summarizeIb(windowBars, startTimestamp);
    }
  } else {
    endTimestamp = startTimestamp + initialBalanceMinutes * 60_000;
  }

  const windowBars = ordered.filter((bar) => bar.timestamp <= endTimestamp);
  if (!windowBars.length) {
    return null;
  }
  return summarizeIb(windowBars, startTimestamp);
}

function summarizeIb(windowBars: OHLCVBar[], startTimestamp: number): InitialBalance {
  let high = -Infinity;
  let low = Infinity;
  for (const bar of windowBars) {
    high = Math.max(high, bar.high);
    low = Math.min(low, bar.low);
  }
  return {
    startTimestamp,
    endTimestamp: windowBars[windowBars.length - 1].timestamp,
    high,
    low,
    mid: (high + low) / 2,
    barCount: windowBars.length,
  };
}
