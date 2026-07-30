"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AggregatesPanel } from "@/components/AggregatesPanel";
import { BrandFooter } from "@/components/BrandFooter";
import { BrandHeader } from "@/components/BrandHeader";
import { Sparkline } from "@/components/Sparkline";
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

type TabId = "medir" | "historial";

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

  useEffect(() => {
    setPlan(loadPlan());
    setHistory(loadHistory());
    setServers(getMeasurementServers());
    try {
      const pref = localStorage.getItem(SERVER_KEY);
      if (pref) setServerPref(pref);
    } catch {
      /* ignore */
    }
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

  async function start() {
    if (running) return;
    if (!plan.downMbps || plan.downMbps <= 0) {
      setError("Indica la velocidad de bajada contratada (Mbps).");
      return;
    }
    setError(null);
    setInfo(null);
    setRunning(true);
    setResult(null);
    setProbes([]);
    setProgress({
      phase: "precheck",
      progress: 1,
      message: "Iniciando…",
    });
    try {
      const res = await runSpeedTest(
        plan,
        (ev) => {
          onProgress(ev);
        },
        serverPref as "auto" | string
      );
      setResult(res);
      setProbes(res.serverProbes ?? []);
      const saved = saveResult(res);
      setHistory(saved.history);
      if (!saved.ok) {
        setError(
          saved.error ||
            "La medición terminó, pero no se pudo guardar en el historial."
        );
      } else {
        setInfo("Medición guardada en el historial local de este navegador.");
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

  return (
    <>
      <BrandHeader />
      <div className="app">
        <div className="meta-chips">
          <span className="chip">Protocolo {PROTOCOL_VERSION}</span>
          <span className="chip">Cliente {CLIENT_VERSION}</span>
          <span className="chip">{selectedServerLabel}</span>
          <span className="chip">CVM {CVM_THRESHOLD_PCT}%</span>
          <span className="chip">Historial: {history.length}</span>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={`tab ${tab === "medir" ? "active" : ""}`}
            onClick={() => setTab("medir")}
          >
            Medición
          </button>
          <button
            type="button"
            className={`tab ${tab === "historial" ? "active" : ""}`}
            onClick={() => setTab("historial")}
          >
            Historial y agregados ({history.length})
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
                  {history.map((h) => (
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
                          {h.finishedAt
                            ? new Date(h.finishedAt).toLocaleString("es-PE")
                            : "—"}{" "}
                          · conf. {h.confidence?.score ?? "—"}
                          {h.cvm
                            ? h.cvm.meetsCvm
                              ? " · CVM OK"
                              : " · CVM NO"
                            : ""}
                          {h.confidence && !h.confidence.validForRegulatoryCvm
                            ? " · no regulatorio"
                            : ""}
                        </div>
                        <div className="nums">
                          ↓ {formatMbps(h.download?.medianMbps ?? 0)} · ↑{" "}
                          {formatMbps(h.upload?.medianMbps ?? 0)} ·{" "}
                          {formatMs(h.latency?.medianMs ?? 0)} ms
                          {h.selectedServer
                            ? ` · ${h.selectedServer.name}`
                            : ""}
                        </div>
                        {h.signature?.hash && (
                          <div className="when mono">
                            sha {shortHash(h.signature.hash, 12)}
                          </div>
                        )}
                      </button>
                      <div className="history-actions">
                        <span className="history-cvm">
                          {h.cvm ? `${h.cvm.cvmPct}%` : "—"}
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
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
                          className="btn btn-ghost btn-xs"
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
                          className="btn btn-ghost btn-xs danger-text"
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
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="grid grid-main">
            <section className="card">
              <h2>Medición</h2>

              <div className="gauge-wrap">
                <div className="gauge">
                  <div
                    className="gauge-ring"
                    style={{ ["--p" as string]: gaugePct }}
                  />
                  <div className="gauge-core">
                    <div className="gauge-value">{formatMbps(gaugeValue)}</div>
                    <div className="gauge-unit">Mbps</div>
                    <div className="gauge-phase">
                      {running
                        ? PHASE_LABEL[progress.phase]
                        : result
                          ? "Resultado (mediana bajada)"
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

              {error && <div className="error-box">{error}</div>}
              {info && <div className="info-box">{info}</div>}

              {result && (
                <div className="btn-row" style={{ marginTop: 14 }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={exportingId === result.id}
                    onClick={() => void handleExportPdf(result)}
                  >
                    {exportingId === result.id
                      ? "Generando informe…"
                      : "Exportar PDF"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={exportingId === result.id}
                    onClick={() => void handleDownloadHtml(result)}
                  >
                    Descargar HTML
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      exportResultJson(result);
                      setInfo("JSON firmado descargado.");
                    }}
                  >
                    JSON firmado
                  </button>
                </div>
              )}

              <div style={{ marginTop: 18 }}>
                <button
                  className="btn btn-primary"
                  onClick={start}
                  disabled={running}
                  type="button"
                >
                  {running ? "Midiendo…" : "Iniciar medición"}
                </button>
              </div>
            </section>

            <div className="grid">
              <section className="card">
                <h2>Plan y servidor</h2>
                <div className="plan-form">
                  <div className="field-row">
                    <div className="field">
                      <label htmlFor="down">Bajada contratada (Mbps)</label>
                      <input
                        id="down"
                        type="number"
                        min={1}
                        step={1}
                        value={plan.downMbps || ""}
                        disabled={running}
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
                        min={0}
                        step={1}
                        value={plan.upMbps ?? ""}
                        disabled={running}
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
                          {result.precheck?.connectionType ?? "—"}
                        </span>
                      </div>
                      {result.serverMeta && (
                        <div className="kv-row">
                          <span className="k">Meta red</span>
                          <span className="v">
                            {[
                              result.serverMeta.colo &&
                                `PoP ${result.serverMeta.colo}`,
                              result.serverMeta.city,
                              result.serverMeta.asn &&
                                `AS${result.serverMeta.asn}`,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "—"}
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

        <div className="footer-note">
          <strong>PDF e historial.</strong> Cada medición se guarda en este
          navegador (hasta 50). Exporta PDF desde el resultado o desde el
          historial: se abre un informe con logos embebidos; elige{" "}
          <em>Guardar como PDF</em> en el diálogo de impresión. Si el popup está
          bloqueado, se descarga HTML automáticamente.
        </div>
      </div>
      <BrandFooter />
    </>
  );
}
