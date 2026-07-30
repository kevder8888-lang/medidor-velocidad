import type { ResultSignature, SpeedTestResult } from "./types";

/** Canonical subset used for integrity hash (stable key order). */
export function buildSignPayload(
  result: Omit<SpeedTestResult, "signature">
): Record<string, unknown> {
  return {
    id: result.id,
    protocolVersion: result.protocolVersion,
    clientVersion: result.clientVersion,
    startedAt: result.startedAt,
    finishedAt: result.finishedAt,
    selectedServer: result.selectedServer,
    plan: result.plan,
    latency: {
      medianMs: result.latency.medianMs,
      jitterMs: result.latency.jitterMs,
      packetLossPct: result.latency.packetLossPct,
      server: result.latency.server,
    },
    download: {
      medianMbps: result.download.medianMbps,
      p10Mbps: result.download.p10Mbps,
      p90Mbps: result.download.p90Mbps,
      bytesTransferred: result.download.bytesTransferred,
      durationMs: result.download.durationMs,
      streams: result.download.streams,
      server: result.download.server,
    },
    upload: {
      medianMbps: result.upload.medianMbps,
      p10Mbps: result.upload.p10Mbps,
      p90Mbps: result.upload.p90Mbps,
      bytesTransferred: result.upload.bytesTransferred,
      durationMs: result.upload.durationMs,
      streams: result.upload.streams,
      server: result.upload.server,
    },
    bufferbloatMs: result.bufferbloatMs,
    loadedLatencyMedianMs: result.loadedLatency?.medianMs ?? null,
    confidence: {
      score: result.confidence.score,
      level: result.confidence.level,
      validForRegulatoryCvm: result.confidence.validForRegulatoryCvm,
    },
    cvm: result.cvm
      ? {
          contractedDownMbps: result.cvm.contractedDownMbps,
          measuredDownMbps: result.cvm.measuredDownMbps,
          cvmPct: result.cvm.cvmPct,
          meetsCvm: result.cvm.meetsCvm,
          thresholdPct: result.cvm.thresholdPct,
        }
      : null,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function signResult(
  result: Omit<SpeedTestResult, "signature">
): Promise<ResultSignature> {
  const payload = buildSignPayload(result);
  const hash = await sha256Hex(stableStringify(payload));
  return {
    algorithm: "SHA-256",
    hash,
    signedAt: new Date().toISOString(),
    payloadVersion: "1",
  };
}

export async function verifyResultSignature(
  result: SpeedTestResult
): Promise<boolean> {
  const { signature, ...rest } = result;
  if (!signature?.hash) return false;
  const expected = await signResult(rest);
  return expected.hash === signature.hash;
}

export function shortHash(hash: string, n = 12): string {
  return hash.slice(0, n);
}
