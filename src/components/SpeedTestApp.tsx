"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AggregatesPanel } from "@/components/AggregatesPanel";
import { BrandFooter } from "@/components/BrandFooter";
import { BrandHeader } from "@/components/BrandHeader";
import { MapPanel } from "@/components/MapPanel";
import { Sparkline } from "@/components/Sparkline";
import { SplashScreen } from "@/components/SplashScreen";
import type { DeviceGeo } from "@/lib/geo";
import { formatCoords, getDevicePosition } from "@/lib/geo";
import {
  deviceGeoToResultGeo,
  summarizeMeasurement,
  withResolvedPlan,
} from "@/lib/measurementRecord";
import {
  clearHistory,
  downloadTextFile,
  exportHistoryJson,
  loadHistory,
  removeResult,
  saveResult,
} from "@/lib/history";
import { getMeasurementServers, runSpeedTest } from "@/lib/measure";
import {
  CLIENT_VERSION,
  CVM_THRESHOLD_PCT,
  PROTOCOL_VERSION,
} from "@/lib/servers";
import {
  downloadResultReportHtml,
  exportResultJson,
  exportResultPdf,
} from "@/lib/pdfExport";
import {
  accessKindLabel,
  categoryLabel,
  fetchIspMeta,
  formatLocation,
  identifyFromMeta,
  mapAccessKind,
  suggestOperatorName,
  type IspIdentity,
  type NetworkAccessKind,
} from "@/lib/isp";
import { isAndroid, releaseWakeLock, requestWakeLock } from "@/lib/mobile";
import { runPrecheck } from "@/lib/precheck";
import { shortHash } from "@/lib/signature";
import { formatMbps, formatMs } from "@/lib/stats";
import type {
  MeasurementServer,
  ProgressEvent,
  ServerProbe,
  SpeedTestResult,
  TestPhase,
  UserPlan,
} from "@/lib/types";

const PLAN_KEY = "osiptel_medidor_plan_v1";
const SERVER_KEY = "osiptel_medidor_server_pref_v1";

const PHASE_LABEL: Record<TestPhase, string> = {
  idle: "Listo",
  precheck: "Pre-chequeo",
  server_select: "Servidores",
  latency: "Latencia",
  download: "Bajada",
  upload: "Subida",
  loaded_latency: "Latencia bajo carga",
  done: "Completado",
  error: "Error",
};

function loadPlan(): UserPlan {
  if (typeof window === "undefined") {
    return { downMbps: 100, upMbps: 50, operator: "", technology: "ftth" };
  }
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (raw) return JSON.parse(raw) as UserPlan;
  } catch {
    /* ignore */
  }
  return { downMbps: 100, upMbps: 50, operator: "", technology: "ftth" };
}

type TabId = "medir" | "mapa" | "historial";

const REPS_KEY = "osiptel_medidor_reps_v1";

export function SpeedTestApp() {
  const [plan, setPlan] = useState<UserPlan>({
    downMbps: 100,
    upMbps: 50,
    operator: "",
    technology: "ftth",
  });
  const [serverPref, setServerPref] = useState<string>("auto");
  const [servers, setServers] = useState<MeasurementServer[]>([]);
  const [probes, setProbes] = useState<ServerProbe[]>([]);
  const [running, setRunning] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressEvent>({
    phase: "idle",
    progress: 0,
    message: "Configura tu plan y pulsa Iniciar medición",
  });
  const [result, setResult] = useState<SpeedTestResult | null>(null);
  const [history, setHistory] = useState<SpeedTestResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("medir");
  const [android, setAndroid] = useState(false);
  const [planOpen, setPlanOpen] = useState(true);
  const [liveAccess, setLiveAccess] = useState<NetworkAccessKind>("unknown");
  const [liveIsp, setLiveIsp] = useState<IspIdentity | null>(null);
  const [ispLoading, setIspLoading] = useState(true);
  /** Número de repeticiones de la prueba (1–10) — valor efectivo */
  const [reps, setReps] = useState(1);
  /** Texto del input (permite borrar y reescribir) */
  const [repsText, setRepsText] = useState("1");
  const [repProgress, setRepProgress] = useState({ current: 0, total: 0 });
  const [deviceGeo, setDeviceGeo] = useState<DeviceGeo | null>(null);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    setPlan(loadPlan());
    setHistory(loadHistory());
    setServers(getMeasurementServers());
    setAndroid(isAndroid());
    try {
      const pref = localStorage.getItem(SERVER_KEY);
      if (pref) setServerPref(pref);
      const r = localStorage.getItem(REPS_KEY);
      if (r) {
        const n = Math.min(10, Math.max(1, Number(r) || 1));
        setReps(n);
        setRepsText(String(n));
      }
    } catch {
      /* ignore */
    }

    // Detect access type + ISP as soon as the app opens (no need to wait for a test)
    void (async () => {
      setIspLoading(true);
      try {
        const pre = await runPrecheck();
        const access = mapAccessKind(pre.connectionType, pre.networkTypeRaw);
        setLiveAccess(access);
        const meta = await fetchIspMeta();
        const isp = identifyFromMeta(meta, access);
        setLiveIsp(isp);
        // Auto-fill operator only if the user left it empty
        const suggested = suggestOperatorName(isp);
        if (suggested) {
          setPlan((p) =>
            p.operator?.trim() ? p : { ...p, operator: suggested }
          );
        }
      } catch {
        /* ignore */
      } finally {
        setIspLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    } catch {
      /* ignore */
    }
  }, [plan]);

  useEffect(() => {
    try {
      localStorage.setItem(SERVER_KEY, serverPref);
    } catch {
      /* ignore */
    }
  }, [serverPref]);

  useEffect(() => {
    try {
      localStorage.setItem(REPS_KEY, String(reps));
    } catch {
      /* ignore */
    }
  }, [reps]);

  const gaugeValue = useMemo(() => {
    if (progress.liveMbps != null && running) return progress.liveMbps;
    if (result) return result.download.medianMbps;
    return 0;
  }, [progress.liveMbps, running, result]);

  const gaugePct = useMemo(() => {
    const p = Math.min(300, Math.max(0, gaugeValue)) / 300;
    return p * 300;
  }, [gaugeValue]);

  const onProgress = useCallback((ev: ProgressEvent) => {
    setProgress(ev);
  }, []);

  async function handleExportPdf(target: SpeedTestResult) {
    setError(null);
    setInfo(null);
    setExportingId(target.id);
    try {
      const out = await exportResultPdf(target);
      if (!out.ok) {
        setError(out.error);
        return;
      }
      if (out.mode === "download-html") {
        setInfo(
          "El navegador bloqueó la ventana del informe. Se descargó un HTML: ábrelo y usa Imprimir → Guardar como PDF."
        );
      } else {
        setInfo(
          "Informe abierto. En el diálogo elige «Guardar como PDF» o Microsoft Print to PDF."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar el PDF");
    } finally {
      setExportingId(null);
    }
  }

  async function handleDownloadHtml(target: SpeedTestResult) {
    setError(null);
    setInfo(null);
    setExportingId(target.id);
    try {
      const out = await downloadResultReportHtml(target);
      if (!out.ok) setError(out.error);
      else setInfo("Informe HTML descargado. Ábrelo e imprime como PDF si lo necesitas.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el informe");
    } finally {
      setExportingId(null);
    }
  }

  function applyNetworkFromResult(res: SpeedTestResult) {
    if (!res.networkIdentity) return;
    setLiveAccess(res.networkIdentity.access);
    const isp: IspIdentity = {
      brand: res.networkIdentity.isp.brand,
      organization: res.networkIdentity.isp.organization,
      asn: res.networkIdentity.isp.asn,
      clientIp: res.networkIdentity.isp.clientIp,
      country: res.networkIdentity.isp.country,
      city: res.networkIdentity.isp.city,
      colo: res.networkIdentity.isp.colo,
      source: res.networkIdentity.isp.source as IspIdentity["source"],
      category: res.networkIdentity.isp.category as IspIdentity["category"],
      displayName: res.networkIdentity.isp.displayName,
      confidence: res.networkIdentity.isp.confidence,
      notes: res.networkIdentity.isp.notes,
    };
    setLiveIsp(isp);
    const suggested = suggestOperatorName(isp);
    if (suggested) {
      setPlan((p) => (p.operator?.trim() ? p : { ...p, operator: suggested }));
    }
  }

  async function start() {
    if (running) return;
    if (!plan.downMbps || plan.downMbps <= 0) {
      setError("Indica la velocidad de bajada contratada (Mbps).");
      return;
    }
    const total = Math.min(10, Math.max(1, reps));
    setError(null);
    setInfo(null);
    setRunning(true);
    setResult(null);
    setProbes([]);
    setTab("medir");
    setRepProgress({ current: 0, total });
    setProgress({
      phase: "precheck",
      progress: 1,
      message: total > 1 ? `Iniciando serie de ${total} mediciones…` : "Iniciando…",
    });

    try {
      document.getElementById("measure-card")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } catch {
      /* ignore */
    }

    const wake = await requestWakeLock();
    let last: SpeedTestResult | null = null;
    let saveOk = true;
    let hist = loadHistory();
    let geoFailNote: string | null = null;

    try {
      for (let i = 0; i < total; i++) {
        setRepProgress({ current: i + 1, total });

        // Ubicación actual del dispositivo en CADA medición (hora GPS fresca)
        let geoCapture: DeviceGeo | null = null;
        try {
          onProgress({
            phase: "precheck",
            progress: (i / total) * 100 + 1,
            message:
              total > 1
                ? `Repetición ${i + 1}/${total} · Obteniendo ubicación GPS…`
                : "Obteniendo ubicación GPS del dispositivo…",
          });
          geoCapture = await getDevicePosition({
            highAccuracy: true,
            timeoutMs: 15_000,
            maximumAgeMs: 0, // forzar lectura actual, no caché vieja
          });
          setDeviceGeo(geoCapture);
          geoFailNote = null;
        } catch (geoErr) {
          geoFailNote =
            geoErr instanceof Error
              ? geoErr.message
              : "Sin GPS del dispositivo";
          // reutilizar última conocida solo si existe
          geoCapture = deviceGeo;
        }

        const res = await runSpeedTest(
          plan,
          (ev) => {
            const base = (i / total) * 100;
            const slice = ev.progress / total;
            onProgress({
              ...ev,
              progress: Math.min(99, base + slice),
              message:
                total > 1
                  ? `Repetición ${i + 1}/${total} · ${ev.message}`
                  : ev.message,
            });
          },
          serverPref as "auto" | string
        );

        const measuredAt = res.finishedAt || new Date().toISOString();
        const geo = geoCapture
          ? {
              ...deviceGeoToResultGeo(geoCapture),
              // alinear sello de tiempo con el fin de la medición
              timestamp: measuredAt,
            }
          : null;

        const resolvedPlan = withResolvedPlan(res, plan);

        const enriched: SpeedTestResult = {
          ...res,
          finishedAt: measuredAt,
          plan: resolvedPlan,
          geo,
          runIndex: i + 1,
          runTotal: total,
          notes: [
            ...res.notes,
            total > 1 ? `Serie: repetición ${i + 1} de ${total}.` : null,
            geo
              ? `Ubicación guardada: ${formatCoords(geo.latitude, geo.longitude)} (${geo.accuracyM != null ? `±${Math.round(geo.accuracyM)} m` : "precisión N/D"}) · ${new Date(measuredAt).toLocaleString("es-PE")}.`
              : `Sin ubicación GPS: ${geoFailNote || "permiso denegado o no disponible"}.`,
            `Operador: ${resolvedPlan.operator || "—"}.`,
            `↓ ${res.download.medianMbps} Mbps · ↑ ${res.upload.medianMbps} Mbps · lat ${res.latency.medianMs} ms.`,
          ].filter(Boolean) as string[],
        };

        // sincronizar plan UI si se rellenó operador
        if (resolvedPlan.operator && !plan.operator?.trim()) {
          setPlan((p) => ({ ...p, operator: resolvedPlan.operator }));
        }

        setResult(enriched);
        setProbes(enriched.serverProbes ?? []);
        applyNetworkFromResult(enriched);
        const saved = saveResult(enriched);
        hist = saved.history;
        setHistory(hist);
        if (!saved.ok) saveOk = false;
        last = enriched;
      }

      if (last) {
        setProgress({
          phase: "done",
          progress: 100,
          message:
            total > 1
              ? `Serie completada (${total} mediciones)`
              : "Prueba completada",
          liveMbps: last.download.medianMbps,
        });
        setInfo(
          saveOk
            ? total > 1
              ? `${total} mediciones guardadas en el historial.`
              : "Medición guardada en el historial de este dispositivo."
            : "Serie terminada, pero hubo un problema al guardar el historial."
        );
      }

      try {
        document.getElementById("results-anchor")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      } catch {
        /* ignore */
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Error inesperado durante la medición";
      setError(msg);
      setProgress({
        phase: "error",
        progress: 0,
        message: msg,
      });
    } finally {
      setRunning(false);
      setRepProgress({ current: 0, total: 0 });
      await releaseWakeLock(wake);
    }
  }

  const selectedServerLabel = useMemo(() => {
    if (serverPref === "auto") return "Automático (mejor RTT no-loopback)";
    const s = servers.find((x) => x.id === serverPref);
    return s ? `${s.name} · ${s.region}` : serverPref;
  }, [serverPref, servers]);

  const cvmClass = result?.cvm
    ? result.cvm.meetsCvm
      ? "ok"
      : "bad"
    : "warn";

  const samples =
    result?.download?.samplesMbps?.length
      ? result.download.samplesMbps
      : result?.download?.windowsMbps ?? [];

  const ispPanel = (
    <>
      {android && (
        <div className="android-tip" role="note">
          <strong>Android:</strong>{" "}
          {liveAccess === "cellular" ? (
            <>
              estás en <strong>datos móviles</strong> — el operador se estima por
              IP (no por SIM). Cierra apps y deja la pantalla encendida.
            </>
          ) : liveAccess === "wifi" ? (
            <>
              estás en <strong>Wi‑Fi</strong> (ISP del hogar). Para medir y
              detectar el operador móvil, desactiva Wi‑Fi y usa solo datos.
            </>
          ) : (
            <>
              cierra descargas y apps en segundo plano. Deja la pantalla encendida
              (~30 s). Puedes «Añadir a pantalla de inicio».
            </>
          )}
        </div>
      )}

      <section className="card isp-card" aria-live="polite">
        <h2>Red e ISP detectados</h2>
        {ispLoading && !liveIsp ? (
          <p className="muted-p">Identificando IP pública y proveedor…</p>
        ) : (
          <>
            <div className="isp-hero">
              <div>
                <div className="isp-label">
                  {liveAccess === "cellular"
                    ? "Operador estimado (datos móviles)"
                    : liveAccess === "wifi"
                      ? "ISP de la red Wi‑Fi"
                      : "ISP / proveedor"}
                </div>
                <div className="isp-name">
                  {liveIsp?.displayName ?? "No identificado"}
                </div>
                <div className="isp-sub">
                  {liveIsp ? categoryLabel(liveIsp.category) : "Sin datos de ASN"}
                  {liveIsp?.confidence
                    ? ` · confianza ${liveIsp.confidence}`
                    : ""}
                </div>
              </div>
              <span
                className={`pill ${
                  liveAccess === "cellular"
                    ? "media"
                    : liveAccess === "wifi"
                      ? "media"
                      : "alta"
                }`}
              >
                {accessKindLabel(liveAccess)}
              </span>
            </div>
            <div className="kv">
              <div className="kv-row">
                <span className="k">Organización (ASN)</span>
                <span className="v">
                  {liveIsp?.organization || "—"}
                  {liveIsp?.asn != null ? ` · AS${liveIsp.asn}` : ""}
                </span>
              </div>
              <div className="kv-row">
                <span className="k">IP pública</span>
                <span className="v mono">{liveIsp?.clientIp || "—"}</span>
              </div>
              <div className="kv-row">
                <span className="k">Ubicación aprox.</span>
                <span className="v">
                  {formatLocation(
                    liveIsp?.city,
                    liveIsp?.country,
                    liveIsp?.colo
                  )}
                </span>
              </div>
            </div>
            <p className="field-hint" style={{ marginTop: 10 }}>
              {liveAccess === "cellular" ? (
                <>
                  En <strong>datos móviles</strong> el medidor estima el
                  operador por la IP pública (ASN).{" "}
                  <strong>No puede leer el nombre de la SIM</strong> desde el
                  navegador (restricción de Android/Chrome).
                </>
              ) : liveAccess === "wifi" ? (
                <>
                  En <strong>Wi‑Fi</strong> se identifica el ISP del router
                  (hogar/trabajo), <strong>no</strong> el operador de la SIM.
                  Desactiva Wi‑Fi para medir y detectar la red móvil.
                </>
              ) : (
                <>
                  El ISP se obtiene de la IP pública. Si usas VPN, verás el
                  proveedor de la VPN y no tu operador real.
                </>
              )}
            </p>
          </>
        )}
      </section>
    </>
  );

  return (
    <>
      {!splashDone && (
        <SplashScreen onDone={() => setSplashDone(true)} />
      )}
      <BrandHeader accessKind={liveAccess} />
      <div
        className={`app ${running ? "is-running" : ""} ${
          tab === "medir" ? "has-sticky-cta" : "no-sticky-cta"
        }`}
      >
        <div className="meta-chips meta-chips-scroll desktop-only" aria-label="Metadatos">
          <span className="chip">CVM {CVM_THRESHOLD_PCT}%</span>
          <span className="chip chip-isp">
            {ispLoading
              ? "Detectando red…"
              : liveIsp
                ? `${liveAccess === "cellular" ? "Operador" : "ISP"}: ${liveIsp.displayName}`
                : "ISP: —"}
          </span>
          <span className="chip">{accessKindLabel(liveAccess)}</span>
          <span className="chip">{selectedServerLabel}</span>
          <span className="chip">Historial: {history.length}</span>
        </div>

        {/* Tabs desktop; en móvil se usa bottom nav */}
        <div className="tabs tabs-desktop">
          <button
            type="button"
            className={`tab ${tab === "medir" ? "active" : ""}`}
            onClick={() => setTab("medir")}
          >
            Medición
          </button>
          <button
            type="button"
            className={`tab ${tab === "mapa" ? "active" : ""}`}
            onClick={() => setTab("mapa")}
          >
            Mapa
          </button>
          <button
            type="button"
            className={`tab ${tab === "historial" ? "active" : ""}`}
            onClick={() => setTab("historial")}
          >
            Historial ({history.length})
          </button>
        </div>

        {tab === "historial" ? (
          <div className="grid" style={{ gap: 18 }}>
            <section className="card">
              <h2>Agregados</h2>
              <AggregatesPanel history={history} />
            </section>
            <section className="card">
              <div className="card-head">
                <h2 style={{ marginBottom: 0 }}>Historial local</h2>
                <div className="btn-row">
                  {history.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          downloadTextFile(
                            `historial-medidor-${new Date().toISOString().slice(0, 10)}.json`,
                            exportHistoryJson(history)
                          )
                        }
                      >
                        Exportar JSON
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          if (
                            !confirm(
                              "¿Borrar todo el historial de mediciones de este navegador?"
                            )
                          ) {
                            return;
                          }
                          clearHistory();
                          setHistory([]);
                          setResult(null);
                          setInfo("Historial borrado.");
                        }}
                      >
                        Borrar todo
                      </button>
                    </>
                  )}
                </div>
              </div>

              {error && <div className="error-box">{error}</div>}
              {info && <div className="info-box">{info}</div>}

              {history.length === 0 ? (
                <p
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 14,
                    marginTop: 12,
                  }}
                >
                  Aún no hay pruebas guardadas. Ejecuta una medición en la
                  pestaña <strong>Medición</strong>; se guardará
                  automáticamente aquí.
                </p>
              ) : (
                <div className="history-list history-list-actions" style={{ marginTop: 12 }}>
                  {history.map((h) => {
                    const s = summarizeMeasurement(h);
                    return (
                    <div className="history-item history-item-row" key={h.id}>
                      <button
                        type="button"
                        className="history-main"
                        onClick={() => {
                          setResult(h);
                          setTab("medir");
                          setInfo("Resultado cargado desde el historial.");
                          setError(null);
                        }}
                      >
                        <div className="when">
                          <strong>{s.time}</strong>
                          {h.cvm
                            ? h.cvm.meetsCvm
                              ? " · CVM OK"
                              : " · CVM NO"
                            : ""}
                          {h.runTotal && h.runTotal > 1
                            ? ` · rep ${h.runIndex}/${h.runTotal}`
                            : ""}
                        </div>
                        <div className="nums">
                          {s.operator} · ↓ {formatMbps(s.downMbps)} · ↑{" "}
                          {formatMbps(s.upMbps)} · {formatMs(s.latencyMs)} ms
                        </div>
                        <div className="when mono">
                          {s.coords
                            ? `📍 ${s.coords}${s.accuracy ? ` (${s.accuracy})` : ""}`
                            : "📍 sin GPS"}
                          {s.access ? ` · ${s.access}` : ""}
                        </div>
                      </button>
                      <div className="history-actions">
                        <span className="history-cvm">
                          {h.cvm ? `${h.cvm.cvmPct}%` : "—"}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-touch"
                          disabled={exportingId === h.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleExportPdf(h);
                          }}
                          title="Exportar PDF"
                        >
                          {exportingId === h.id ? "…" : "PDF"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-touch"
                          onClick={(e) => {
                            e.stopPropagation();
                            exportResultJson(h);
                            setInfo("JSON de la prueba descargado.");
                          }}
                          title="Exportar JSON"
                        >
                          JSON
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-touch danger-text"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm("¿Eliminar esta medición del historial?")) {
                              return;
                            }
                            const next = removeResult(h.id);
                            setHistory(next);
                            if (result?.id === h.id) setResult(null);
                            setInfo("Medición eliminada del historial.");
                          }}
                          title="Eliminar"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : tab === "mapa" ? (
          <MapPanel
            history={history}
            lastGeo={deviceGeo}
            onGeoUpdate={setDeviceGeo}
          />
        ) : (
          <div className="grid grid-main">
            <section
              className={`card measure-card ${running ? "is-measuring" : ""}`}
              id="measure-card"
            >
              <div className="measure-card-head">
                <h2>Medición</h2>
                <label className="reps-control" title="Repeticiones (1–10)">
                  <span className="reps-label">×</span>
                  <input
                    type="text"
                    className="reps-input"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={repsText}
                    disabled={running}
                    aria-label="Número de repeticiones (1 a 10)"
                    onChange={(e) => {
                      // Solo dígitos; permite vacío mientras escribe
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setRepsText(raw);
                      if (raw === "") return;
                      const n = Number(raw);
                      if (Number.isFinite(n) && n >= 1 && n <= 10) {
                        setReps(n);
                      }
                    }}
                    onBlur={() => {
                      let n = Number(repsText);
                      if (!Number.isFinite(n) || n < 1) n = 1;
                      if (n > 10) n = 10;
                      setReps(n);
                      setRepsText(String(n));
                    }}
                    onFocus={(e) => {
                      e.target.select();
                    }}
                  />
                </label>
              </div>

              <div className="gauge-wrap">
                <div className={`gauge ${running ? "gauge-active" : ""}`}>
                  {running && (
                    <>
                      <span className="gauge-ripple r1" aria-hidden />
                      <span className="gauge-ripple r2" aria-hidden />
                      <span className="gauge-ripple r3" aria-hidden />
                    </>
                  )}
                  <div
                    className="gauge-ring"
                    style={{ ["--p" as string]: gaugePct }}
                  />
                  <div className="gauge-core">
                    <div className="gauge-value">{formatMbps(gaugeValue)}</div>
                    <div className="gauge-unit">Mbps</div>
                    <div className="gauge-phase">
                      {running
                        ? repProgress.total > 1
                          ? `${PHASE_LABEL[progress.phase]} · ${repProgress.current}/${repProgress.total}`
                          : PHASE_LABEL[progress.phase]
                        : result
                          ? result.runTotal && result.runTotal > 1
                            ? `Resultado · rep ${result.runIndex}/${result.runTotal}`
                            : "Resultado (mediana bajada)"
                          : PHASE_LABEL[progress.phase]}
                    </div>
                  </div>
                </div>
              </div>

              <div className="metrics">
                <div className="metric">
                  <div className="label">Bajada</div>
                  <div className="value">
                    {result
                      ? formatMbps(result.download?.medianMbps ?? 0)
                      : "—"}
                  </div>
                  <div className="sub">
                    {result
                      ? `P10–P90: ${formatMbps(result.download?.p10Mbps ?? 0)}–${formatMbps(result.download?.p90Mbps ?? 0)}`
                      : "Mbps mediana"}
                  </div>
                </div>
                <div className="metric">
                  <div className="label">Subida</div>
                  <div className="value">
                    {result ? formatMbps(result.upload?.medianMbps ?? 0) : "—"}
                  </div>
                  <div className="sub">
                    {result
                      ? `P10–P90: ${formatMbps(result.upload?.p10Mbps ?? 0)}–${formatMbps(result.upload?.p90Mbps ?? 0)}`
                      : "Mbps mediana"}
                  </div>
                </div>
                <div className="metric">
                  <div className="label">Latencia</div>
                  <div className="value">
                    {result
                      ? formatMs(result.latency?.medianMs ?? 0)
                      : progress.liveLatencyMs != null
                        ? formatMs(progress.liveLatencyMs)
                        : "—"}
                  </div>
                  <div className="sub">
                    {result
                      ? `Jitter ${formatMs(result.latency?.jitterMs ?? 0)} ms · pérdida ${result.latency?.packetLossPct ?? 0}%`
                      : "ms mediana"}
                  </div>
                </div>
              </div>

              {samples.length > 0 && <Sparkline values={samples} />}

              <div className="progress" aria-hidden>
                <span style={{ width: `${progress.progress}%` }} />
              </div>
              <div className="status-line">{progress.message}</div>

              <div id="results-anchor" />
              {error && <div className="error-box">{error}</div>}
              {info && <div className="info-box">{info}</div>}

              {result && (
                <div className="record-snapshot">
                  <div className="record-snapshot-title">Registro guardado</div>
                  <div className="kv">
                    <div className="kv-row">
                      <span className="k">Hora</span>
                      <span className="v">
                        {new Date(result.finishedAt).toLocaleString("es-PE")}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Operador</span>
                      <span className="v">
                        {result.plan?.operator ||
                          result.networkIdentity?.isp.displayName ||
                          "—"}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">↓ DL / ↑ UL</span>
                      <span className="v">
                        {formatMbps(result.download?.medianMbps ?? 0)} /{" "}
                        {formatMbps(result.upload?.medianMbps ?? 0)} Mbps
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Latencia</span>
                      <span className="v">
                        {formatMs(result.latency?.medianMs ?? 0)} ms
                        {result.latency?.jitterMs != null
                          ? ` · jitter ${formatMs(result.latency.jitterMs)}`
                          : ""}
                      </span>
                    </div>
                    <div className="kv-row">
                      <span className="k">Ubicación</span>
                      <span className="v mono">
                        {result.geo
                          ? `${formatCoords(result.geo.latitude, result.geo.longitude)}${
                              result.geo.accuracyM != null
                                ? ` ±${Math.round(result.geo.accuracyM)} m`
                                : ""
                            }`
                          : "No capturada (activa GPS y permisos)"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {result && (
                <div className="btn-row export-row" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={exportingId === result.id}
                    onClick={() => void handleExportPdf(result)}
                  >
                    {exportingId === result.id
                      ? "Generando…"
                      : "Exportar PDF"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={exportingId === result.id}
                    onClick={() => void handleDownloadHtml(result)}
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      exportResultJson(result);
                      setInfo("JSON firmado descargado.");
                    }}
                  >
                    JSON
                  </button>
                </div>
              )}

              {/* CTA principal en desktop; en móvil usa la barra fija inferior */}
              <div className="start-wrap desktop-only" style={{ marginTop: 18 }}>
                <button
                  className="btn btn-primary"
                  onClick={() => void start()}
                  disabled={running}
                  type="button"
                >
                  {running ? "Midiendo…" : "Iniciar medición"}
                </button>
              </div>
            </section>

            {/* Debajo del medidor: tip Android + ISP (fija o móvil) */}
            <div className="below-meter">{ispPanel}</div>

            <div className="grid side-panel">
              <section className="card plan-card">
                <button
                  type="button"
                  className="plan-toggle mobile-only"
                  aria-expanded={planOpen}
                  onClick={() => setPlanOpen((o) => !o)}
                >
                  <span>
                    <strong>Plan y servidor</strong>
                    <span className="plan-toggle-sub">
                      {plan.downMbps}/{plan.upMbps ?? "—"} Mbps
                      {plan.operator ? ` · ${plan.operator}` : ""}
                    </span>
                  </span>
                  <span className="plan-toggle-chevron" aria-hidden>
                    {planOpen ? "▾" : "▸"}
                  </span>
                </button>
                <h2 className="desktop-only">Plan y servidor</h2>
                <div
                  className={`plan-form ${planOpen ? "is-open" : ""}`}
                  id="plan-form"
                >
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="down">Bajada contratada (Mbps)</label>
                      <input
                        id="down"
                        type="number"
                        inputMode="decimal"
                        min={1}
                        step={1}
                        value={plan.downMbps || ""}
                        disabled={running}
                        autoComplete="off"
                        onChange={(e) =>
                          setPlan((p) => ({
                            ...p,
                            downMbps: Number(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="up">Subida contratada (Mbps)</label>
                      <input
                        id="up"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={1}
                        value={plan.upMbps ?? ""}
                        disabled={running}
                        autoComplete="off"
                        onChange={(e) =>
                          setPlan((p) => ({
                            ...p,
                            upMbps:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="op">Operador (opcional)</label>
                    <input
                      id="op"
                      type="text"
                      placeholder="Ej. Movistar, Claro, Win, Bitel…"
                      value={plan.operator}
                      disabled={running}
                      onChange={(e) =>
                        setPlan((p) => ({ ...p, operator: e.target.value }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="tech">Tecnología</label>
                    <select
                      id="tech"
                      value={plan.technology}
                      disabled={running}
                      onChange={(e) =>
                        setPlan((p) => ({
                          ...p,
                          technology: e.target
                            .value as UserPlan["technology"],
                        }))
                      }
                    >
                      <option value="ftth">FTTH (fibra)</option>
                      <option value="hfc">HFC (cable)</option>
                      <option value="wireless_fixed">Inalámbrico fijo</option>
                      <option value="other">Otra</option>
                      <option value="">No especificada</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="srv">Servidor de medición</label>
                    <select
                      id="srv"
                      value={serverPref}
                      disabled={running}
                      onChange={(e) => setServerPref(e.target.value)}
                    >
                      <option value="auto">
                        Automático (mejor RTT, evita loopback)
                      </option>
                      {servers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.isLoopback ? " ⚠ localhost" : ""} — {s.region}
                        </option>
                      ))}
                    </select>
                  </div>
                  {servers.find((s) => s.id === serverPref)?.warning && (
                    <p className="field-hint warn">
                      {servers.find((s) => s.id === serverPref)?.warning}
                    </p>
                  )}
                  {serverPref === "auto" && (
                    <p className="field-hint">
                      El modo automático elige el nodo no-loopback con menor RTT
                      (Cloudflare u otros configurados).
                    </p>
                  )}
                </div>
              </section>

              <section className="card">
                <h2>Cumplimiento CVM</h2>
                {!result?.cvm ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    Tras la medición se evaluará si tu bajada alcanza al menos el{" "}
                    {CVM_THRESHOLD_PCT}% de lo contratado (Ley 31207 / Reglamento
                    de Calidad).
                  </p>
                ) : (
                  <>
                    <div className={`sem ${cvmClass}`}>
                      <span className="sem-dot" />
                      <div>
                        <strong>
                          {result.cvm.meetsCvm
                            ? "Cumple velocidad mínima garantizada"
                            : "No alcanza el 70% de la velocidad contratada"}
                        </strong>
                        <span>
                          Medido {formatMbps(result.cvm.measuredDownMbps)} Mbps
                          · mínimo{" "}
                          {formatMbps(result.cvm.minGuaranteedDownMbps)} Mbps (
                          {result.cvm.cvmPct}% del plan)
                        </span>
                      </div>
                    </div>
                    {!result.confidence?.validForRegulatoryCvm && (
                      <div className="sem warn" style={{ marginTop: 8 }}>
                        <span className="sem-dot" />
                        <div>
                          <strong>No usar como evidencia regulatoria</strong>
                          <span>
                            Score/servidor/entorno no superan el umbral de
                            validez CVM de este MVP.
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="kv">
                      <div className="kv-row">
                        <span className="k">Plan bajada / subida</span>
                        <span className="v">
                          {result.cvm.contractedDownMbps} /{" "}
                          {result.cvm.contractedUpMbps ?? "—"} Mbps
                        </span>
                      </div>
                      <div className="kv-row">
                        <span className="k">Asimetría medida (up/down)</span>
                        <span className="v">
                          {result.cvm.asymmetryMeasuredRatio}
                        </span>
                      </div>
                      {result.cvm.meetsAsymmetryContract != null && (
                        <div className="kv-row">
                          <span className="k">Asimetría contractual ≥ 1:3</span>
                          <span className="v">
                            {result.cvm.meetsAsymmetryContract ? "Sí" : "No"} (
                            {result.cvm.asymmetryContractRatio})
                          </span>
                        </div>
                      )}
                      <div className="kv-row">
                        <span className="k">Latencia bajo carga</span>
                        <span className="v">
                          {result.loadedLatency
                            ? `${formatMs(result.loadedLatency.medianMs)} ms`
                            : "—"}
                        </span>
                      </div>
                      <div className="kv-row">
                        <span className="k">Bufferbloat (Δ)</span>
                        <span className="v">
                          {result.bufferbloatMs != null
                            ? `+${formatMs(result.bufferbloatMs)} ms`
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </section>

              <section className="card">
                <h2>
                  Confianza{" "}
                  {result && (
                    <span className={`pill ${result.confidence?.level ?? "baja"}`}>
                      {result.confidence?.level ?? "—"} ·{" "}
                      {result.confidence?.score ?? "—"}
                    </span>
                  )}
                </h2>
                {!result ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                    El score penaliza Wi‑Fi, loopback, inestabilidad y
                    condiciones del cliente. Solo pruebas válidas entran a
                    agregados CVM.
                  </p>
                ) : (
                  <>
                    <div className="kv">
                      <div className="kv-row">
                        <span className="k">Servidor usado</span>
                        <span className="v">
                          {result.selectedServer?.name}
                          {result.selectedServer?.isLoopback ? " ⚠" : ""}
                        </span>
                      </div>
                      <div className="kv-row">
                        <span className="k">Acceso reportado</span>
                        <span className="v">
                          {result.networkIdentity?.accessLabel ??
                            result.precheck?.connectionType ??
                            "—"}
                        </span>
                      </div>
                      <div className="kv-row">
                        <span className="k">ISP / operador</span>
                        <span className="v">
                          {result.networkIdentity?.isp.displayName ??
                            result.serverMeta?.asOrganization ??
                            "—"}
                        </span>
                      </div>
                      {(result.networkIdentity?.isp.asn != null ||
                        result.serverMeta?.asn != null) && (
                        <div className="kv-row">
                          <span className="k">ASN</span>
                          <span className="v">
                            AS
                            {result.networkIdentity?.isp.asn ??
                              result.serverMeta?.asn}
                            {result.networkIdentity?.isp.organization
                              ? ` · ${result.networkIdentity.isp.organization}`
                              : ""}
                          </span>
                        </div>
                      )}
                      {result.networkIdentity?.isp.clientIp && (
                        <div className="kv-row">
                          <span className="k">IP pública</span>
                          <span className="v mono">
                            {result.networkIdentity.isp.clientIp}
                          </span>
                        </div>
                      )}
                      <div className="kv-row">
                        <span className="k">Firma SHA-256</span>
                        <span className="v mono">
                          {result.signature?.hash
                            ? shortHash(result.signature.hash, 16)
                            : "—"}
                        </span>
                      </div>
                      <div className="kv-row">
                        <span className="k">Duración / streams bajada</span>
                        <span className="v">
                          {result.download?.durationMs ?? "—"} ms ·{" "}
                          {result.download?.streams ?? "—"} hilos
                        </span>
                      </div>
                    </div>
                    <div className="factors">
                      {(result.confidence?.factors ?? []).map((f) => (
                        <div className="factor" key={f.label}>
                          <div className="title">
                            {f.label}{" "}
                            <span style={{ color: "var(--text-dim)" }}>
                              ({f.impact >= 0 ? "+" : ""}
                              {f.impact})
                            </span>
                          </div>
                          <div className="detail">{f.detail}</div>
                        </div>
                      ))}
                    </div>
                    {(result.notes?.length ?? 0) > 0 && (
                      <p
                        style={{
                          marginTop: 12,
                          fontSize: 13,
                          color: "var(--warning)",
                        }}
                      >
                        {result.notes.join(" · ")}
                      </p>
                    )}
                  </>
                )}
              </section>

              {(probes.length > 0 ||
                (result?.serverProbes?.length ?? 0) > 0) && (
                <section className="card">
                  <h2>Sondeo de servidores</h2>
                  <div className="history-list">
                    {(result?.serverProbes ?? probes).map((p) => (
                      <div className="history-item" key={p.serverId}>
                        <div>
                          <div className="nums">
                            {p.name}
                            {result?.selectedServer?.id === p.serverId
                              ? " · elegido"
                              : ""}
                          </div>
                          <div className="when">
                            {p.region}
                            {p.isLoopback ? " · loopback" : ""}
                            {p.warning ? ` · ${p.warning}` : ""}
                          </div>
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {p.ok ? `${p.rttMs} ms` : "falló"}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        <div className="footer-note desktop-only">
          <strong>PDF e historial.</strong> Cada medición se guarda en este
          navegador (hasta 50). Exporta PDF desde el resultado o desde el
          historial: se abre un informe con logos embebidos; elige{" "}
          <em>Guardar como PDF</em> en el diálogo de impresión. Si el popup está
          bloqueado, se descarga HTML automáticamente.
        </div>
      </div>

      {/* Barra fija de acción (Android / móvil) */}
      {tab === "medir" && (
        <div className="sticky-cta mobile-only" role="region" aria-label="Acción principal">
          <div className="sticky-cta-inner">
            {running ? (
              <div className="sticky-cta-status">
                <span className="sticky-cta-pulse" aria-hidden />
                <div>
                  <strong>{PHASE_LABEL[progress.phase]}</strong>
                  <span>
                    {progress.liveMbps != null
                      ? `${formatMbps(progress.liveMbps)} Mbps · ${Math.round(progress.progress)}%`
                      : progress.message}
                  </span>
                </div>
              </div>
            ) : (
              <div className="sticky-cta-hint">
                Plan {plan.downMbps}/{plan.upMbps ?? "—"} Mbps
                {result
                  ? ` · Última ↓ ${formatMbps(result.download?.medianMbps ?? 0)}`
                  : ""}
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary sticky-cta-btn"
              onClick={() => void start()}
              disabled={running}
            >
              {running ? "Midiendo…" : result ? "Medir de nuevo" : "Iniciar medición"}
            </button>
          </div>
        </div>
      )}

      {/* Navegación inferior táctil: Medir | Mapa | Historial */}
      <nav className="bottom-nav mobile-only" aria-label="Navegación principal">
        <button
          type="button"
          className={`bottom-nav-item ${tab === "medir" ? "active" : ""}`}
          onClick={() => setTab("medir")}
        >
          <span className="bottom-nav-icon" aria-hidden>
            ◎
          </span>
          <span>Medir</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item bottom-nav-center ${tab === "mapa" ? "active" : ""}`}
          onClick={() => setTab("mapa")}
        >
          <span className="bottom-nav-icon" aria-hidden>
            ⌖
          </span>
          <span>Mapa</span>
        </button>
        <button
          type="button"
          className={`bottom-nav-item ${tab === "historial" ? "active" : ""}`}
          onClick={() => setTab("historial")}
        >
          <span className="bottom-nav-icon" aria-hidden>
            ≡
          </span>
          <span>Historial</span>
          {history.length > 0 && (
            <span className="bottom-nav-badge">{history.length}</span>
          )}
        </button>
      </nav>

      <BrandFooter />
    </>
  );
}
