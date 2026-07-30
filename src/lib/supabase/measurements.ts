import type { SpeedTestResult } from "@/lib/types";
import { getSupabase, isSupabaseConfigured } from "./client";
import type { MeasurementInsert, MeasurementRow } from "./types";

/** Convierte un resultado local a fila Supabase (sin samples pesados). */
export function toMeasurementInsert(result: SpeedTestResult): MeasurementInsert {
  const ni = result.networkIdentity;
  const slimPayload = {
    id: result.id,
    finishedAt: result.finishedAt,
    plan: result.plan,
    selectedServer: result.selectedServer,
    networkIdentity: result.networkIdentity,
    geo: result.geo,
    cvm: result.cvm,
    confidence: {
      score: result.confidence?.score,
      level: result.confidence?.level,
      validForRegulatoryCvm: result.confidence?.validForRegulatoryCvm,
    },
    download: {
      medianMbps: result.download?.medianMbps,
      p10Mbps: result.download?.p10Mbps,
      p90Mbps: result.download?.p90Mbps,
    },
    upload: {
      medianMbps: result.upload?.medianMbps,
      p10Mbps: result.upload?.p10Mbps,
      p90Mbps: result.upload?.p90Mbps,
    },
    latency: {
      medianMs: result.latency?.medianMs,
      jitterMs: result.latency?.jitterMs,
      packetLossPct: result.latency?.packetLossPct,
    },
    signature: result.signature,
    notes: result.notes,
    runIndex: result.runIndex,
    runTotal: result.runTotal,
  };

  return {
    client_result_id: result.id,
    finished_at: result.finishedAt || null,
    started_at: result.startedAt || null,
    operator:
      ni?.isp.brand ||
      ni?.isp.displayName ||
      result.plan?.operator ||
      null,
    plan_down_mbps:
      result.plan?.serviceMode === "mobile"
        ? result.plan?.mobileDownMbps ?? result.plan?.downMbps ?? null
        : result.plan?.downMbps ?? null,
    plan_up_mbps:
      result.plan?.serviceMode === "mobile"
        ? result.plan?.mobileUpMbps ?? result.plan?.upMbps ?? null
        : result.plan?.upMbps ?? null,
    // technology: en móvil guardamos 3g/4g/5g; en fijo ftth/hfc/...
    technology:
      result.plan?.serviceMode === "mobile"
        ? result.plan?.radioTech || null
        : result.plan?.technology || null,
    access_type: ni?.access || result.precheck?.connectionType || null,
    access_label: ni?.accessLabel || null,
    isp_brand: ni?.isp.brand || null,
    isp_organization: ni?.isp.organization || null,
    asn: ni?.isp.asn ?? null,
    client_ip: ni?.isp.clientIp || null,
    download_mbps: result.download?.medianMbps ?? null,
    upload_mbps: result.upload?.medianMbps ?? null,
    latency_ms: result.latency?.medianMs ?? null,
    jitter_ms: result.latency?.jitterMs ?? null,
    packet_loss_pct: result.latency?.packetLossPct ?? null,
    bufferbloat_ms: result.bufferbloatMs ?? null,
    cvm_pct: result.cvm?.cvmPct ?? null,
    meets_cvm: result.cvm?.meetsCvm ?? null,
    min_guaranteed_mbps: result.cvm?.minGuaranteedDownMbps ?? null,
    latitude: result.geo?.latitude ?? null,
    longitude: result.geo?.longitude ?? null,
    geo_accuracy_m: result.geo?.accuracyM ?? null,
    geo_source: result.geo?.source ?? null,
    geo_timestamp: result.geo?.timestamp ?? null,
    confidence_score: result.confidence?.score ?? null,
    confidence_level: result.confidence?.level ?? null,
    protocol_version: result.protocolVersion ?? null,
    client_version: result.clientVersion ?? null,
    server_id: result.selectedServer?.id ?? null,
    run_index: result.runIndex ?? null,
    run_total: result.runTotal ?? null,
    signature_hash: result.signature?.hash ?? null,
    payload: slimPayload as unknown as MeasurementInsert["payload"],
  };
}

export type CloudSaveResult =
  | { ok: true; id: string }
  | { ok: false; error: string; skipped?: boolean };

/** Inserta medición en la nube (acceso público anon). No lanza. */
export async function saveMeasurementToCloud(
  result: SpeedTestResult
): Promise<CloudSaveResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      skipped: true,
      error: "Supabase no configurado (faltan variables de entorno).",
    };
  }
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, skipped: true, error: "Cliente Supabase no disponible." };
  }

  try {
    const row = toMeasurementInsert(result);
    // IMPORTANTE: no usar .select() tras insert con rol anon.
    // RLS solo permite INSERT a anon; SELECT es solo authenticated.
    // .insert().select() fallaba aunque el insert fuera válido.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from("measurements") as any).insert(row);

    if (error) {
      console.error("[supabase] insert measurements failed:", error);
      return {
        ok: false,
        error: String(error.message || error.code || error),
      };
    }
    return { ok: true, id: result.id };
  } catch (e) {
    console.error("[supabase] insert exception:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Error al guardar en la nube",
    };
  }
}

/** Lista mediciones (requiere sesión admin autenticada). */
export async function fetchAllMeasurements(limit = 500): Promise<{
  ok: boolean;
  rows: MeasurementRow[];
  error?: string;
}> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, rows: [], error: "Supabase no configurado." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from("measurements") as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { ok: false, rows: [], error: String(error.message || error) };
  }
  return { ok: true, rows: (data ?? []) as MeasurementRow[] };
}

export function measurementsToCsv(rows: MeasurementRow[]): string {
  const headers = [
    "id",
    "finished_at",
    "operator",
    "access_type",
    "download_mbps",
    "upload_mbps",
    "latency_ms",
    "jitter_ms",
    "cvm_pct",
    "meets_cvm",
    "latitude",
    "longitude",
    "geo_accuracy_m",
    "isp_organization",
    "asn",
    "client_ip",
    "plan_down_mbps",
    "plan_up_mbps",
    "confidence_score",
    "signature_hash",
  ];
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => esc((r as unknown as Record<string, unknown>)[h]))
        .join(",")
    );
  }
  return lines.join("\n");
}
