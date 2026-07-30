/** Robust stats helpers for measurement samples */

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, (p / 100) * (s.length - 1)));
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return s[lo];
  const w = idx - lo;
  return s[lo] * (1 - w) + s[hi] * w;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const v = values.reduce((acc, x) => acc + (x - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

/** Mean absolute successive difference (jitter estimate) */
export function successiveJitter(values: number[]): number {
  if (values.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < values.length; i++) {
    sum += Math.abs(values[i] - values[i - 1]);
  }
  return sum / (values.length - 1);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function formatMbps(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 100) return n.toFixed(0);
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function formatMs(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 10) return n.toFixed(1);
  return n.toFixed(0);
}

export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
