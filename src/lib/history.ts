import type {
  ConfidenceResult,
  LatencyResult,
  PreCheckResult,
  ResultGeo,
  SpeedTestResult,
  ThroughputResult,
  UserPlan,
} from "./types";

const KEY = "osiptel_medidor_history_v2";
const LEGACY_KEY = "osiptel_medidor_history_v1";
const MAX = 50;
/** Cap sample arrays so localStorage does not blow quota. */
const MAX_SAMPLES = 48;

export type HistorySaveResult =
  | { ok: true; history: SpeedTestResult[] }
  | { ok: false; history: SpeedTestResult[]; error: string };

function emptyThroughput(): ThroughputResult {
  return {
    mbps: 0,
    medianMbps: 0,
    p10Mbps: 0,
    p90Mbps: 0,
    meanMbps: 0,
    samplesMbps: [],
    bytesTransferred: 0,
    durationMs: 0,
    streams: 0,
    server: "",
    windowsMbps: [],
  };
}

function emptyLatency(): LatencyResult {
  return {
    samplesMs: [],
    medianMs: 0,
    meanMs: 0,
    minMs: 0,
    maxMs: 0,
    jitterMs: 0,
    packetLossPct: 0,
    server: "",
  };
}

function emptyPrecheck(): PreCheckResult {
  return {
    online: true,
    connectionType: "unknown",
    networkTypeRaw: null,
    effectiveType: null,
    downlinkMbpsHint: null,
    rttHintMs: null,
    saveData: false,
    hardwareConcurrency: 4,
    deviceMemoryGb: null,
    vpnHint: false,
    userAgent: "",
    timestamp: new Date().toISOString(),
    pageOrigin: "",
    isLocalhostApp: false,
    isAndroid: false,
    isMobileUa: false,
  };
}

function emptyConfidence(): ConfidenceResult {
  return {
    score: 0,
    level: "baja",
    factors: [],
    validForRegulatoryCvm: false,
  };
}

function emptyPlan(): UserPlan {
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

function trimSamples(arr: unknown, max = MAX_SAMPLES): number[] {
  if (!Array.isArray(arr)) return [];
  const nums = arr.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return nums.length > max ? nums.slice(-max) : nums;
}

function normalizeThroughput(raw: unknown): ThroughputResult {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<ThroughputResult>;
  const base = emptyThroughput();
  return {
    ...base,
    ...t,
    samplesMbps: trimSamples(t.samplesMbps),
    windowsMbps: trimSamples(t.windowsMbps, 24),
    medianMbps: Number(t.medianMbps ?? t.mbps ?? 0) || 0,
    mbps: Number(t.mbps ?? t.medianMbps ?? 0) || 0,
    p10Mbps: Number(t.p10Mbps ?? 0) || 0,
    p90Mbps: Number(t.p90Mbps ?? 0) || 0,
    meanMbps: Number(t.meanMbps ?? 0) || 0,
    bytesTransferred: Number(t.bytesTransferred ?? 0) || 0,
    durationMs: Number(t.durationMs ?? 0) || 0,
    streams: Number(t.streams ?? 0) || 0,
    server: String(t.server ?? ""),
  };
}

function normalizeLatency(raw: unknown): LatencyResult {
  const t = (raw && typeof raw === "object" ? raw : {}) as Partial<LatencyResult>;
  const base = emptyLatency();
  return {
    ...base,
    ...t,
    samplesMs: trimSamples(t.samplesMs, 20),
    medianMs: Number(t.medianMs ?? 0) || 0,
    meanMs: Number(t.meanMs ?? 0) || 0,
    minMs: Number(t.minMs ?? 0) || 0,
    maxMs: Number(t.maxMs ?? 0) || 0,
    jitterMs: Number(t.jitterMs ?? 0) || 0,
    packetLossPct: Number(t.packetLossPct ?? 0) || 0,
    server: String(t.server ?? ""),
  };
}

/** Ensures every history item is safe for UI + PDF export. */
export function normalizeResult(raw: unknown): SpeedTestResult | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SpeedTestResult> & { id?: string };
  if (!r.id || typeof r.id !== "string") return null;

  const confRaw =
    r.confidence && typeof r.confidence === "object" ? r.confidence : emptyConfidence();

  return {
    id: r.id,
    protocolVersion: String(r.protocolVersion ?? "—"),
    clientVersion: String(r.clientVersion ?? "—"),
    startedAt: String(r.startedAt ?? ""),
    finishedAt: String(r.finishedAt ?? r.startedAt ?? new Date().toISOString()),
    precheck: {
      ...emptyPrecheck(),
      ...(r.precheck && typeof r.precheck === "object" ? r.precheck : {}),
    },
    selectedServer: r.selectedServer ?? {
      id: "unknown",
      name: "Desconocido",
      region: "—",
      kind: "internet",
      isLoopback: false,
    },
    serverProbes: Array.isArray(r.serverProbes) ? r.serverProbes : [],
    serverMeta: r.serverMeta ?? null,
    networkIdentity: r.networkIdentity ?? null,
    geo:
      r.geo &&
      typeof r.geo === "object" &&
      typeof (r.geo as ResultGeo).latitude === "number" &&
      typeof (r.geo as ResultGeo).longitude === "number"
        ? {
            latitude: (r.geo as ResultGeo).latitude,
            longitude: (r.geo as ResultGeo).longitude,
            accuracyM: (r.geo as ResultGeo).accuracyM ?? null,
            altitudeM: (r.geo as ResultGeo).altitudeM ?? null,
            timestamp: String((r.geo as ResultGeo).timestamp ?? ""),
            source: String((r.geo as ResultGeo).source ?? "unknown"),
          }
        : null,
    runIndex: typeof r.runIndex === "number" ? r.runIndex : undefined,
    runTotal: typeof r.runTotal === "number" ? r.runTotal : undefined,
    plan: {
      ...emptyPlan(),
      ...(r.plan && typeof r.plan === "object" ? r.plan : {}),
    },
    latency: normalizeLatency(r.latency),
    download: normalizeThroughput(r.download),
    upload: normalizeThroughput(r.upload),
    loadedLatency: r.loadedLatency ? normalizeLatency(r.loadedLatency) : null,
    bufferbloatMs:
      typeof r.bufferbloatMs === "number" ? r.bufferbloatMs : null,
    confidence: {
      ...emptyConfidence(),
      ...confRaw,
      factors: Array.isArray(confRaw.factors) ? confRaw.factors : [],
      validForRegulatoryCvm: Boolean(
        (confRaw as ConfidenceResult).validForRegulatoryCvm
      ),
      score: Number((confRaw as ConfidenceResult).score ?? 0) || 0,
      level: (confRaw as ConfidenceResult).level ?? "baja",
    },
    cvm: r.cvm ?? null,
    signature: r.signature ?? {
      algorithm: "SHA-256",
      hash: "",
      signedAt: "",
      payloadVersion: "1",
    },
    notes: Array.isArray(r.notes) ? r.notes.map(String) : [],
  };
}

/** Compact before persist: drop heavy sample tails already trimmed by normalize. */
export function compactResult(result: SpeedTestResult): SpeedTestResult {
  const n = normalizeResult(result);
  if (!n) return result;
  // Drop per-probe bulk and raw meta noise
  return {
    ...n,
    serverProbes: (n.serverProbes || []).map((p) => ({
      serverId: p.serverId,
      name: p.name,
      region: p.region,
      kind: p.kind,
      rttMs: p.rttMs,
      ok: p.ok,
      isLoopback: p.isLoopback,
      warning: p.warning,
    })),
    serverMeta: n.serverMeta
      ? {
          clientIp: n.serverMeta.clientIp,
          colo: n.serverMeta.colo,
          city: n.serverMeta.city,
          country: n.serverMeta.country,
          asn: n.serverMeta.asn,
          asOrganization: n.serverMeta.asOrganization,
        }
      : null,
    networkIdentity: n.networkIdentity
      ? {
          ...n.networkIdentity,
          isp: {
            ...n.networkIdentity.isp,
            // drop long notes noise on compact
            notes: (n.networkIdentity.isp.notes || []).slice(0, 4),
          },
        }
      : null,
    geo: n.geo,
    runIndex: n.runIndex,
    runTotal: n.runTotal,
  };
}

function parseList(raw: string | null): SpeedTestResult[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeResult(item))
      .filter((x): x is SpeedTestResult => x != null);
  } catch {
    return [];
  }
}

function migrateLegacy(): SpeedTestResult[] {
  try {
    return parseList(localStorage.getItem(LEGACY_KEY));
  } catch {
    return [];
  }
}

export function loadHistory(): SpeedTestResult[] {
  if (typeof window === "undefined") return [];
  try {
    const current = parseList(localStorage.getItem(KEY));
    if (current.length) return current;
    const legacy = migrateLegacy();
    if (legacy.length) {
      try {
        localStorage.setItem(KEY, JSON.stringify(legacy.map(compactResult)));
      } catch {
        /* ignore */
      }
    }
    return legacy;
  } catch {
    return [];
  }
}

function persist(list: SpeedTestResult[]): HistorySaveResult {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.map(compactResult)));
    return { ok: true, history: list };
  } catch (e) {
    // Quota: try smaller payload (strip samples)
    try {
      const slim = list.map((r) => ({
        ...compactResult(r),
        download: { ...r.download, samplesMbps: [], windowsMbps: r.download.windowsMbps?.slice(-12) ?? [] },
        upload: { ...r.upload, samplesMbps: [], windowsMbps: r.upload.windowsMbps?.slice(-12) ?? [] },
        latency: { ...r.latency, samplesMs: [] },
        loadedLatency: r.loadedLatency
          ? { ...r.loadedLatency, samplesMs: [] }
          : null,
      }));
      localStorage.setItem(KEY, JSON.stringify(slim));
      return {
        ok: true,
        history: slim,
      };
    } catch {
      const msg =
        e instanceof Error
          ? e.message
          : "No se pudo guardar el historial (almacenamiento lleno).";
      return { ok: false, history: list, error: msg };
    }
  }
}

export function saveResult(result: SpeedTestResult): HistorySaveResult {
  const normalized = normalizeResult(result);
  if (!normalized) {
    return {
      ok: false,
      history: loadHistory(),
      error: "Resultado inválido; no se guardó en historial.",
    };
  }
  const prev = loadHistory();
  const next = [
    compactResult(normalized),
    ...prev.filter((r) => r.id !== normalized.id),
  ].slice(0, MAX);
  return persist(next);
}

export function removeResult(id: string): SpeedTestResult[] {
  const next = loadHistory().filter((r) => r.id !== id);
  persist(next);
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* ignore */
  }
}

export function getResultFromHistory(id: string): SpeedTestResult | null {
  return loadHistory().find((r) => r.id === id) ?? null;
}

export function exportHistoryJson(history: SpeedTestResult[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: history.length,
      results: history,
    },
    null,
    2
  );
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime = "application/json"
): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
