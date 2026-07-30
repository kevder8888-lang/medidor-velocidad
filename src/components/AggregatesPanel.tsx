"use client";

import { computeAggregates } from "@/lib/aggregates";
import { formatMbps, formatMs } from "@/lib/stats";
import type { SpeedTestResult } from "@/lib/types";

export function AggregatesPanel({ history }: { history: SpeedTestResult[] }) {
  const a = computeAggregates(history);

  if (!a.totalTests) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
        Realiza varias mediciones para ver agregados (promedios, tasa CVM, tendencia).
      </p>
    );
  }

  const trendLabel =
    a.recentTrend === "up"
      ? "Mejorando"
      : a.recentTrend === "down"
        ? "Empeorando"
        : a.recentTrend === "stable"
          ? "Estable"
          : "N/D";

  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="metrics">
        <div className="metric">
          <div className="label">Pruebas</div>
          <div className="value">{a.totalTests}</div>
          <div className="sub">
            CVM válidas: {a.validCvmTests} · tendencia {trendLabel}
          </div>
        </div>
        <div className="metric">
          <div className="label">Tasa CVM (válidas)</div>
          <div className="value">
            {a.cvmPassRatePct != null ? `${a.cvmPassRatePct}%` : "—"}
          </div>
          <div className="sub">
            {a.cvmPassCount} ok · {a.cvmFailCount} no
          </div>
        </div>
        <div className="metric">
          <div className="label">Bajada media / mediana</div>
          <div className="value">{formatMbps(a.avgDownMbps ?? 0)}</div>
          <div className="sub">
            Mediana {formatMbps(a.medianDownMbps ?? 0)} · subida media{" "}
            {formatMbps(a.avgUpMbps ?? 0)}
          </div>
        </div>
      </div>

      <div className="kv">
        <div className="kv-row">
          <span className="k">Latencia media</span>
          <span className="v">{formatMs(a.avgLatencyMs ?? 0)} ms</span>
        </div>
        <div className="kv-row">
          <span className="k">Confianza media</span>
          <span className="v">{a.avgConfidence ?? "—"}</span>
        </div>
        <div className="kv-row">
          <span className="k">Última prueba</span>
          <span className="v">
            {a.lastTestAt ? new Date(a.lastTestAt).toLocaleString() : "—"}
          </span>
        </div>
      </div>

      {a.byDay.length > 0 && (
        <div>
          <div className="section-label">Por día</div>
          <div className="day-bars">
            {a.byDay.map((d) => {
              const max = Math.max(...a.byDay.map((x) => x.avgDown), 1);
              return (
                <div className="day-bar-row" key={d.day}>
                  <span className="day-bar-label">{d.day.slice(5)}</span>
                  <div className="day-bar-track">
                    <span
                      style={{ width: `${(d.avgDown / max) * 100}%` }}
                      title={`${d.avgDown} Mbps`}
                    />
                  </div>
                  <span className="day-bar-val">
                    {formatMbps(d.avgDown)} · n={d.count}
                    {d.cvmPassRate != null ? ` · CVM ${d.cvmPassRate}%` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {a.byOperator.length > 0 && (
        <div>
          <div className="section-label">Por operador</div>
          <div className="history-list">
            {a.byOperator.map((o) => (
              <div className="history-item" key={o.operator}>
                <div>
                  <div className="nums">{o.operator}</div>
                  <div className="when">
                    {o.count} pruebas · avg ↓ {formatMbps(o.avgDown)} Mbps
                  </div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 600 }}>
                  {o.passRate != null ? `${o.passRate}% CVM` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
