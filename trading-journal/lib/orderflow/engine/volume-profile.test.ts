import { describe, expect, it } from "vitest";

import type { OHLCVBar } from "@/lib/orderflow/types";
import {
  buildCompositeProfile,
  buildDevelopingProfile,
  buildFixedRangeProfile,
  buildHistogramFromBars,
  IncrementalVolumeProfile,
} from "@/lib/orderflow/engine";
import { computeValueArea } from "@/lib/orderflow/engine/value-area";
import { computeInitialBalance } from "@/lib/orderflow/engine/initial-balance";

function bar(
  partial: Partial<OHLCVBar> & Pick<OHLCVBar, "timestamp" | "open" | "high" | "low" | "close" | "volume">,
): OHLCVBar {
  return partial;
}

describe("volume profile histogram", () => {
  it("distributes volume uniformly across bins in range", () => {
    const bars: OHLCVBar[] = [
      bar({
        timestamp: 1,
        open: 100,
        high: 100.5,
        low: 100,
        close: 100.25,
        volume: 100,
      }),
    ];
    const { bins, totalVolume } = buildHistogramFromBars(bars, 0.25, "uniform");
    expect(totalVolume).toBe(100);
    const sumBins = bins.reduce((s, b) => s + b.volume, 0);
    expect(sumBins).toBeCloseTo(100, 8);
    expect(bins.length).toBeGreaterThanOrEqual(2);
  });

  it("computes POC and value area covering target percent", () => {
    const bins = [
      { price: 10, mid: 10.125, volume: 10 },
      { price: 10.25, mid: 10.375, volume: 50 },
      { price: 10.5, mid: 10.625, volume: 20 },
      { price: 10.75, mid: 10.875, volume: 20 },
    ];
    const levels = computeValueArea(bins, 0.7, 0.25);
    expect(levels).not.toBeNull();
    expect(levels!.poc).toBe(10.375);
    expect(levels!.val).toBeLessThanOrEqual(levels!.poc);
    expect(levels!.vah).toBeGreaterThanOrEqual(levels!.poc);
    expect(levels!.valueAreaVolume / 100).toBeGreaterThanOrEqual(0.7 - 1e-9);
  });
});

describe("fixed / developing / composite", () => {
  const day = Date.UTC(2026, 0, 15, 15, 0, 0); // ~10:00 NY winter
  const bars: OHLCVBar[] = Array.from({ length: 20 }, (_, i) =>
    bar({
      timestamp: day + i * 15 * 60_000,
      open: 100 + i * 0.1,
      high: 100.5 + i * 0.1,
      low: 99.75 + i * 0.1,
      close: 100.2 + i * 0.1,
      volume: 50 + i,
    }),
  );

  it("builds fixed range profile for a slice", () => {
    const profile = buildFixedRangeProfile(bars, 0, 9, {
      tickSize: 0.25,
      valueAreaPercent: 0.7,
      sessionPreset: "utc_day",
    });
    expect(profile.mode).toBe("fixed_range");
    expect(profile.bins.length).toBeGreaterThan(0);
    expect(profile.levels).not.toBeNull();
    expect(profile.totalVolume).toBeGreaterThan(0);
  });

  it("builds developing profile for last session", () => {
    const profile = buildDevelopingProfile(bars, {
      tickSize: 0.25,
      sessionPreset: "utc_day",
    });
    expect(profile.mode).toBe("developing");
    expect(profile.totalVolume).toBeGreaterThan(0);
  });

  it("composite merges volume across bars", () => {
    const profile = buildCompositeProfile(bars, {
      tickSize: 0.25,
      sessionPreset: "utc_day",
    });
    expect(profile.mode).toBe("composite");
    const sum = profile.bins.reduce((s, b) => s + b.volume, 0);
    expect(sum).toBeCloseTo(profile.totalVolume, 5);
  });
});

describe("initial balance", () => {
  it("captures high/low of early window", () => {
    const start = Date.UTC(2026, 0, 15, 14, 30, 0);
    const bars: OHLCVBar[] = [
      bar({ timestamp: start, open: 100, high: 101, low: 99, close: 100, volume: 10 }),
      bar({
        timestamp: start + 30 * 60_000,
        open: 100,
        high: 102,
        low: 98.5,
        close: 101,
        volume: 10,
      }),
      bar({
        timestamp: start + 90 * 60_000,
        open: 101,
        high: 110,
        low: 90,
        close: 105,
        volume: 10,
      }),
    ];
    const ib = computeInitialBalance(bars, 60, "utc_day");
    expect(ib).not.toBeNull();
    expect(ib!.high).toBe(102);
    expect(ib!.low).toBe(98.5);
    expect(ib!.barCount).toBe(2);
  });
});

describe("incremental profile", () => {
  it("matches full rebuild totals", () => {
    const bars: OHLCVBar[] = Array.from({ length: 30 }, (_, i) =>
      bar({
        timestamp: 1_000_000 + i * 60_000,
        open: 50 + i * 0.05,
        high: 50.5 + i * 0.05,
        low: 49.8 + i * 0.05,
        close: 50.1 + i * 0.05,
        volume: 20,
      }),
    );
    const full = buildFixedRangeProfile(bars, 0, bars.length - 1, { tickSize: 0.1 });
    const inc = new IncrementalVolumeProfile({ tickSize: 0.1 });
    const snap = inc.rebuild(bars);
    expect(snap.totalVolume).toBeCloseTo(full.totalVolume, 6);
    expect(snap.bins.length).toBe(full.bins.length);
  });
});
