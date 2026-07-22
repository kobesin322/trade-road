import type { VolumeBin, VolumeProfileLevels } from "@/lib/orderflow/types";

/**
 * POC = highest-volume bin mid. Tie-break: closest to range mid, then higher price.
 * Value area expands from POC until cumulative volume >= valueAreaPercent * total.
 */
export function computeValueArea(
  bins: VolumeBin[],
  valueAreaPercent: number,
  tickSize = 0,
): VolumeProfileLevels | null {
  if (!bins.length) {
    return null;
  }

  const totalVolume = bins.reduce((sum, bin) => sum + bin.volume, 0);
  if (totalVolume <= 0) {
    return null;
  }

  const targetRatio = Math.min(1, Math.max(0.01, valueAreaPercent));
  const targetVolume = totalVolume * targetRatio;
  const step =
    tickSize > 0
      ? tickSize
      : bins.length > 1
        ? Math.abs(bins[1].price - bins[0].price) || 0
        : 0;

  const rangeMid =
    (bins[0].mid + bins[bins.length - 1].mid) / 2;

  let pocIndex = 0;
  for (let i = 1; i < bins.length; i += 1) {
    const current = bins[i];
    const best = bins[pocIndex];
    if (current.volume > best.volume) {
      pocIndex = i;
      continue;
    }
    if (current.volume < best.volume) {
      continue;
    }
    const currentDist = Math.abs(current.mid - rangeMid);
    const bestDist = Math.abs(best.mid - rangeMid);
    if (currentDist < bestDist || (currentDist === bestDist && current.mid > best.mid)) {
      pocIndex = i;
    }
  }

  let low = pocIndex;
  let high = pocIndex;
  let covered = bins[pocIndex].volume;

  while (covered < targetVolume && (low > 0 || high < bins.length - 1)) {
    const canLow = low > 0;
    const canHigh = high < bins.length - 1;
    const lowVol = canLow ? bins[low - 1].volume : -1;
    const highVol = canHigh ? bins[high + 1].volume : -1;

    if (canLow && canHigh) {
      if (lowVol > highVol) {
        low -= 1;
        covered += bins[low].volume;
      } else if (highVol > lowVol) {
        high += 1;
        covered += bins[high].volume;
      } else {
        // Equal: expand both if both needed, prefer higher price side first then lower
        high += 1;
        covered += bins[high].volume;
        if (covered < targetVolume && low > 0) {
          low -= 1;
          covered += bins[low].volume;
        }
      }
    } else if (canHigh) {
      high += 1;
      covered += bins[high].volume;
    } else if (canLow) {
      low -= 1;
      covered += bins[low].volume;
    } else {
      break;
    }
  }

  const highEdge =
    step > 0 ? bins[high].price + step : bins[high].mid + (bins[high].mid - bins[high].price);

  return {
    poc: bins[pocIndex].mid,
    val: bins[low].price,
    vah: highEdge,
    valueAreaPercent: targetRatio,
    valueAreaVolume: covered,
  };
}
