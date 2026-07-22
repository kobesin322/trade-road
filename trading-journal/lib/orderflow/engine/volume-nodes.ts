import type { VolumeBin, VolumeNode } from "@/lib/orderflow/types";
import { average, stdDev } from "@/lib/orderflow/engine/math";

/**
 * HVN = local maxima above mean + sigma*std (or prominence).
 * LVN = local minima below mean - sigma*std between structure.
 */
export function detectVolumeNodes(
  bins: VolumeBin[],
  nodeSigma = 0.75,
  nodeMinProminence = 0.08,
): VolumeNode[] {
  if (bins.length < 3) {
    return [];
  }

  const volumes = bins.map((b) => b.volume);
  const mean = average(volumes);
  const sd = stdDev(volumes);
  const maxVol = Math.max(...volumes, Number.EPSILON);
  const hvnFloor = mean + nodeSigma * sd;
  const lvnCeil = Math.max(0, mean - nodeSigma * sd);
  const minProm = nodeMinProminence * maxVol;

  const nodes: VolumeNode[] = [];

  for (let i = 1; i < bins.length - 1; i += 1) {
    const prev = bins[i - 1].volume;
    const curr = bins[i].volume;
    const next = bins[i + 1].volume;

    const isLocalMax = (curr > prev && curr >= next) || (curr >= prev && curr > next);
    const isLocalMin = (curr < prev && curr <= next) || (curr <= prev && curr < next);

    if (isLocalMax && curr >= hvnFloor && curr - Math.min(prev, next) >= minProm * 0.25) {
      nodes.push({ price: bins[i].mid, volume: curr, kind: "hvn" });
    } else if (isLocalMin && curr <= lvnCeil && Math.max(prev, next) - curr >= minProm * 0.25) {
      nodes.push({ price: bins[i].mid, volume: curr, kind: "lvn" });
    }
  }

  // Fallback: if no HVN by sigma, take strongest local max
  if (!nodes.some((n) => n.kind === "hvn")) {
    let best = 1;
    for (let i = 1; i < bins.length - 1; i += 1) {
      if (bins[i].volume > bins[best].volume) {
        best = i;
      }
    }
    if (bins[best].volume > 0) {
      nodes.push({
        price: bins[best].mid,
        volume: bins[best].volume,
        kind: "hvn",
      });
    }
  }

  return nodes.sort((a, b) => b.volume - a.volume);
}
