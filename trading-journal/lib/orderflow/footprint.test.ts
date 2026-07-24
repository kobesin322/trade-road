import { describe, expect, it } from "vitest";

import type { OHLCVBar } from "@/lib/orderflow/types";
import {
  barBuyFraction,
  buildFootprintBar,
  buildFootprintModel,
  buildFootprintSeries,
  buildHeatmapTrails,
  detectTrappedLiquidity,
  footprintVolumeExtents,
  minAdverseDistance,
  scoreBubbleAggression,
  suggestTickSize,
  DEFAULT_FOOTPRINT_PARAMS,
  SENSITIVE_TRAP_PARAMS,
} from "@/lib/orderflow/footprint";

function bar(
  partial: Partial<OHLCVBar> & Pick<OHLCVBar, "timestamp" | "open" | "high" | "low" | "close" | "volume">,
): OHLCVBar {
  return partial;
}

describe("barBuyFraction", () => {
  it("leans buy on strong green bars", () => {
    const b = bar({
      timestamp: 1,
      open: 100,
      high: 101,
      low: 99.9,
      close: 100.9,
      volume: 1000,
    });
    const prev = bar({
      timestamp: 0,
      open: 99,
      high: 100,
      low: 98.5,
      close: 100,
      volume: 800,
    });
    expect(barBuyFraction(b, prev, "close_vs_prev")).toBeGreaterThan(0.55);
  });

  it("leans sell on strong red bars", () => {
    const b = bar({
      timestamp: 1,
      open: 100,
      high: 100.1,
      low: 99,
      close: 99.1,
      volume: 1000,
    });
    const prev = bar({
      timestamp: 0,
      open: 101,
      high: 101.5,
      low: 100,
      close: 100.2,
      volume: 800,
    });
    expect(barBuyFraction(b, prev, "close_vs_prev")).toBeLessThan(0.45);
  });
});

describe("buildFootprintBar", () => {
  it("preserves total volume across cells", () => {
    const b = bar({
      timestamp: 1,
      open: 100,
      high: 101,
      low: 99.5,
      close: 100.5,
      volume: 500,
    });
    const fp = buildFootprintBar(b, 0, undefined, {
      ...DEFAULT_FOOTPRINT_PARAMS,
      tickSize: 0.25,
      bubbleMinShare: 0.2,
      maxBubblesPerBar: 6,
    });
    const sum = fp.cells.reduce((s, c) => s + c.totalVolume, 0);
    expect(sum).toBeCloseTo(500, 6);
    expect(fp.cells.length).toBeGreaterThan(0);
    expect(fp.barDelta).toBeCloseTo(
      fp.cells.reduce((s, c) => s + c.delta, 0),
      6,
    );
    expect(fp.closePosition).toBeGreaterThan(0);
    expect(fp.closePosition).toBeLessThan(1);
  });

  it("emits denser bubbles with tier fields", () => {
    const b = bar({
      timestamp: 1,
      open: 50,
      high: 51,
      low: 49.5,
      close: 50.8,
      volume: 2000,
    });
    const fp = buildFootprintBar(b, 3, undefined, {
      ...DEFAULT_FOOTPRINT_PARAMS,
      tickSize: 0.25,
      deltaMethod: "close_vs_midpoint",
      bubbleMinShare: 0.08,
      maxBubblesPerBar: 12,
    });
    expect(fp.bubbles.length).toBeGreaterThan(0);
    expect(fp.bubbles.length).toBeLessThanOrEqual(12);
    for (const bubble of fp.bubbles) {
      expect(bubble.barIndex).toBe(3);
      expect(bubble.volume).toBeGreaterThan(0);
      expect(["buy", "sell", "mixed"]).toContain(bubble.side);
      expect(["normal", "large", "whale"]).toContain(bubble.tier);
      expect(bubble.aggression).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("heatmap trails + aggression + traps", () => {
  /** Quiet base + real inflection traps (large adverse moves). */
  const bars: OHLCVBar[] = [
    ...Array.from({ length: 8 }, (_, i) =>
      bar({
        timestamp: 1_700_000_000_000 + i * 60_000,
        open: 100 + i * 0.02,
        high: 100.25 + i * 0.02,
        low: 99.85 + i * 0.02,
        close: 100.1 + i * 0.02,
        volume: 280 + i * 5,
      }),
    ),
    // Large buy push into highs, then fails hard (TB)
    bar({
      timestamp: 1_700_000_000_000 + 8 * 60_000,
      open: 100.2,
      high: 102.0,
      low: 100.1,
      close: 100.35,
      volume: 4200,
    }),
    bar({
      timestamp: 1_700_000_000_000 + 9 * 60_000,
      open: 100.35,
      high: 100.4,
      low: 99.0,
      close: 99.2,
      volume: 1100,
    }),
    // Large sell push into lows, then reclaimed (TS)
    bar({
      timestamp: 1_700_000_000_000 + 10 * 60_000,
      open: 99.2,
      high: 99.3,
      low: 97.5,
      close: 97.7,
      volume: 4000,
    }),
    bar({
      timestamp: 1_700_000_000_000 + 11 * 60_000,
      open: 97.7,
      high: 99.6,
      low: 97.6,
      close: 99.4,
      volume: 1300,
    }),
  ];

  /** Downtrend with only micro-bounces after sells — should not flood strict TS. */
  const noisyDowntrend: OHLCVBar[] = Array.from({ length: 20 }, (_, i) => {
    const base = 110 - i * 0.35;
    const isSellLeg = i % 2 === 0;
    return bar({
      timestamp: 1_700_000_100_000 + i * 60_000,
      open: base,
      high: base + (isSellLeg ? 0.12 : 0.35),
      low: base - (isSellLeg ? 0.45 : 0.1),
      close: isSellLeg ? base - 0.35 : base + 0.2,
      volume: isSellLeg ? 900 + i * 10 : 500 + i * 5,
    });
  });

  it("builds residual heat trails denser than bar count", () => {
    const series = buildFootprintSeries(bars, { tickSize: 0.1 });
    const { heatmap, maxHeat } = buildHeatmapTrails(series, {
      ...DEFAULT_FOOTPRINT_PARAMS,
      tickSize: 0.1,
      heatDecay: 0.92,
      heatMinShare: 0.04,
    });
    expect(maxHeat).toBeGreaterThan(0);
    expect(heatmap.length).toBeGreaterThan(series.length);
    const late = heatmap.filter((p) => p.barIndex === series.length - 1);
    expect(late.length).toBeGreaterThan(0);
  });

  it("scores whale / large tiers on high-volume prints", () => {
    const series = buildFootprintSeries(bars, {
      tickSize: 0.1,
      bubbleMinShare: 0.05,
      maxBubblesPerBar: 14,
    });
    scoreBubbleAggression(series);
    const tiers = new Set(series.flatMap((b) => b.bubbles.map((x) => x.tier)));
    expect(tiers.has("large") || tiers.has("whale")).toBe(true);
    const maxAggr = Math.max(...series.flatMap((b) => b.bubbles.map((x) => x.aggression)), 0);
    expect(maxAggr).toBeGreaterThan(0.5);
  });

  it("detects quality TB/TS on large failed pushes with structure", () => {
    const series = buildFootprintSeries(bars, { tickSize: 0.1 });
    const traps = detectTrappedLiquidity(series, bars, {
      ...DEFAULT_FOOTPRINT_PARAMS,
      tickSize: 0.1,
    });
    expect(traps.length).toBeGreaterThan(0);
    const sides = new Set(traps.map((t) => t.side));
    expect(sides.has("buy") || sides.has("sell")).toBe(true);
    for (const t of traps) {
      expect(t.strength).toBeGreaterThanOrEqual(DEFAULT_FOOTPRINT_PARAMS.trapMinStrength);
      expect(t.adverseMove).toBeGreaterThan(0);
      expect(t.confirm).toBeTruthy();
      expect(t.reason.length).toBeGreaterThan(0);
    }
  });

  it("strict mode marks fewer traps than sensitive on a noisy downtrend", () => {
    const series = buildFootprintSeries(noisyDowntrend, { tickSize: 0.05 });
    const strict = detectTrappedLiquidity(series, noisyDowntrend, {
      ...DEFAULT_FOOTPRINT_PARAMS,
      tickSize: 0.05,
    });
    const sensitive = detectTrappedLiquidity(series, noisyDowntrend, {
      ...DEFAULT_FOOTPRINT_PARAMS,
      tickSize: 0.05,
      ...SENSITIVE_TRAP_PARAMS,
    });
    expect(sensitive.length).toBeGreaterThanOrEqual(strict.length);
    // Strict should not carpet-bomb every micro-bounce
    expect(strict.length).toBeLessThanOrEqual(Math.max(6, Math.floor(noisyDowntrend.length / 3)));
  });

  it("minAdverseDistance uses the larger of percent and ticks", () => {
    const d = minAdverseDistance(330, 0.05, {
      trapMinAdversePercent: 0.18,
      trapMinAdverseTicks: 4,
    });
    // 0.18% of 330 ≈ 0.594; 4 ticks × 0.05 = 0.2 → percent wins
    expect(d).toBeCloseTo(330 * 0.0018, 5);
  });

  it("buildFootprintModel wires series, heatmap, and traps", () => {
    const model = buildFootprintModel(bars, { tickSize: 0.1 });
    expect(model.series).toHaveLength(bars.length);
    expect(model.heatmap.length).toBeGreaterThan(0);
    expect(model.maxHeat).toBeGreaterThan(0);
    expect(model.maxAggression).toBeGreaterThan(0);
    const extents = footprintVolumeExtents(model.series);
    expect(extents.maxBubbleVolume).toBeGreaterThan(0);
  });
});

describe("suggestTickSize", () => {
  it("returns coarser ticks for high-priced instruments", () => {
    const nqish: OHLCVBar[] = [
      bar({
        timestamp: 1,
        open: 21000,
        high: 21020,
        low: 20980,
        close: 21010,
        volume: 100,
      }),
    ];
    expect(suggestTickSize(nqish)).toBeGreaterThanOrEqual(0.25);
  });

  it("returns finer ticks for low-priced instruments", () => {
    const penny: OHLCVBar[] = [
      bar({
        timestamp: 1,
        open: 0.42,
        high: 0.45,
        low: 0.4,
        close: 0.43,
        volume: 50_000,
      }),
    ];
    expect(suggestTickSize(penny)).toBeLessThan(0.05);
  });
});
