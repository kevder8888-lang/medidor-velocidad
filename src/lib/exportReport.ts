import type { MeasurementRow } from "@/lib/supabase/types";
import { radioTechLabel } from "@/lib/mobilePlans";

/** Columnas fijas para informe / Excel (admin y exports). */
export const REPORT_HEADERS = [
  "id",
  "fecha_hora",
  "operador",
  "modo_servicio",
  "tecnologia",
  "acceso_red",
  "ref_bajada_mbps",
  "ref_subida_mbps",
  "bajada_mbps",
  "subida_mbps",
  "latencia_ms",
  "jitter_ms",
  "perdida_pct",
  "bufferbloat_ms",
  "cvm_pct",
  "cumple_cvm",
  "minimo_garantizado_mbps",
  "latitud",
  "longitud",
  "precision_gps_m",
  "fuente_gps",
  "isp_marca",
  "isp_organizacion",
  "asn",
  "ip_publica",
  "confianza",
  "servidor",
  "serie_rep",
  "serie_total",
  "firma_sha256",
  "protocolo",
  "cliente",
] as const;

export type ReportHeader = (typeof REPORT_HEADERS)[number];

function escCsv(v: unknown): string {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function modeLabel(r: MeasurementRow): string {
  const tech = (r.technology || r.radio_tech || "").toLowerCase();
  if (r.service_mode === "mobile" || ["3g", "4g", "5g"].includes(tech)) {
    return "movil";
  }
  return "fijo";
}

function techLabel(r: MeasurementRow): string {
  const tech = (r.radio_tech || r.technology || "").toLowerCase();
  if (["3g", "4g", "5g"].includes(tech)) return radioTechLabel(tech);
  return r.technology || "—";
}

/** Fila plana para informe a partir de MeasurementRow (Supabase). */
export function measurementToReportRow(
  r: MeasurementRow
): Record<ReportHeader, string | number | boolean | null> {
  const fecha = r.finished_at || r.created_at || "";
  return {
    id: r.id,
    fecha_hora: fecha
      ? new Date(fecha).toISOString()
      : "",
    operador: r.operator || r.isp_brand || "",
    modo_servicio: modeLabel(r),
    tecnologia: techLabel(r),
    acceso_red: r.access_label || r.access_type || "",
    ref_bajada_mbps: r.plan_down_mbps,
    ref_subida_mbps: r.plan_up_mbps,
    bajada_mbps: r.download_mbps,
    subida_mbps: r.upload_mbps,
    latencia_ms: r.latency_ms,
    jitter_ms: r.jitter_ms,
    perdida_pct: r.packet_loss_pct,
    bufferbloat_ms: r.bufferbloat_ms,
    cvm_pct: r.cvm_pct,
    cumple_cvm:
      r.meets_cvm === true ? "SI" : r.meets_cvm === false ? "NO" : "",
    minimo_garantizado_mbps: r.min_guaranteed_mbps,
    latitud: r.latitude,
    longitud: r.longitude,
    precision_gps_m: r.geo_accuracy_m,
    fuente_gps: r.geo_source || "",
    isp_marca: r.isp_brand || "",
    isp_organizacion: r.isp_organization || "",
    asn: r.asn,
    ip_publica: r.client_ip || "",
    confianza: r.confidence_score,
    servidor: r.server_id || "",
    serie_rep: r.run_index,
    serie_total: r.run_total,
    firma_sha256: r.signature_hash || "",
    protocolo: r.protocol_version || "",
    cliente: r.client_version || "",
  };
}

export function measurementsToEnrichedCsv(rows: MeasurementRow[]): string {
  const lines = [REPORT_HEADERS.join(",")];
  for (const r of rows) {
    const row = measurementToReportRow(r);
    lines.push(REPORT_HEADERS.map((h) => escCsv(row[h])).join(","));
  }
  // BOM para Excel en español
  return "\uFEFF" + lines.join("\n");
}

export function measurementsToEnrichedJson(rows: MeasurementRow[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      count: rows.length,
      columns: REPORT_HEADERS,
      rows: rows.map(measurementToReportRow),
    },
    null,
    2
  );
}
