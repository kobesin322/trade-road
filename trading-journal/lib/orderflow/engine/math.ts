export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function stdDev(values: number[]) {
  if (values.length < 2) {
    return 0;
  }
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Snap price down to bin edge for a positive tick size. */
export function binFloor(price: number, tickSize: number) {
  if (tickSize <= 0 || !Number.isFinite(tickSize)) {
    throw new Error("tickSize must be a positive finite number");
  }
  return Math.floor(price / tickSize + 1e-12) * tickSize;
}

export function roundPrice(price: number, tickSize: number) {
  const decimals = Math.max(0, Math.ceil(-Math.log10(tickSize)) + 2);
  const factor = 10 ** Math.min(decimals, 12);
  return Math.round(price * factor) / factor;
}
