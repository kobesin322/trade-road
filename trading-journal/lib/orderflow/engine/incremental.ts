import type {
  OHLCVBar,
  VolumeBin,
  VolumeDistributionModel,
  VolumeProfile,
  VolumeProfileParams,
} from "@/lib/orderflow/types";
import { DEFAULT_VOLUME_PROFILE_PARAMS } from "@/lib/orderflow/types";
import { mapToBins, paintBarVolume } from "@/lib/orderflow/engine/volume-profile";
import { computeValueArea } from "@/lib/orderflow/engine/value-area";
import { detectVolumeNodes } from "@/lib/orderflow/engine/volume-nodes";
import { computeInitialBalance } from "@/lib/orderflow/engine/initial-balance";

/**
 * Mutable running histogram for real-time / append-only updates.
 * Rebuild levels after each append (cheap vs re-scanning all bars for bins).
 */
export class IncrementalVolumeProfile {
  private acc = new Map<number, number>();
  private bars: OHLCVBar[] = [];
  private totalVolume = 0;
  private params: VolumeProfileParams;

  constructor(params: Partial<VolumeProfileParams> = {}) {
    this.params = { ...DEFAULT_VOLUME_PROFILE_PARAMS, ...params };
  }

  get barCount() {
    return this.bars.length;
  }

  reset(params?: Partial<VolumeProfileParams>) {
    if (params) {
      this.params = { ...this.params, ...params };
    }
    this.acc = new Map();
    this.bars = [];
    this.totalVolume = 0;
  }

  rebuild(bars: OHLCVBar[], params?: Partial<VolumeProfileParams>) {
    this.reset(params);
    for (const bar of bars) {
      this.appendBar(bar);
    }
    return this.snapshot("developing");
  }

  appendBar(bar: OHLCVBar) {
    this.bars.push(bar);
    this.totalVolume += Math.max(0, bar.volume);
    paintBarVolume(this.acc, bar, this.params.tickSize, this.params.distribution);
  }

  snapshot(mode: VolumeProfile["mode"] = "developing"): VolumeProfile {
    const bins = mapToBins(this.acc, this.params.tickSize);
    const levels = computeValueArea(bins, this.params.valueAreaPercent, this.params.tickSize);
    const nodes = detectVolumeNodes(
      bins,
      this.params.nodeSigma,
      this.params.nodeMinProminence,
    );
    const initialBalance = computeInitialBalance(
      this.bars,
      this.params.initialBalanceMinutes,
      this.params.sessionPreset,
    );

    return {
      mode,
      bins,
      totalVolume: this.totalVolume,
      startTimestamp: this.bars[0]?.timestamp ?? 0,
      endTimestamp: this.bars.at(-1)?.timestamp ?? 0,
      startIndex: 0,
      endIndex: Math.max(0, this.bars.length - 1),
      tickSize: this.params.tickSize,
      levels,
      nodes,
      initialBalance,
    };
  }
}

export function createIncrementalProfile(
  bars: OHLCVBar[],
  params?: Partial<VolumeProfileParams>,
  distribution?: VolumeDistributionModel,
) {
  const engine = new IncrementalVolumeProfile({
    ...params,
    ...(distribution ? { distribution } : {}),
  });
  return engine.rebuild(bars, params);
}

export type { VolumeBin };
