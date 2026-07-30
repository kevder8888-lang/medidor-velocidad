import { formatCoords, type DeviceGeo } from "./geo";
import { formatMbps, formatMs } from "./stats";
import type { ResultGeo, SpeedTestResult, UserPlan } from "./types";

export function deviceGeoToResultGeo(g: DeviceGeo): ResultGeo {
  return {
    latitude: g.latitude,
    longitude: g.longitude,
    accuracyM: g.accuracyM,
    altitudeM: g.altitudeM,
    timestamp: g.timestamp || new Date().toISOString(),
    source: g.source,
  };
}

/** Snapshot legible de una medición para historial / exports */
export function summarizeMeasurement(r: SpeedTestResult): {
  time: string;
  operator: string;
  downMbps: number;
  upMbps: number;
  latencyMs: number;
  coords: string | null;
  accuracy: string | null;
  access: string;
  cvm: string | null;
} {
  const time = r.finishedAt
    ? new Date(r.finishedAt).toLocaleString("es-PE")
    : "—";
  const operator =
    r.plan?.operator?.trim() ||
    r.networkIdentity?.isp.brand ||
    r.networkIdentity?.isp.displayName ||
    r.serverMeta?.asOrganization ||
    "—";
  const coords =
    r.geo?.latitude != null && r.geo?.longitude != null
      ? formatCoords(r.geo.latitude, r.geo.longitude)
      : null;
  const accuracy =
    r.geo?.accuracyM != null ? `±${Math.round(r.geo.accuracyM)} m` : null;

  return {
    time,
    operator,
    downMbps: r.download?.medianMbps ?? 0,
    upMbps: r.upload?.medianMbps ?? 0,
    latencyMs: r.latency?.medianMs ?? 0,
    coords,
    accuracy,
    access: r.networkIdentity?.accessLabel || r.precheck?.connectionType || "—",
    cvm: r.cvm ? `${r.cvm.cvmPct}%` : null,
  };
}

export function formatSummaryLine(r: SpeedTestResult): string {
  const s = summarizeMeasurement(r);
  return [
    s.time,
    s.operator,
    `↓${formatMbps(s.downMbps)}`,
    `↑${formatMbps(s.upMbps)}`,
    `${formatMs(s.latencyMs)} ms`,
    s.coords ? `@ ${s.coords}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Asegura plan con operador detectado al guardar */
export function withResolvedPlan(
  result: SpeedTestResult,
  plan: UserPlan
): UserPlan {
  const op =
    plan.operator?.trim() ||
    result.networkIdentity?.isp.brand ||
    result.networkIdentity?.isp.displayName ||
    plan.operator ||
    "";
  return {
    ...plan,
    ...result.plan,
    downMbps: plan.downMbps || result.plan?.downMbps || 0,
    upMbps: plan.upMbps ?? result.plan?.upMbps ?? null,
    operator: op,
    technology: plan.technology || result.plan?.technology || "",
  };
}
