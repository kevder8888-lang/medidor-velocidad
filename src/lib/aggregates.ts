import { mean, median, round } from "./stats";
import type { AggregateStats, SpeedTestResult } from "./types";

export function computeAggregates(history: SpeedTestResult[]): AggregateStats {
  if (!history.length) {
    return {
      totalTests: 0,
      validCvmTests: 0,
      cvmPassCount: 0,
      cvmFailCount: 0,
      cvmPassRatePct: null,
      avgDownMbps: null,
      avgUpMbps: null,
      avgLatencyMs: null,
      avgConfidence: null,
      medianDownMbps: null,
      lastTestAt: null,
      byOperator: [],
      byDay: [],
      recentTrend: "n/a",
    };
  }

  const downs = history.map((h) => h.download?.medianMbps ?? 0);
  const ups = history.map((h) => h.upload?.medianMbps ?? 0);
  const lats = history.map((h) => h.latency?.medianMs ?? 0);
  const confs = history.map((h) => h.confidence?.score ?? 0);

  const valid = history.filter(
    (h) => h.confidence?.validForRegulatoryCvm && h.cvm != null
  );
  const pass = valid.filter((h) => h.cvm!.meetsCvm);
  const fail = valid.filter((h) => !h.cvm!.meetsCvm);

  // by operator
  const opMap = new Map<
    string,
    { downs: number[]; pass: number; valid: number }
  >();
  for (const h of history) {
    const op = (h.plan?.operator || "Sin operador").trim() || "Sin operador";
    const row = opMap.get(op) ?? { downs: [], pass: 0, valid: 0 };
    row.downs.push(h.download?.medianMbps ?? 0);
    if (h.confidence?.validForRegulatoryCvm && h.cvm) {
      row.valid += 1;
      if (h.cvm.meetsCvm) row.pass += 1;
    }
    opMap.set(op, row);
  }
  const byOperator = [...opMap.entries()]
    .map(([operator, v]) => ({
      operator,
      count: v.downs.length,
      passRate: v.valid ? round((v.pass / v.valid) * 100, 1) : null,
      avgDown: round(mean(v.downs), 2),
    }))
    .sort((a, b) => b.count - a.count);

  // by day
  const dayMap = new Map<
    string,
    { downs: number[]; pass: number; valid: number }
  >();
  for (const h of history) {
    const day = h.finishedAt.slice(0, 10);
    const row = dayMap.get(day) ?? { downs: [], pass: 0, valid: 0 };
    row.downs.push(h.download?.medianMbps ?? 0);
    if (h.confidence?.validForRegulatoryCvm && h.cvm) {
      row.valid += 1;
      if (h.cvm.meetsCvm) row.pass += 1;
    }
    dayMap.set(day, row);
  }
  const byDay = [...dayMap.entries()]
    .map(([day, v]) => ({
      day,
      count: v.downs.length,
      avgDown: round(mean(v.downs), 2),
      cvmPassRate: v.valid ? round((v.pass / v.valid) * 100, 1) : null,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  // recent trend: compare avg of last 3 vs previous 3
  let recentTrend: AggregateStats["recentTrend"] = "n/a";
  if (history.length >= 4) {
    const sorted = [...history].sort((a, b) =>
      a.finishedAt.localeCompare(b.finishedAt)
    );
    const last = sorted.slice(-3).map((h) => h.download?.medianMbps ?? 0);
    const prev = sorted.slice(-6, -3).map((h) => h.download?.medianMbps ?? 0);
    if (prev.length) {
      const d = mean(last) - mean(prev);
      const base = mean(prev) || 1;
      if (d / base > 0.08) recentTrend = "up";
      else if (d / base < -0.08) recentTrend = "down";
      else recentTrend = "stable";
    }
  }

  return {
    totalTests: history.length,
    validCvmTests: valid.length,
    cvmPassCount: pass.length,
    cvmFailCount: fail.length,
    cvmPassRatePct: valid.length
      ? round((pass.length / valid.length) * 100, 1)
      : null,
    avgDownMbps: round(mean(downs), 2),
    avgUpMbps: round(mean(ups), 2),
    avgLatencyMs: round(mean(lats), 1),
    avgConfidence: round(mean(confs), 1),
    medianDownMbps: round(median(downs), 2),
    lastTestAt: [...history].sort((a, b) =>
      b.finishedAt.localeCompare(a.finishedAt)
    )[0].finishedAt,
    byOperator,
    byDay,
    recentTrend,
  };
}
