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
  // Prioridad: red detectada (ASN/org) > plan declarado
  // Evita mostrar "Claro" del plan viejo cuando la medición fue en Entel
  const operator =
    r.networkIdentity?.isp.brand ||
    r.networkIdentity?.isp.displayName ||
    r.serverMeta?.asOrganization ||
    r.plan?.operator?.trim() ||
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

/**
 * Plan guardado con la medición.
 * El campo operator refleja la red detectada si hay marca confiable;
 * si no, el valor que el usuario puso en el formulario.
 */
export function withResolvedPlan(
  result: SpeedTestResult,
  plan: UserPlan
): UserPlan {
  const detected =
    result.networkIdentity?.isp.brand ||
    result.networkIdentity?.isp.displayName ||
    null;
  const conf = result.networkIdentity?.isp.confidence;
  // Si la detección es alta/media, el registro usa el operador de RED actual
  const op =
    detected && conf !== "baja"
      ? detected
      : plan.operator?.trim() ||
        detected ||
        result.plan?.operator ||
        "";
  return {
    ...emptyishPlan(),
    ...result.plan,
    ...plan,
    serviceMode: plan.serviceMode || result.plan?.serviceMode || "fixed",
    downMbps: plan.downMbps || result.plan?.downMbps || 0,
    upMbps: plan.upMbps ?? result.plan?.upMbps ?? null,
    operator: op,
    technology: plan.technology || result.plan?.technology || "",
    radioTech: plan.radioTech || result.plan?.radioTech || "4g",
    mobileDownMbps:
      plan.mobileDownMbps || result.plan?.mobileDownMbps || plan.downMbps || 0,
    mobileUpMbps: plan.mobileUpMbps ?? result.plan?.mobileUpMbps ?? null,
  };
}

function emptyishPlan(): UserPlan {
  return {
    serviceMode: "fixed",
    downMbps: 0,
    upMbps: null,
    operator: "",
    technology: "",
    radioTech: "4g",
    mobileDownMbps: 15,
    mobileUpMbps: 5,
  };
}
