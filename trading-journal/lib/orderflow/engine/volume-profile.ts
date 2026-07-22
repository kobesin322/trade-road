import type {
  OHLCVBar,
  ProfileMode,
  SessionPreset,
  VolumeBin,
  VolumeDistributionModel,
  VolumeProfile,
  VolumeProfileParams,
} from "@/lib/orderflow/types";
import { DEFAULT_VOLUME_PROFILE_PARAMS } from "@/lib/orderflow/types";
import { binFloor, roundPrice } from "@/lib/orderflow/engine/math";
import { computeValueArea } from "@/lib/orderflow/engine/value-area";
import { detectVolumeNodes } from "@/lib/orderflow/engine/volume-nodes";
import { computeInitialBalance } from "@/lib/orderflow/engine/initial-balance";
import {
  filterBarsForSession,
  listSessionKeys,
  sessionKeyForBar,
} from "@/lib/orderflow/engine/sessions";

function emptyProfile(
  mode: ProfileMode,
  tickSize: number,
  startIndex = 0,
  endIndex = -1,
): VolumeProfile {
  return {
    mode,
    bins: [],
    totalVolume: 0,
    startTimestamp: 0,
    endTimestamp: 0,
    startIndex,
    endIndex,
    tickSize,
    levels: null,
    nodes: [],
    initialBalance: null,
  };
}

/**
 * Distribute one bar's volume into a Map keyed by bin floor price.
 */
export function paintBarVolume(
  acc: Map<number, number>,
  bar: OHLCVBar,
  tickSize: number,
  distribution: VolumeDistributionModel,
) {
  if (bar.volume <= 0 || !Number.isFinite(bar.volume)) {
    return;
  }

  const low = Math.min(bar.low, bar.high);
  const high = Math.max(bar.low, bar.high);
  let start = binFloor(low, tickSize);
  const end = binFloor(high, tickSize);

  if (start > end) {
    return;
  }

  if (distribution === "close_weighted") {
    // 50% to close bin, 50% uniform across range
    const closeBin = binFloor(bar.close, tickSize);
    const half = bar.volume * 0.5;
    acc.set(closeBin, (acc.get(closeBin) ?? 0) + half);

    const keys: number[] = [];
    for (let p = start; p <= end + tickSize * 0.5; p = roundPrice(p + tickSize, tickSize)) {
      keys.push(p);
      if (p >= end) {
        break;
      }
    }
    if (!keys.length) {
      keys.push(start);
    }
    const share = half / keys.length;
    for (const key of keys) {
      acc.set(key, (acc.get(key) ?? 0) + share);
    }
    return;
  }

  // uniform
  const keys: number[] = [];
  for (let p = start; p <= end + tickSize * 0.5; p = roundPrice(p + tickSize, tickSize)) {
    keys.push(p);
    if (p >= end) {
      break;
    }
  }
  if (!keys.length) {
    keys.push(start);
  }
  const share = bar.volume / keys.length;
  for (const key of keys) {
    acc.set(key, (acc.get(key) ?? 0) + share);
  }
}

export function mapToBins(acc: Map<number, number>, tickSize: number): VolumeBin[] {
  return Array.from(acc.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([price, volume]) => ({
      price,
      mid: roundPrice(price + tickSize / 2, tickSize),
      volume,
    }));
}

export function buildHistogramFromBars(
  bars: OHLCVBar[],
  tickSize: number,
  distribution: VolumeDistributionModel,
): { bins: VolumeBin[]; totalVolume: number } {
  const acc = new Map<number, number>();
  let totalVolume = 0;
  for (const bar of bars) {
    totalVolume += Math.max(0, bar.volume);
    paintBarVolume(acc, bar, tickSize, distribution);
  }
  return { bins: mapToBins(acc, tickSize), totalVolume };
}

function finalizeProfile(
  bars: OHLCVBar[],
  slice: OHLCVBar[],
  mode: ProfileMode,
  params: VolumeProfileParams,
  startIndex: number,
  endIndex: number,
  sessionKey?: string,
  sessionKeys?: string[],
): VolumeProfile {
  if (!slice.length) {
    return emptyProfile(mode, params.tickSize, startIndex, endIndex);
  }

  const { bins, totalVolume } = buildHistogramFromBars(
    slice,
    params.tickSize,
    params.distribution,
  );
  const levels = computeValueArea(bins, params.valueAreaPercent, params.tickSize);
  const nodes = detectVolumeNodes(bins, params.nodeSigma, params.nodeMinProminence);
  const initialBalance = computeInitialBalance(
    slice,
    params.initialBalanceMinutes,
    params.sessionPreset,
  );

  return {
    mode,
    bins,
    totalVolume,
    startTimestamp: slice[0].timestamp,
    endTimestamp: slice[slice.length - 1].timestamp,
    startIndex,
    endIndex,
    tickSize: params.tickSize,
    levels,
    nodes,
    initialBalance,
    sessionKey,
    sessionKeys,
  };
}

export function buildFixedRangeProfile(
  bars: OHLCVBar[],
  startIndex: number,
  endIndex: number,
  params: Partial<VolumeProfileParams> = {},
): VolumeProfile {
  const merged = { ...DEFAULT_VOLUME_PROFILE_PARAMS, ...params };
  if (!bars.length) {
    return emptyProfile("fixed_range", merged.tickSize);
  }
  const lo = Math.max(0, Math.min(startIndex, endIndex));
  const hi = Math.min(bars.length - 1, Math.max(startIndex, endIndex));
  const slice = bars.slice(lo, hi + 1);
  return finalizeProfile(bars, slice, "fixed_range", merged, lo, hi);
}

export function buildDevelopingProfile(
  bars: OHLCVBar[],
  params: Partial<VolumeProfileParams> = {},
): VolumeProfile {
  const merged = { ...DEFAULT_VOLUME_PROFILE_PARAMS, ...params };
  if (!bars.length) {
    return emptyProfile("developing", merged.tickSize);
  }
  const last = bars[bars.length - 1];
  const key = sessionKeyForBar(last.timestamp, merged.sessionPreset);
  const sessionBars = filterBarsForSession(bars, key, merged.sessionPreset);
  // indices relative to full array
  const indexSet = new Set(sessionBars.map((b) => b.timestamp));
  let startIndex = bars.findIndex((b) => indexSet.has(b.timestamp));
  let endIndex = bars.length - 1;
  for (let i = bars.length - 1; i >= 0; i -= 1) {
    if (indexSet.has(bars[i].timestamp)) {
      endIndex = i;
      break;
    }
  }
  if (startIndex < 0) {
    startIndex = 0;
  }
  return finalizeProfile(
    bars,
    sessionBars.length ? sessionBars : bars,
    "developing",
    merged,
    startIndex,
    endIndex,
    key,
  );
}

export function buildSessionProfile(
  bars: OHLCVBar[],
  sessionKey: string,
  params: Partial<VolumeProfileParams> = {},
): VolumeProfile {
  const merged = { ...DEFAULT_VOLUME_PROFILE_PARAMS, ...params };
  const sessionBars = filterBarsForSession(bars, sessionKey, merged.sessionPreset);
  if (!sessionBars.length) {
    return emptyProfile("session", merged.tickSize);
  }
  const ts0 = sessionBars[0].timestamp;
  const ts1 = sessionBars[sessionBars.length - 1].timestamp;
  const startIndex = bars.findIndex((b) => b.timestamp === ts0);
  let endIndex = bars.length - 1;
  for (let i = bars.length - 1; i >= 0; i -= 1) {
    if (bars[i].timestamp === ts1) {
      endIndex = i;
      break;
    }
  }
  return finalizeProfile(
    bars,
    sessionBars,
    "session",
    merged,
    Math.max(0, startIndex),
    endIndex,
    sessionKey,
  );
}

export function buildCompositeProfile(
  bars: OHLCVBar[],
  params: Partial<VolumeProfileParams> = {},
  sessionKeys?: string[],
): VolumeProfile {
  const merged = { ...DEFAULT_VOLUME_PROFILE_PARAMS, ...params };
  const keys = sessionKeys?.length
    ? sessionKeys
    : listSessionKeys(bars, merged.sessionPreset);
  if (!keys.length || !bars.length) {
    return emptyProfile("composite", merged.tickSize);
  }

  const acc = new Map<number, number>();
  let totalVolume = 0;
  let startTs = Infinity;
  let endTs = -Infinity;
  let startIndex = bars.length;
  let endIndex = 0;

  for (const key of keys) {
    const sessionBars = filterBarsForSession(bars, key, merged.sessionPreset);
    for (const bar of sessionBars) {
      totalVolume += Math.max(0, bar.volume);
      paintBarVolume(acc, bar, merged.tickSize, merged.distribution);
      startTs = Math.min(startTs, bar.timestamp);
      endTs = Math.max(endTs, bar.timestamp);
    }
  }

  for (let i = 0; i < bars.length; i += 1) {
    const key = sessionKeyForBar(bars[i].timestamp, merged.sessionPreset);
    if (keys.includes(key)) {
      startIndex = Math.min(startIndex, i);
      endIndex = Math.max(endIndex, i);
    }
  }

  const bins = mapToBins(acc, merged.tickSize);
  const levels = computeValueArea(bins, merged.valueAreaPercent, merged.tickSize);
  const nodes = detectVolumeNodes(bins, merged.nodeSigma, merged.nodeMinProminence);

  // IB from earliest session only
  const firstKey = keys[0];
  const firstSession = filterBarsForSession(bars, firstKey, merged.sessionPreset);
  const initialBalance = computeInitialBalance(
    firstSession,
    merged.initialBalanceMinutes,
    merged.sessionPreset,
  );

  return {
    mode: "composite",
    bins,
    totalVolume,
    startTimestamp: Number.isFinite(startTs) ? startTs : 0,
    endTimestamp: Number.isFinite(endTs) ? endTs : 0,
    startIndex: startIndex === bars.length ? 0 : startIndex,
    endIndex,
    tickSize: merged.tickSize,
    levels,
    nodes,
    initialBalance,
    sessionKeys: keys,
  };
}

export function buildProfile(
  bars: OHLCVBar[],
  mode: ProfileMode,
  params: Partial<VolumeProfileParams> = {},
  options?: {
    startIndex?: number;
    endIndex?: number;
    sessionKey?: string;
    sessionKeys?: string[];
  },
): VolumeProfile {
  switch (mode) {
    case "fixed_range":
      return buildFixedRangeProfile(
        bars,
        options?.startIndex ?? 0,
        options?.endIndex ?? Math.max(0, bars.length - 1),
        params,
      );
    case "session":
      return buildSessionProfile(
        bars,
        options?.sessionKey ??
          (bars.length
            ? sessionKeyForBar(
                bars[bars.length - 1].timestamp,
                { ...DEFAULT_VOLUME_PROFILE_PARAMS, ...params }.sessionPreset,
              )
            : ""),
        params,
      );
    case "composite":
      return buildCompositeProfile(bars, params, options?.sessionKeys);
    case "developing":
    default:
      return buildDevelopingProfile(bars, params);
  }
}

export type { SessionPreset };
