export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function interp1D(x: number, x1: number, y1: number, x2: number, y2: number) {
  if (x2 === x1) return y1;
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

export function round1(v: number) {
  return Math.round(v * 10) / 10;
}
