import { computeCvmFromPlan } from "./cvm";
import { mean, median, round, uid } from "./stats";
import type {
  LatencyResult,
  ResultGeo,
  SpeedTestResult,
  ThroughputResult,
} from "./types";
import { CLIENT_VERSION, PROTOCOL_VERSION } from "./servers";
import { signResult } from "./signature";

function medianThroughput(
  runs: SpeedTestResult[],
  key: "download" | "upload"
): ThroughputResult {
  const medians = runs.map((r) => r[key].medianMbps);
  const p10s = runs.map((r) => r[key].p10Mbps);
  const p90s = runs.map((r) => r[key].p90Mbps);
  const means = runs.map((r) => r[key].meanMbps);
  const bytes = runs.reduce((a, r) => a + r[key].bytesTransferred, 0);
  const dur = mean(runs.map((r) => r[key].durationMs));
  const streams = runs[0]?.[key].streams ?? 4;
  const server = runs[0]?.[key].server ?? "";
  const m = median(medians);
  return {
    mbps: round(m, 2),
    medianMbps: round(m, 2),
    p10Mbps: round(median(p10s), 2),
    p90Mbps: round(median(p90s), 2),
    meanMbps: round(mean(means), 2),
    samplesMbps: medians.map((x) => round(x, 2)),
    bytesTransferred: bytes,
    durationMs: round(dur, 0),
    streams,
    server,
    windowsMbps: medians.map((x) => round(x, 2)),
  };
}

function medianLatency(runs: SpeedTestResult[]): LatencyResult {
  const meds = runs.map((r) => r.latency.medianMs);
  const jitters = runs.map((r) => r.latency.jitterMs);
  const losses = runs.map((r) => r.latency.packetLossPct);
  const mins = runs.map((r) => r.latency.minMs);
  const maxs = runs.map((r) => r.latency.maxMs);
  return {
    samplesMs: meds,
    medianMs: round(median(meds), 2),
    meanMs: round(mean(meds), 2),
    minMs: round(Math.min(...mins), 2),
    maxMs: round(Math.max(...maxs), 2),
    jitterMs: round(median(jitters), 2),
    packetLossPct: round(median(losses), 1),
    server: runs[0]?.latency.server ?? "",
  };
}

function pickGeo(runs: SpeedTestResult[]): ResultGeo | null {
  const withGeo = runs.filter((r) => r.geo?.latitude != null);
  if (!withGeo.length) return null;
  // mediana de lat/lon de las que tienen GPS
  const lats = withGeo.map((r) => r.geo!.latitude);
  const lons = withGeo.map((r) => r.geo!.longitude);
  const last = withGeo[withGeo.length - 1].geo!;
  return {
    latitude: round(median(lats), 6),
    longitude: round(median(lons), 6),
    accuracyM: last.accuracyM,
    altitudeM: last.altitudeM,
    timestamp: new Date().toISOString(),
    source: last.source + "+series_median",
  };
}

/**
 * Construye el resultado "oficial" de una serie: mediana de ↓/↑/latencia de las N corridas.
 */
export async function buildSeriesOfficialResult(
  runs: SpeedTestResult[]
): Promise<SpeedTestResult | null> {
  if (runs.length < 2) return null;
  const first = runs[0];
  const last = runs[runs.length - 1];
  const seriesId = uid();
  const download = medianThroughput(runs, "download");
  const upload = medianThroughput(runs, "upload");
  const latency = medianLatency(runs);
  const geo = pickGeo(runs);
  const bufferbloatMs = median(
    runs.map((r) => r.bufferbloatMs ?? 0).filter((x) => x >= 0)
  );

  const cvm = computeCvmFromPlan(download, upload, first.plan);

  // confianza: media de scores, válida solo si mayoría válidas
  const scores = runs.map((r) => r.confidence.score);
  const validCount = runs.filter(
    (r) => r.confidence.validForRegulatoryCvm
  ).length;
  const score = Math.round(mean(scores));
  const level = score >= 75 ? "alta" : score >= 50 ? "media" : "baja";

  const unsigned: Omit<SpeedTestResult, "signature"> = {
    id: seriesId,
    protocolVersion: PROTOCOL_VERSION,
    clientVersion: CLIENT_VERSION,
    startedAt: first.startedAt,
    finishedAt: last.finishedAt,
    precheck: last.precheck,
    selectedServer: last.selectedServer,
    serverProbes: last.serverProbes,
    serverMeta: last.serverMeta,
    networkIdentity: last.networkIdentity,
    geo,
    runIndex: undefined,
    runTotal: runs.length,
    isSeriesAggregate: true,
    seriesId,
    plan: first.plan,
    latency,
    download,
    upload,
    loadedLatency: last.loadedLatency,
    bufferbloatMs: round(bufferbloatMs, 2),
    confidence: {
      score,
      level,
      factors: [
        {
          label: "Serie agregada (mediana)",
          impact: 0,
          detail: `Mediana de ${runs.length} repeticiones (↓/↑/latencia).`,
        },
      ],
      validForRegulatoryCvm:
        validCount >= Math.ceil(runs.length / 2) && score >= 50,
    },
    cvm,
    notes: [
      `Resultado oficial de serie: mediana de ${runs.length} mediciones.`,
      `IDs corridas: ${runs.map((r) => r.id.slice(0, 8)).join(", ")}.`,
      `↓ mediana ${download.medianMbps} · ↑ mediana ${upload.medianMbps} · lat mediana ${latency.medianMs} ms.`,
    ],
  };

  const signature = await signResult(unsigned);
  return { ...unsigned, signature };
}
