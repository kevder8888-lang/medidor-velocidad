import { BRAND } from "./brand";
import { shortHash } from "./signature";
import { formatMbps, formatMs } from "./stats";
import type { SpeedTestResult } from "./types";

type ExportMode = "print" | "html";

export type PdfExportOutcome =
  | { ok: true; mode: "print" | "html" | "download-html" }
  | { ok: false; error: string };

const logoCache: { osiptel?: string; escudo?: string } = {};

async function assetToDataUrl(path: string): Promise<string> {
  const url = path.startsWith("http") ? path : `${window.location.origin}${path}`;
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("FileReader falló"));
    reader.readAsDataURL(blob);
  });
}

async function getEmbeddedLogos(): Promise<{ osiptel: string; escudo: string }> {
  if (!logoCache.osiptel || !logoCache.escudo) {
    const [osiptel, escudo] = await Promise.all([
      assetToDataUrl(BRAND.assets.osiptelLogo),
      assetToDataUrl(BRAND.assets.escudo),
    ]);
    logoCache.osiptel = osiptel;
    logoCache.escudo = escudo;
  }
  return { osiptel: logoCache.osiptel!, escudo: logoCache.escudo! };
}

function safeNum(n: unknown, fallback = 0): number {
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function buildReportHtml(
  result: SpeedTestResult,
  logos: { osiptel: string; escudo: string }
): string {
  const conf = result.confidence ?? {
    score: 0,
    level: "baja" as const,
    factors: [],
    validForRegulatoryCvm: false,
  };
  const download = result.download ?? {
    medianMbps: 0,
    p10Mbps: 0,
    p90Mbps: 0,
    streams: 0,
  };
  const upload = result.upload ?? {
    medianMbps: 0,
    p10Mbps: 0,
    p90Mbps: 0,
    streams: 0,
  };
  const latency = result.latency ?? {
    medianMs: 0,
    jitterMs: 0,
    packetLossPct: 0,
  };
  const plan = result.plan ?? {
    downMbps: 0,
    upMbps: null,
    operator: "",
    technology: "",
  };
  const notesArr = Array.isArray(result.notes) ? result.notes : [];
  const factorsArr = Array.isArray(conf.factors) ? conf.factors : [];

  const cvmLine = result.cvm
    ? result.cvm.meetsCvm
      ? `CUMPLE CVM (${result.cvm.cvmPct}% del plan ≥ ${result.cvm.thresholdPct}%)`
      : `NO CUMPLE CVM (${result.cvm.cvmPct}% del plan; mínimo ${result.cvm.minGuaranteedDownMbps} Mbps)`
    : "CVM no calculado";

  const valid = conf.validForRegulatoryCvm
    ? "Válido como referencia CVM (según score/servidor)"
    : "NO válido para CVM regulatorio";

  const meta = result.serverMeta;
  const metaBits = [
    meta?.clientIp ? `IP: ${meta.clientIp}` : null,
    meta?.colo ? `PoP: ${meta.colo}` : null,
    meta?.city ? `Ciudad: ${meta.city}` : null,
    meta?.country ? `País: ${meta.country}` : null,
    meta?.asn != null ? `ASN: ${meta.asn}` : null,
    meta?.asOrganization ? `AS: ${meta.asOrganization}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const notes = notesArr.length
    ? `<ul>${notesArr.map((n) => `<li>${escapeHtml(String(n))}</li>`).join("")}</ul>`
    : "<p>Ninguna</p>";

  const factors = factorsArr
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.label)}</td><td>${f.impact}</td><td>${escapeHtml(f.detail)}</td></tr>`
    )
    .join("");

  const idShort = (result.id || "sin-id").slice(0, 8);
  const finished = result.finishedAt
    ? new Date(result.finishedAt).toLocaleString("es-PE")
    : "—";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Informe medición ${escapeHtml(idShort)} · ${escapeHtml(BRAND.name)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font-family: "Segoe UI", system-ui, sans-serif; color: #26292E; margin: 0; line-height: 1.45; background: #fff; }
    .topbar { background: #BF0909; color: #fff; padding: 8px 28px; display: flex; align-items: center; gap: 12px; font-size: 12px; font-weight: 600; }
    .topbar img { height: 28px; width: auto; }
    .header { padding: 20px 28px 12px; border-bottom: 3px solid #0056AC; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
    .header img.logo { height: 52px; width: auto; max-width: 180px; object-fit: contain; }
    .header h1 { font-size: 1.35rem; margin: 0 0 2px; color: #003D7A; }
    .header .sub { color: #6F777B; font-size: 0.9rem; margin: 0; }
    .body { padding: 20px 28px 32px; }
    h2 { font-size: 0.82rem; text-transform: uppercase; letter-spacing: .06em; color: #0056AC; margin: 22px 0 8px; border-bottom: 1px solid #D5E3F2; padding-bottom: 4px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; margin: 2px 4px 2px 0; }
    .ok { background: #e8f7f0; color: #146c48; }
    .bad { background: #fde8e8; color: #8a1515; }
    .warn { background: #fff4e0; color: #8a5a00; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
    .card { border: 1px solid #D5E3F2; border-radius: 10px; padding: 12px 14px; background: #EFF5FC; }
    .card .l { font-size: 12px; color: #6F777B; font-weight: 600; }
    .card .v { font-size: 1.45rem; font-weight: 750; color: #003D7A; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E6EEF7; vertical-align: top; }
    th { color: #6F777B; font-weight: 600; width: 38%; }
    .mono { font-family: ui-monospace, Consolas, monospace; font-size: 12px; word-break: break-all; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #0056AC; font-size: 11px; color: #6F777B; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; padding: 12px 28px 0; }
    .toolbar button {
      padding: 10px 14px; cursor: pointer; background: #0056AC; color: #fff;
      border: none; border-radius: 8px; font-weight: 700; font-size: 14px;
    }
    .toolbar button.secondary { background: #fff; color: #0056AC; border: 1px solid #A8C6E8; }
    .hint { padding: 0 28px; margin-top: 8px; font-size: 12px; color: #6F777B; }
    @media print {
      .toolbar, .hint, .noprint { display: none !important; }
      body { margin: 0; }
    }
  </style>
</head>
<body>
  <div class="toolbar noprint">
    <button type="button" id="btn-print">Imprimir / Guardar como PDF</button>
    <button type="button" class="secondary" id="btn-close">Cerrar</button>
  </div>
  <p class="hint noprint">En el diálogo de impresión elige <strong>Guardar como PDF</strong> o Microsoft Print to PDF.</p>
  <div class="topbar">
    <img src="${logos.escudo}" alt="Escudo del Perú" />
    <span>Plataforma del Estado Peruano · ${escapeHtml(BRAND.name)}</span>
  </div>
  <div class="header">
    <img class="logo" src="${logos.osiptel}" alt="${escapeHtml(BRAND.name)}" />
    <div>
      <h1>Informe de medición de velocidad</h1>
      <p class="sub">${escapeHtml(BRAND.fullName)} · ${escapeHtml(finished)}</p>
      <p class="sub">Protocolo ${escapeHtml(result.protocolVersion || "—")} · Cliente ${escapeHtml(result.clientVersion || "—")}</p>
    </div>
  </div>
  <div class="body">
  <p>
    <span class="badge ${result.cvm?.meetsCvm ? "ok" : result.cvm ? "bad" : "warn"}">${escapeHtml(cvmLine)}</span>
    <span class="badge ${conf.validForRegulatoryCvm ? "ok" : "warn"}">${escapeHtml(valid)}</span>
  </p>

  <div class="grid">
    <div class="card"><div class="l">Bajada (mediana)</div><div class="v">${formatMbps(safeNum(download.medianMbps))} <small>Mbps</small></div></div>
    <div class="card"><div class="l">Subida (mediana)</div><div class="v">${formatMbps(safeNum(upload.medianMbps))} <small>Mbps</small></div></div>
    <div class="card"><div class="l">Latencia / jitter</div><div class="v">${formatMs(safeNum(latency.medianMs))} <small>ms</small></div>
      <div class="l">Jitter ${formatMs(safeNum(latency.jitterMs))} ms · pérdida ${safeNum(latency.packetLossPct)}%</div>
    </div>
  </div>

  <h2>Plan y CVM</h2>
  <table>
    <tr><th>Operador</th><td>${escapeHtml(plan.operator || "—")}</td></tr>
    <tr><th>Tecnología</th><td>${escapeHtml(String(plan.technology || "—"))}</td></tr>
    <tr><th>Plan contratado</th><td>${plan.downMbps ?? "—"} / ${plan.upMbps ?? "—"} Mbps</td></tr>
    <tr><th>Mínimo garantizado (70%)</th><td>${result.cvm ? formatMbps(result.cvm.minGuaranteedDownMbps) + " Mbps" : "—"}</td></tr>
    <tr><th>CVM %</th><td>${result.cvm ? result.cvm.cvmPct + "%" : "—"}</td></tr>
    <tr><th>Asimetría medida up/down</th><td>${result.cvm ? result.cvm.asymmetryMeasuredRatio : "—"}</td></tr>
    <tr><th>Bufferbloat (Δ)</th><td>${result.bufferbloatMs != null ? "+" + formatMs(result.bufferbloatMs) + " ms" : "—"}</td></tr>
  </table>

  <h2>Servidor y entorno</h2>
  <table>
    <tr><th>Servidor</th><td>${escapeHtml(result.selectedServer?.name || "—")} (${escapeHtml(result.selectedServer?.region || "")})</td></tr>
    <tr><th>Tipo</th><td>${escapeHtml(result.selectedServer?.kind || "—")}${result.selectedServer?.isLoopback ? " · LOOPBACK" : ""}</td></tr>
    <tr><th>Meta red</th><td>${escapeHtml(metaBits || "—")}</td></tr>
    <tr><th>Acceso</th><td>${escapeHtml(result.precheck?.connectionType || "—")} · conf. ${conf.score} (${conf.level})</td></tr>
    <tr><th>Inicio / fin</th><td>${escapeHtml(result.startedAt || "—")} → ${escapeHtml(result.finishedAt || "—")}</td></tr>
    <tr><th>Streams bajada / subida</th><td>${download.streams ?? "—"} / ${upload.streams ?? "—"}</td></tr>
    <tr><th>P10–P90 bajada</th><td>${formatMbps(safeNum(download.p10Mbps))} – ${formatMbps(safeNum(download.p90Mbps))} Mbps</td></tr>
  </table>

  <h2>Factores de confianza</h2>
  <table>
    <thead><tr><th>Factor</th><th>Impacto</th><th>Detalle</th></tr></thead>
    <tbody>${factors || "<tr><td colspan=3>—</td></tr>"}</tbody>
  </table>

  <h2>Notas</h2>
  ${notes}

  <h2>Integridad (firma)</h2>
  <table>
    <tr><th>ID prueba</th><td class="mono">${escapeHtml(result.id || "—")}</td></tr>
    <tr><th>Algoritmo</th><td>${escapeHtml(result.signature?.algorithm || "—")}</td></tr>
    <tr><th>SHA-256</th><td class="mono">${escapeHtml(result.signature?.hash || "—")}</td></tr>
    <tr><th>Corto</th><td class="mono">${escapeHtml(result.signature?.hash ? shortHash(result.signature.hash, 16) : "—")}</td></tr>
    <tr><th>Firmado</th><td>${escapeHtml(result.signature?.signedAt || "—")}</td></tr>
  </table>

  <p class="footer">
    ${escapeHtml(BRAND.fullName)} (${escapeHtml(BRAND.name)}). ${escapeHtml(BRAND.tagline)}.<br/>
    Documento generado por ${escapeHtml(BRAND.productName)} MVP. La firma SHA-256 cubre el payload canónico de métricas
    (no es firma PKI con certificado). Uso orientativo; para fiscalización plena se requiere procedimiento OSIPTEL.
  </p>
  </div>
  <script>
    (function () {
      var btn = document.getElementById("btn-print");
      var closeBtn = document.getElementById("btn-close");
      if (btn) btn.addEventListener("click", function () { window.print(); });
      if (closeBtn) closeBtn.addEventListener("click", function () { window.close(); });
      function whenReady(cb) {
        var imgs = Array.prototype.slice.call(document.images || []);
        if (!imgs.length) { cb(); return; }
        var left = imgs.length;
        function done() { left -= 1; if (left <= 0) cb(); }
        imgs.forEach(function (img) {
          if (img.complete) done();
          else {
            img.addEventListener("load", done);
            img.addEventListener("error", done);
          }
        });
        setTimeout(cb, 2500);
      }
      whenReady(function () {
        setTimeout(function () {
          try { window.focus(); window.print(); } catch (e) {}
        }, 200);
      });
    })();
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadHtmlFile(filename: string, html: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

/**
 * Exporta informe para imprimir / Guardar como PDF.
 * - No usa `noopener` (rompe window.open → null).
 * - Logos embebidos en base64 (imprimen sin depender del origin).
 * - Si el popup está bloqueado, descarga HTML del informe.
 */
export async function exportResultPdf(
  result: SpeedTestResult,
  _mode: ExportMode = "print"
): Promise<PdfExportOutcome> {
  try {
    if (!result?.id) {
      return { ok: false, error: "No hay un resultado válido para exportar." };
    }

    const logos = await getEmbeddedLogos();
    const html = buildReportHtml(result, logos);
    const idShort = result.id.slice(0, 8);
    const filename = `informe-osiptel-${idShort}.html`;

    // Importante: NO incluir noopener/noreferrer en features (devuelve null).
    const w = window.open("about:blank", "_blank", "width=920,height=1000");
    if (!w) {
      downloadHtmlFile(filename, html);
      return {
        ok: true,
        mode: "download-html",
      };
    }

    w.document.open();
    w.document.write(html);
    w.document.close();
    return { ok: true, mode: "print" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al exportar PDF";
    return { ok: false, error: msg };
  }
}

/** Descarga siempre el HTML del informe (útil si el usuario prefiere no usar popup). */
export async function downloadResultReportHtml(
  result: SpeedTestResult
): Promise<PdfExportOutcome> {
  try {
    if (!result?.id) {
      return { ok: false, error: "No hay un resultado válido para exportar." };
    }
    const logos = await getEmbeddedLogos();
    const html = buildReportHtml(result, logos);
    downloadHtmlFile(`informe-osiptel-${result.id.slice(0, 8)}.html`, html);
    return { ok: true, mode: "html" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al descargar informe";
    return { ok: false, error: msg };
  }
}

export function exportResultJson(result: SpeedTestResult): void {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `medicion-${(result.id || "sin-id").slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
