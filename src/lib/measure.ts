import { computeConfidence } from "./confidence";
import { computeCvmFromPlan } from "./cvm";
import {
  accessKindLabel,
  fetchIspMeta,
  identifyFromMeta,
  mapAccessKind,
} from "./isp";
import { runPrecheck } from "./precheck";
import {
  CLIENT_VERSION,
  getDefaultServerId,
  getMeasurementServers,
  PROTOCOL_VERSION,
} from "./servers";
import { fetchServerMeta, probeServers, selectBestServer } from "./serverSelect";
import { signResult } from "./signature";
import {
  mean,
  median,
  percentile,
  round,
  successiveJitter,
  uid,
} from "./stats";
import type {
  LatencyResult,
  MeasurementServer,
  NetworkIdentity,
  ProgressEvent,
  SpeedTestResult,
  ThroughputResult,
  UserPlan,
} from "./types";

export type ProgressCallback = (ev: ProgressEvent) => void;

const LATENCY_SAMPLES = 20;
const DOWNLOAD_DURATION_MS = 12_000;
const UPLOAD_DURATION_MS = 10_000;
const RAMP_UP_DISCARD_MS = 2_500;
const WINDOW_MS = 200;
const AGG_WINDOW_MS = 1_000;

export type ServerPreference = string | "auto";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function measureOneRtt(url: string, timeoutMs = 5000): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    await fetch(url, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
      signal: controller.signal,
    });
    return performance.now() - t0;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function measureLatency(
  server: MeasurementServer,
  samples = LATENCY_SAMPLES,
  onSample?: (ms: number, i: number) => void
): Promise<LatencyResult> {
  const samplesMs: number[] = [];
  let failed = 0;

  for (let i = 0; i < samples; i++) {
    const url = `${server.pingUrl}${server.pingUrl.includes("?") ? "&" : "?"}n=${i}_${Date.now()}`;
    const rtt = await measureOneRtt(url);
    if (rtt == null) {
      failed += 1;
    } else {
      samplesMs.push(rtt);
      onSample?.(rtt, i);
    }
    await sleep(40);
  }

  const packetLossPct = samples > 0 ? (failed / samples) * 100 : 100;

  return {
    samplesMs,
    medianMs: round(median(samplesMs), 2),
    meanMs: round(mean(samplesMs), 2),
    minMs: round(samplesMs.length ? Math.min(...samplesMs) : 0, 2),
    maxMs: round(samplesMs.length ? Math.max(...samplesMs) : 0, 2),
    jitterMs: round(successiveJitter(samplesMs), 2),
    packetLossPct: round(packetLossPct, 1),
    server: server.id,
  };
}

function findBytesAt(marks: { t: number; bytes: number }[], t: number): number {
  if (marks.length === 0) return 0;
  if (t <= marks[0].t) return marks[0].bytes;
  for (let i = 1; i < marks.length; i++) {
    if (marks[i].t >= t) {
      const a = marks[i - 1];
      const b = marks[i];
      const w = (t - a.t) / (b.t - a.t || 1);
      return a.bytes + (b.bytes - a.bytes) * w;
    }
  }
  return marks[marks.length - 1].bytes;
}

async function measureDownload(
  server: MeasurementServer,
  streams: number,
  durationMs: number,
  onProgress?: (liveMbps: number, elapsed: number) => void
): Promise<ThroughputResult> {
  const start = performance.now();
  const endAt = start + durationMs;
  let totalBytes = 0;
  const controllers: AbortController[] = [];
  const byteMarks: { t: number; bytes: number }[] = [{ t: start, bytes: 0 }];

  const markInterval = window.setInterval(() => {
    const now = performance.now();
    byteMarks.push({ t: now, bytes: totalBytes });
    const cutoff = now - 1000;
    const prev = [...byteMarks].reverse().find((m) => m.t <= cutoff) ?? byteMarks[0];
    const dt = (now - prev.t) / 1000;
    const db = totalBytes - prev.bytes;
    if (dt > 0) onProgress?.((db * 8) / dt / 1e6, now - start);
  }, WINDOW_MS);

  async function oneStream(id: number): Promise<void> {
    while (performance.now() < endAt) {
      const remaining = endAt - performance.now();
      if (remaining < 80) break;

      const chunkBytes = 8 * 1024 * 1024;
      const controller = new AbortController();
      controllers.push(controller);
      const timeout = setTimeout(
        () => controller.abort(),
        Math.min(remaining + 2000, 20_000)
      );

      try {
        const res = await fetch(server.downloadUrl(chunkBytes) + `&s=${id}`, {
          cache: "no-store",
          mode: "cors",
          credentials: "omit",
          signal: controller.signal,
        });
        if (!res.ok || !res.body) break;
        const reader = res.body.getReader();
        while (performance.now() < endAt) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) totalBytes += value.byteLength;
        }
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      } catch {
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  await Promise.all(Array.from({ length: streams }, (_, i) => oneStream(i)));
  clearInterval(markInterval);
  controllers.forEach((c) => c.abort());

  const finished = performance.now();
  const duration = finished - start;
  byteMarks.push({ t: finished, bytes: totalBytes });

  const windowsMbps: number[] = [];
  const samplesMbps: number[] = [];
  const steadyStart = start + RAMP_UP_DISCARD_MS;

  for (let t = steadyStart; t + AGG_WINDOW_MS <= finished; t += AGG_WINDOW_MS) {
    const a = findBytesAt(byteMarks, t);
    const b = findBytesAt(byteMarks, t + AGG_WINDOW_MS);
    const mbps = ((b - a) * 8) / (AGG_WINDOW_MS / 1000) / 1e6;
    if (mbps >= 0) windowsMbps.push(mbps);
  }

  for (let i = 1; i < byteMarks.length; i++) {
    const dt = (byteMarks[i].t - byteMarks[i - 1].t) / 1000;
    if (dt <= 0) continue;
    if (byteMarks[i].t < steadyStart) continue;
    const db = byteMarks[i].bytes - byteMarks[i - 1].bytes;
    samplesMbps.push((db * 8) / dt / 1e6);
  }

  const primary = windowsMbps.length ? windowsMbps : samplesMbps;
  const medianMbps = median(primary);
  const meanMbps = mean(primary);
  const overallMbps =
    duration > 0 ? (totalBytes * 8) / (duration / 1000) / 1e6 : 0;

  return {
    mbps: round(medianMbps || overallMbps, 2),
    medianMbps: round(medianMbps || overallMbps, 2),
    p10Mbps: round(percentile(primary, 10), 2),
    p90Mbps: round(percentile(primary, 90), 2),
    meanMbps: round(meanMbps || overallMbps, 2),
    samplesMbps: samplesMbps.map((x) => round(x, 2)),
    bytesTransferred: totalBytes,
    durationMs: round(duration, 0),
    streams,
    server: server.id,
    windowsMbps: windowsMbps.map((x) => round(x, 2)),
  };
}

function makeUploadPayload(size: number): Blob {
  const buf = new Uint8Array(size);
  const cryptoObj = typeof crypto !== "undefined" ? crypto : null;
  if (cryptoObj?.getRandomValues) {
    const chunk = 65536;
    for (let i = 0; i < size; i += chunk) {
      cryptoObj.getRandomValues(buf.subarray(i, Math.min(i + chunk, size)));
    }
  } else {
    for (let i = 0; i < size; i++) buf[i] = (i * 31 + 17) & 0xff;
  }
  return new Blob([buf], { type: "application/octet-stream" });
}

async function measureUpload(
  server: MeasurementServer,
  streams: number,
  durationMs: number,
  onProgress?: (liveMbps: number, elapsed: number) => void
): Promise<ThroughputResult> {
  const start = performance.now();
  const endAt = start + durationMs;
  let totalBytes = 0;
  const byteMarks: { t: number; bytes: number }[] = [{ t: start, bytes: 0 }];
  const chunkSize = 1 * 1024 * 1024;
  const payload = makeUploadPayload(chunkSize);

  const markInterval = window.setInterval(() => {
    const now = performance.now();
    byteMarks.push({ t: now, bytes: totalBytes });
    const cutoff = now - 1000;
    const prev = [...byteMarks].reverse().find((m) => m.t <= cutoff) ?? byteMarks[0];
    const dt = (now - prev.t) / 1000;
    const db = totalBytes - prev.bytes;
    if (dt > 0) onProgress?.((db * 8) / dt / 1e6, now - start);
  }, WINDOW_MS);

  async function oneStream(): Promise<void> {
    while (performance.now() < endAt) {
      const remaining = endAt - performance.now();
      if (remaining < 100) break;
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Math.min(remaining + 3000, 25_000)
      );
      try {
        const res = await fetch(server.uploadUrl, {
          method: "POST",
          body: payload,
          cache: "no-store",
          mode: "cors",
          credentials: "omit",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/octet-stream",
          },
        });
        if (res.ok || res.status === 200) {
          totalBytes += chunkSize;
        } else {
          break;
        }
      } catch {
        break;
      } finally {
        clearTimeout(timeout);
      }
    }
  }

  await Promise.all(Array.from({ length: streams }, () => oneStream()));
  clearInterval(markInterval);

  const finished = performance.now();
  const duration = finished - start;
  byteMarks.push({ t: finished, bytes: totalBytes });

  const windowsMbps: number[] = [];
  const samplesMbps: number[] = [];
  const steadyStart = start + Math.min(RAMP_UP_DISCARD_MS, durationMs * 0.2);

  for (let t = steadyStart; t + AGG_WINDOW_MS <= finished; t += AGG_WINDOW_MS) {
    const a = findBytesAt(byteMarks, t);
    const b = findBytesAt(byteMarks, t + AGG_WINDOW_MS);
    const mbps = ((b - a) * 8) / (AGG_WINDOW_MS / 1000) / 1e6;
    if (mbps >= 0) windowsMbps.push(mbps);
  }

  for (let i = 1; i < byteMarks.length; i++) {
    const dt = (byteMarks[i].t - byteMarks[i - 1].t) / 1000;
    if (dt <= 0 || byteMarks[i].t < steadyStart) continue;
    const db = byteMarks[i].bytes - byteMarks[i - 1].bytes;
    samplesMbps.push((db * 8) / dt / 1e6);
  }

  const primary = windowsMbps.length ? windowsMbps : samplesMbps;
  const medianMbps = median(primary);
  const overallMbps =
    duration > 0 ? (totalBytes * 8) / (duration / 1000) / 1e6 : 0;

  return {
    mbps: round(medianMbps || overallMbps, 2),
    medianMbps: round(medianMbps || overallMbps, 2),
    p10Mbps: round(percentile(primary, 10), 2),
    p90Mbps: round(percentile(primary, 90), 2),
    meanMbps: round(mean(primary) || overallMbps, 2),
    samplesMbps: samplesMbps.map((x) => round(x, 2)),
    bytesTransferred: totalBytes,
    durationMs: round(duration, 0),
    streams,
    server: server.id,
    windowsMbps: windowsMbps.map((x) => round(x, 2)),
  };
}

function pickStreams(hintMbps: number | null): number {
  if (hintMbps != null && hintMbps >= 100) return 8;
  if (hintMbps != null && hintMbps >= 50) return 6;
  return 4;
}

export async function runSpeedTest(
  plan: UserPlan,
  onProgress: ProgressCallback,
  serverPreference: ServerPreference = "auto"
): Promise<SpeedTestResult> {
  const notes: string[] = [];
  const startedAt = new Date().toISOString();
  const id = uid();
  const servers = getMeasurementServers();

  onProgress({
    phase: "precheck",
    progress: 2,
    message: "Verificando entorno de medición…",
  });
  const precheck = await runPrecheck();
  if (!precheck.online) {
    notes.push("El navegador reportó estar sin conexión.");
  }

  const access = mapAccessKind(
    precheck.connectionType,
    precheck.networkTypeRaw
  );
  if (access === "cellular") {
    notes.push(
      "Acceso por datos móviles: el operador se estima por IP/ASN (no se lee la SIM)."
    );
  } else if (access === "wifi") {
    notes.push(
      "Acceso Wi‑Fi: el ISP detectado es el de la red Wi‑Fi, no el de la SIM."
    );
  }

  onProgress({
    phase: "server_select",
    progress: 6,
    message: "Sondeando servidores e identificando ISP…",
  });
  const serverProbes = await probeServers(servers);
  const { server } = selectBestServer(
    servers,
    serverProbes,
    serverPreference === "auto" ? "auto" : serverPreference
  );

  if (server.isLoopback) {
    notes.push(server.warning || "Servidor loopback seleccionado.");
  }

  // Prefer measurement server meta; always enrich with CF/ip lookup for ISP
  const [serverMetaRaw, ispMeta] = await Promise.all([
    fetchServerMeta(server),
    fetchIspMeta(),
  ]);
  const serverMeta = serverMetaRaw?.asn || serverMetaRaw?.asOrganization
    ? serverMetaRaw
    : ispMeta ?? serverMetaRaw;

  const isp = identifyFromMeta(serverMeta ?? ispMeta, access);
  notes.push(...isp.notes);

  const networkIdentity: NetworkIdentity = {
    access,
    accessLabel: accessKindLabel(access),
    isp: {
      brand: isp.brand,
      organization: isp.organization,
      asn: isp.asn,
      clientIp: isp.clientIp,
      country: isp.country,
      city: isp.city,
      colo: isp.colo,
      source: isp.source,
      category: isp.category,
      displayName: isp.displayName,
      confidence: isp.confidence,
      notes: isp.notes,
    },
    likelyMobileData: access === "cellular",
    likelyWifi: access === "wifi",
    simReadable: false,
    disclaimer:
      "El operador/ISP se estima por la IP pública (ASN). El navegador no puede leer el nombre de la SIM. En Wi‑Fi verás el ISP del router, no el de la línea móvil.",
  };

  onProgress({
    phase: "latency",
    progress: 12,
    message: `Latencia vía ${server.name}…`,
  });
  const latency = await measureLatency(server, LATENCY_SAMPLES, (ms, i) => {
    onProgress({
      phase: "latency",
      progress: 12 + (i / LATENCY_SAMPLES) * 10,
      liveLatencyMs: ms,
      message: `Latencia muestra ${i + 1}/${LATENCY_SAMPLES}…`,
    });
  });

  const streams = pickStreams(precheck.downlinkMbpsHint ?? plan.downMbps);

  onProgress({
    phase: "download",
    progress: 24,
    message: `Descarga multi-stream (${streams} hilos) · ${server.name}`,
  });
  const download = await measureDownload(
    server,
    streams,
    DOWNLOAD_DURATION_MS,
    (liveMbps, elapsed) => {
      const p = 24 + Math.min(36, (elapsed / DOWNLOAD_DURATION_MS) * 36);
      onProgress({
        phase: "download",
        progress: p,
        liveMbps,
        message: "Midiendo velocidad de bajada (régimen estable)…",
      });
    }
  );

  onProgress({
    phase: "upload",
    progress: 62,
    message: `Subida multi-stream (${Math.min(streams, 6)} hilos)…`,
  });
  const uploadStreams = Math.min(streams, 6);
  const upload = await measureUpload(
    server,
    uploadStreams,
    UPLOAD_DURATION_MS,
    (liveMbps, elapsed) => {
      const p = 62 + Math.min(26, (elapsed / UPLOAD_DURATION_MS) * 26);
      onProgress({
        phase: "upload",
        progress: p,
        liveMbps,
        message: "Midiendo velocidad de subida…",
      });
    }
  );

  onProgress({
    phase: "loaded_latency",
    progress: 90,
    message: "Midiendo latencia bajo carga (bufferbloat)…",
  });

  let loadedLatency: LatencyResult | null = null;
  let bufferbloatMs: number | null = null;
  try {
    const stressController = new AbortController();
    const stressPromise = fetch(server.downloadUrl(25 * 1024 * 1024), {
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
      signal: stressController.signal,
    })
      .then(async (res) => {
        if (!res.body) return;
        const reader = res.body.getReader();
        const until = performance.now() + 3500;
        while (performance.now() < until) {
          const { done } = await reader.read();
          if (done) break;
        }
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined);

    await sleep(300);
    loadedLatency = await measureLatency(server, 10);
    stressController.abort();
    await stressPromise;
    bufferbloatMs = round(loadedLatency.medianMs - latency.medianMs, 2);
    if (bufferbloatMs < 0) bufferbloatMs = 0;
  } catch {
    notes.push("No se pudo completar latencia bajo carga.");
  }

  const confidence = computeConfidence(
    precheck,
    download,
    upload,
    server,
    notes
  );
  const refDown =
    plan.serviceMode === "mobile" ? plan.mobileDownMbps : plan.downMbps;
  const cvm = refDown > 0 ? computeCvmFromPlan(download, upload, plan) : null;

  const finishedAt = new Date().toISOString();

  const unsigned: Omit<SpeedTestResult, "signature"> = {
    id,
    protocolVersion: PROTOCOL_VERSION,
    clientVersion: CLIENT_VERSION,
    startedAt,
    finishedAt,
    precheck,
    selectedServer: {
      id: server.id,
      name: server.name,
      region: server.region,
      kind: server.kind,
      isLoopback: server.isLoopback,
    },
    serverProbes,
    serverMeta,
    networkIdentity,
    geo: null,
    plan: { ...plan },
    latency,
    download,
    upload,
    loadedLatency,
    bufferbloatMs,
    confidence,
    cvm,
    notes,
  };

  const signature = await signResult(unsigned);

  onProgress({
    phase: "done",
    progress: 100,
    message: "Prueba completada y firmada",
    liveMbps: download.medianMbps,
  });

  return { ...unsigned, signature };
}

export { getDefaultServerId, getMeasurementServers };
