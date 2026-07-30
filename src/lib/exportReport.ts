import type { MeasurementRow } from "@/lib/supabase/types";
import { radioTechLabel } from "@/lib/mobilePlans";
import { BRAND } from "@/lib/brand";

/** Claves internas de columna (estables para CSV/JSON). */
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

/** Etiquetas en español para el Excel (encabezados visibles). */
export const REPORT_LABELS: Record<ReportHeader, string> = {
  id: "ID",
  fecha_hora: "Fecha y hora",
  operador: "Operador",
  modo_servicio: "Modo de servicio",
  tecnologia: "Tecnología",
  acceso_red: "Acceso de red",
  ref_bajada_mbps: "Ref. bajada (Mbps)",
  ref_subida_mbps: "Ref. subida (Mbps)",
  bajada_mbps: "Bajada (Mbps)",
  subida_mbps: "Subida (Mbps)",
  latencia_ms: "Latencia (ms)",
  jitter_ms: "Jitter (ms)",
  perdida_pct: "Pérdida (%)",
  bufferbloat_ms: "Bufferbloat (ms)",
  cvm_pct: "CVM (%)",
  cumple_cvm: "Cumple CVM",
  minimo_garantizado_mbps: "Mínimo garantizado (Mbps)",
  latitud: "Latitud",
  longitud: "Longitud",
  precision_gps_m: "Precisión GPS (m)",
  fuente_gps: "Fuente GPS",
  isp_marca: "ISP / Marca",
  isp_organizacion: "ISP organización",
  asn: "ASN",
  ip_publica: "IP pública",
  confianza: "Confianza",
  servidor: "Servidor",
  serie_rep: "Serie (rep.)",
  serie_total: "Serie (total)",
  firma_sha256: "Firma SHA-256",
  protocolo: "Protocolo",
  cliente: "Cliente",
};

/** Anchos de columna (caracteres aprox.). */
const COL_WIDTHS: Record<ReportHeader, number> = {
  id: 14,
  fecha_hora: 20,
  operador: 14,
  modo_servicio: 14,
  tecnologia: 12,
  acceso_red: 14,
  ref_bajada_mbps: 14,
  ref_subida_mbps: 14,
  bajada_mbps: 13,
  subida_mbps: 13,
  latencia_ms: 12,
  jitter_ms: 11,
  perdida_pct: 11,
  bufferbloat_ms: 14,
  cvm_pct: 10,
  cumple_cvm: 12,
  minimo_garantizado_mbps: 16,
  latitud: 12,
  longitud: 12,
  precision_gps_m: 14,
  fuente_gps: 12,
  isp_marca: 14,
  isp_organizacion: 22,
  asn: 10,
  ip_publica: 14,
  confianza: 11,
  servidor: 14,
  serie_rep: 11,
  serie_total: 11,
  firma_sha256: 42,
  protocolo: 12,
  cliente: 12,
};

const COLORS = {
  black: "FF000000",
  white: "FFFFFFFF",
  osiptelBlue: "FF0056AC",
  osiptelDark: "FF003D7A",
  headerBg: "FF000000",
  headerFg: "FFFFFFFF",
  zebra: "FFF3F7FC",
  surface: "FFEFF5FC",
  border: "FFB0B8C1",
  successBg: "FFD4F5E6",
  successFg: "FF0B6B3F",
  dangerBg: "FFFCE0E0",
  dangerFg: "FF9B1C1C",
  warnBg: "FFFFF3D6",
  warnFg: "FF7A5500",
  accentBg: "FFE8F1FB",
  titleBg: "FF003D7A",
  metaLabel: "FF003D7A",
  thinBorder: "FFD0D7E0",
} as const;

function escCsv(v: unknown): string {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function modeLabel(r: MeasurementRow): string {
  const tech = (r.technology || r.radio_tech || "").toLowerCase();
  if (r.service_mode === "mobile" || ["3g", "4g", "5g"].includes(tech)) {
    return "móvil";
  }
  return "fijo";
}

function techLabel(r: MeasurementRow): string {
  const tech = (r.radio_tech || r.technology || "").toLowerCase();
  if (["3g", "4g", "5g"].includes(tech)) return radioTechLabel(tech);
  return r.technology || "—";
}

function formatFechaLocal(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

/** Fila plana para informe a partir de MeasurementRow (Supabase). */
export function measurementToReportRow(
  r: MeasurementRow
): Record<ReportHeader, string | number | boolean | null> {
  const fecha = r.finished_at || r.created_at || "";
  return {
    id: r.id,
    fecha_hora: fecha ? formatFechaLocal(fecha) : "",
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
  const lines = [REPORT_HEADERS.map((h) => REPORT_LABELS[h]).join(",")];
  for (const r of rows) {
    const row = measurementToReportRow(r);
    lines.push(REPORT_HEADERS.map((h) => escCsv(row[h])).join(","));
  }
  return "\uFEFF" + lines.join("\n");
}

export function measurementsToEnrichedJson(rows: MeasurementRow[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      institution: BRAND.fullName,
      product: BRAND.productName,
      count: rows.length,
      columns: REPORT_HEADERS.map((h) => ({ key: h, label: REPORT_LABELS[h] })),
      rows: rows.map(measurementToReportRow),
    },
    null,
    2
  );
}

type ExcelJSModule = typeof import("exceljs");
type Workbook = import("exceljs").Workbook;
type Worksheet = import("exceljs").Worksheet;

const thinBorder = {
  top: { style: "thin" as const, color: { argb: COLORS.thinBorder } },
  left: { style: "thin" as const, color: { argb: COLORS.thinBorder } },
  bottom: { style: "thin" as const, color: { argb: COLORS.thinBorder } },
  right: { style: "thin" as const, color: { argb: COLORS.thinBorder } },
};

const headerBorder = {
  top: { style: "thin" as const, color: { argb: COLORS.black } },
  left: { style: "thin" as const, color: { argb: COLORS.black } },
  bottom: { style: "thin" as const, color: { argb: COLORS.black } },
  right: { style: "thin" as const, color: { argb: COLORS.black } },
};

async function loadBrandPng(
  path: string
): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function styleHeaderCell(cell: import("exceljs").Cell) {
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.headerBg },
  };
  cell.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: COLORS.headerFg },
  };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  cell.border = headerBorder;
}

async function buildCoverSheet(
  ExcelJS: ExcelJSModule,
  wb: Workbook,
  rows: MeasurementRow[]
): Promise<void> {
  const ws = wb.addWorksheet("Portada", {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  });

  ws.columns = [
    { width: 3 },
    { width: 28 },
    { width: 42 },
    { width: 22 },
    { width: 18 },
  ];

  // Logos
  const [osiptelBuf, escudoBuf] = await Promise.all([
    loadBrandPng(BRAND.assets.osiptelLogo),
    loadBrandPng(BRAND.assets.escudoPng),
  ]);

  if (osiptelBuf) {
    const id = wb.addImage({
      // ExcelJS acepta Uint8Array en navegador
      buffer: new Uint8Array(osiptelBuf) as never,
      extension: "png",
    });
    ws.addImage(id, {
      tl: { col: 1.1, row: 0.4 },
      ext: { width: 160, height: 52 },
    });
  }
  if (escudoBuf) {
    const id = wb.addImage({
      buffer: new Uint8Array(escudoBuf) as never,
      extension: "png",
    });
    ws.addImage(id, {
      tl: { col: 4.1, row: 0.3 },
      ext: { width: 44, height: 56 },
    });
  }

  // Espacio para logos
  for (let r = 1; r <= 4; r++) {
    ws.getRow(r).height = 16;
  }
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 22;
  ws.getRow(3).height = 18;

  // Franja institucional
  ws.mergeCells("B5:E5");
  const band = ws.getCell("B5");
  band.value = "ESTADO PERUANO  ·  gob.pe";
  band.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFBF0909" },
  };
  band.font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: COLORS.white },
  };
  band.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(5).height = 26;

  // Título principal
  ws.mergeCells("B7:E7");
  const title = ws.getCell("B7");
  title.value = BRAND.name;
  title.font = {
    name: "Calibri",
    size: 20,
    bold: true,
    color: { argb: COLORS.osiptelDark },
  };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(7).height = 28;

  ws.mergeCells("B8:E8");
  const full = ws.getCell("B8");
  full.value = BRAND.fullName;
  full.font = {
    name: "Calibri",
    size: 11,
    color: { argb: "FF5A6570" },
    italic: true,
  };
  full.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  ws.getRow(8).height = 32;

  ws.mergeCells("B10:E10");
  const prod = ws.getCell("B10");
  prod.value = `INFORME — ${BRAND.productName.toUpperCase()}`;
  prod.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.titleBg },
  };
  prod.font = {
    name: "Calibri",
    size: 14,
    bold: true,
    color: { argb: COLORS.white },
  };
  prod.alignment = { horizontal: "center", vertical: "middle" };
  prod.border = headerBorder;
  ws.getRow(10).height = 30;

  // Bloque de metadatos
  const si = rows.filter((r) => r.meets_cvm === true).length;
  const no = rows.filter((r) => r.meets_cvm === false).length;
  const na = rows.length - si - no;
  const avgDown =
    rows.length > 0
      ? rows.reduce((a, r) => a + (r.download_mbps ?? 0), 0) / rows.length
      : 0;
  const avgUp =
    rows.length > 0
      ? rows.reduce((a, r) => a + (r.upload_mbps ?? 0), 0) / rows.length
      : 0;

  const meta: [string, string | number][] = [
    ["Fecha de exportación", formatFechaLocal(new Date().toISOString())],
    ["Institución", BRAND.name],
    ["Producto", BRAND.productName],
    ["Total de mediciones", rows.length],
    ["Cumplen CVM (SI)", si],
    ["No cumplen CVM (NO)", no],
    ["Sin resultado CVM", na],
    ["Promedio bajada (Mbps)", Number(avgDown.toFixed(2))],
    ["Promedio subida (Mbps)", Number(avgUp.toFixed(2))],
    ["Umbral CVM", "70 %"],
    ["Sitio web", BRAND.urls.institution],
  ];

  let rowIdx = 12;
  for (const [label, value] of meta) {
    const lab = ws.getCell(rowIdx, 2);
    const val = ws.getCell(rowIdx, 3);
    ws.mergeCells(rowIdx, 3, rowIdx, 5);

    lab.value = label;
    lab.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: COLORS.metaLabel },
    };
    lab.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.surface },
    };
    lab.alignment = { horizontal: "center", vertical: "middle" };
    lab.border = thinBorder;

    val.value = value;
    val.font = { name: "Calibri", size: 11 };
    val.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    val.border = thinBorder;

    // Resaltar filas CVM
    if (label.includes("Cumplen")) {
      val.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.successBg },
      };
      val.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: COLORS.successFg },
      };
    }
    if (label.includes("No cumplen")) {
      val.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.dangerBg },
      };
      val.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: COLORS.dangerFg },
      };
    }

    ws.getRow(rowIdx).height = 22;
    rowIdx++;
  }

  rowIdx += 1;
  ws.mergeCells(rowIdx, 2, rowIdx, 5);
  const note = ws.getCell(rowIdx, 2);
  note.value =
    "Documento de trabajo — MVP regulatorio. Los datos corresponden a mediciones del Medidor de velocidad OSIPTEL. La hoja «Mediciones» contiene el detalle con formato institucional.";
  note.font = {
    name: "Calibri",
    size: 9,
    italic: true,
    color: { argb: "FF6F777B" },
  };
  note.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  ws.getRow(rowIdx).height = 40;

  // Pie
  rowIdx += 2;
  ws.mergeCells(rowIdx, 2, rowIdx, 5);
  const foot = ws.getCell(rowIdx, 2);
  foot.value = BRAND.tagline;
  foot.font = {
    name: "Calibri",
    size: 10,
    italic: true,
    color: { argb: COLORS.osiptelBlue },
  };
  foot.alignment = { horizontal: "center", vertical: "middle" };
}

function buildMeasurementsSheet(
  wb: Workbook,
  rows: MeasurementRow[]
): Worksheet {
  const ws = wb.addWorksheet("Mediciones", {
    views: [{ state: "frozen", ySplit: 2, xSplit: 0 }],
    properties: { defaultRowHeight: 18 },
  });

  const colCount = REPORT_HEADERS.length;

  // Fila 1: título institucional (fondo negro, texto blanco)
  ws.mergeCells(1, 1, 1, colCount);
  const title = ws.getCell(1, 1);
  title.value = `${BRAND.name} — ${BRAND.productName} · Informe de mediciones`;
  title.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COLORS.headerBg },
  };
  title.font = {
    name: "Calibri",
    size: 13,
    bold: true,
    color: { argb: COLORS.headerFg },
  };
  title.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
  title.border = headerBorder;
  ws.getRow(1).height = 28;

  // Aplicar fondo negro a toda la fila 1 (celdas fusionadas)
  for (let c = 1; c <= colCount; c++) {
    const cell = ws.getCell(1, c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.headerBg },
    };
    cell.border = headerBorder;
  }

  // Fila 2: encabezados de columnas
  const headerRow = ws.getRow(2);
  headerRow.height = 36;
  REPORT_HEADERS.forEach((key, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = REPORT_LABELS[key];
    styleHeaderCell(cell);
  });

  // Columnas
  ws.columns = REPORT_HEADERS.map((h) => ({
    key: h,
    width: COL_WIDTHS[h],
  }));

  // Datos
  const numericKeys = new Set<ReportHeader>([
    "ref_bajada_mbps",
    "ref_subida_mbps",
    "bajada_mbps",
    "subida_mbps",
    "latencia_ms",
    "jitter_ms",
    "perdida_pct",
    "bufferbloat_ms",
    "cvm_pct",
    "minimo_garantizado_mbps",
    "latitud",
    "longitud",
    "precision_gps_m",
    "asn",
    "confianza",
    "serie_rep",
    "serie_total",
  ]);

  rows.forEach((raw, idx) => {
    const data = measurementToReportRow(raw);
    const excelRow = ws.getRow(idx + 3);
    excelRow.height = 20;
    const zebra = idx % 2 === 1;

    REPORT_HEADERS.forEach((key, i) => {
      const cell = excelRow.getCell(i + 1);
      const v = data[key];
      cell.value = v === null || v === undefined ? "" : v;
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF26292E" } };
      cell.border = thinBorder;
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: key === "firma_sha256" || key === "isp_organizacion",
      };

      if (zebra) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.zebra },
        };
      }

      // Formato numérico
      if (numericKeys.has(key) && typeof v === "number") {
        if (
          key.includes("mbps") ||
          key === "cvm_pct" ||
          key === "perdida_pct" ||
          key === "latitud" ||
          key === "longitud" ||
          key === "confianza"
        ) {
          cell.numFmt = "0.00";
        } else {
          cell.numFmt = "0.##";
        }
      }

      // Resaltar Cumple CVM
      if (key === "cumple_cvm") {
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: {
            argb:
              v === "SI"
                ? COLORS.successFg
                : v === "NO"
                  ? COLORS.dangerFg
                  : "FF5A6570",
          },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              v === "SI"
                ? COLORS.successBg
                : v === "NO"
                  ? COLORS.dangerBg
                  : COLORS.warnBg,
          },
        };
      }

      // Resaltar % CVM
      if (key === "cvm_pct" && typeof v === "number") {
        const ok = v >= 70;
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: ok ? COLORS.successFg : COLORS.dangerFg },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ok ? COLORS.successBg : COLORS.dangerBg },
        };
      }

      // Resaltar bajada/subida medidas
      if (
        (key === "bajada_mbps" || key === "subida_mbps") &&
        typeof v === "number"
      ) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.accentBg },
        };
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: COLORS.osiptelDark },
        };
      }
    });
  });

  // AutoFilter sobre encabezados
  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2 + rows.length, column: colCount },
  };

  // Pie de hoja
  const footerRow = 3 + rows.length + 1;
  ws.mergeCells(footerRow, 1, footerRow, Math.min(6, colCount));
  const foot = ws.getCell(footerRow, 1);
  foot.value = `${BRAND.name} · ${BRAND.urls.institution} · Generado ${formatFechaLocal(new Date().toISOString())}`;
  foot.font = {
    name: "Calibri",
    size: 9,
    italic: true,
    color: { argb: "FF6F777B" },
  };
  foot.alignment = { horizontal: "center", vertical: "middle" };

  return ws;
}

function buildSummarySheet(wb: Workbook, rows: MeasurementRow[]): void {
  const ws = wb.addWorksheet("Resumen", {
    properties: { defaultRowHeight: 20 },
  });

  ws.columns = [
    { width: 32 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  // Título
  ws.mergeCells("A1:D1");
  const t = ws.getCell("A1");
  t.value = "RESUMEN ESTADÍSTICO — CUMPLIMIENTO CVM";
  styleHeaderCell(t);
  ws.getRow(1).height = 28;
  for (let c = 1; c <= 4; c++) {
    styleHeaderCell(ws.getCell(1, c));
  }

  // Encabezados
  const headers = ["Indicador", "Valor", "Unidad", "Observación"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(2, i + 1);
    cell.value = h;
    styleHeaderCell(cell);
  });
  ws.getRow(2).height = 24;

  const si = rows.filter((r) => r.meets_cvm === true).length;
  const no = rows.filter((r) => r.meets_cvm === false).length;
  const downs = rows
    .map((r) => r.download_mbps)
    .filter((n): n is number => typeof n === "number");
  const ups = rows
    .map((r) => r.upload_mbps)
    .filter((n): n is number => typeof n === "number");
  const cvms = rows
    .map((r) => r.cvm_pct)
    .filter((n): n is number => typeof n === "number");

  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const min = (arr: number[]) => (arr.length ? Math.min(...arr) : 0);
  const max = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);

  const stats: [string, string | number, string, string][] = [
    ["Total mediciones", rows.length, "registros", "Filas exportadas"],
    ["Cumplen CVM", si, "SI", "≥ 70 % del plan de referencia"],
    ["No cumplen CVM", no, "NO", "Por debajo del umbral"],
    [
      "Tasa de cumplimiento",
      rows.length ? Number(((si / rows.length) * 100).toFixed(1)) : 0,
      "%",
      "SI / total",
    ],
    ["Bajada promedio", Number(avg(downs).toFixed(2)), "Mbps", "download_mbps"],
    ["Bajada mínima", Number(min(downs).toFixed(2)), "Mbps", ""],
    ["Bajada máxima", Number(max(downs).toFixed(2)), "Mbps", ""],
    ["Subida promedio", Number(avg(ups).toFixed(2)), "Mbps", "upload_mbps"],
    ["CVM % promedio", Number(avg(cvms).toFixed(1)), "%", "cvm_pct"],
    ["CVM % mínimo", Number(min(cvms).toFixed(1)), "%", ""],
    ["CVM % máximo", Number(max(cvms).toFixed(1)), "%", ""],
  ];

  stats.forEach((row, idx) => {
    const r = idx + 3;
    row.forEach((val, c) => {
      const cell = ws.getCell(r, c + 1);
      cell.value = val;
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = thinBorder;
      if (idx % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.zebra },
        };
      }
    });

    // Resaltar cumple / no cumple
    if (row[0] === "Cumplen CVM") {
      for (let c = 1; c <= 4; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.successBg },
        };
        cell.font = {
          name: "Calibri",
          size: 11,
          bold: true,
          color: { argb: COLORS.successFg },
        };
      }
    }
    if (row[0] === "No cumplen CVM") {
      for (let c = 1; c <= 4; c++) {
        const cell = ws.getCell(r, c);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.dangerBg },
        };
        cell.font = {
          name: "Calibri",
          size: 11,
          bold: true,
          color: { argb: COLORS.dangerFg },
        };
      }
    }
  });

  // Por operador
  const byOp = new Map<string, { n: number; si: number }>();
  for (const r of rows) {
    const op = r.operator || r.isp_brand || "Sin operador";
    const cur = byOp.get(op) || { n: 0, si: 0 };
    cur.n += 1;
    if (r.meets_cvm === true) cur.si += 1;
    byOp.set(op, cur);
  }

  let start = 3 + stats.length + 2;
  ws.mergeCells(start, 1, start, 4);
  const opTitle = ws.getCell(start, 1);
  opTitle.value = "DESGLOSE POR OPERADOR / ISP";
  styleHeaderCell(opTitle);
  for (let c = 1; c <= 4; c++) styleHeaderCell(ws.getCell(start, c));
  ws.getRow(start).height = 24;

  start += 1;
  ["Operador", "Mediciones", "Cumplen CVM", "% Cumplimiento"].forEach(
    (h, i) => {
      const cell = ws.getCell(start, i + 1);
      cell.value = h;
      styleHeaderCell(cell);
    }
  );

  let rIdx = start + 1;
  for (const [op, v] of [...byOp.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "es")
  )) {
    const pct = v.n ? Number(((v.si / v.n) * 100).toFixed(1)) : 0;
    const vals = [op, v.n, v.si, pct];
    vals.forEach((val, c) => {
      const cell = ws.getCell(rIdx, c + 1);
      cell.value = val;
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = thinBorder;
      if ((rIdx - start) % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.zebra },
        };
      }
    });
    rIdx++;
  }
}

/**
 * Excel .xlsx institucional con:
 * - Portada (logos OSIPTEL + escudo)
 * - Mediciones (encabezados negros, texto centrado, celdas resaltadas)
 * - Resumen estadístico
 */
export async function measurementsToEnrichedXlsx(
  rows: MeasurementRow[]
): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default as ExcelJSModule;

  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND.name;
  wb.lastModifiedBy = BRAND.productName;
  wb.created = new Date();
  wb.modified = new Date();
  wb.title = `Informe ${BRAND.productName} — ${BRAND.name}`;
  wb.subject = "Mediciones de velocidad de internet";
  wb.company = BRAND.fullName;
  wb.description = `Exportación de ${rows.length} mediciones · ${BRAND.urls.institution}`;

  await buildCoverSheet(ExcelJS, wb, rows);
  buildMeasurementsSheet(wb, rows);
  buildSummarySheet(wb, rows);

  const buffer = await wb.xlsx.writeBuffer();
  if (buffer instanceof ArrayBuffer) return buffer;
  // Node Buffer / Uint8Array
  const u8 = new Uint8Array(buffer as ArrayBuffer);
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}

export function downloadXlsx(filename: string, buffer: ArrayBuffer): void {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
