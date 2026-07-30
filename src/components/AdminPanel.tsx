"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  formatCoords,
  mapEmbedUrl,
  mapExternalUrl,
  mapProviderLabel,
} from "@/lib/geo";
import { formatMbps, formatMs } from "@/lib/stats";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchAllMeasurements,
  measurementsToCsv,
} from "@/lib/supabase/measurements";
import type { MeasurementRow } from "@/lib/supabase/types";
import type { Session } from "@supabase/supabase-js";
import { AdminMultiMap } from "@/components/AdminMultiMap";
import { radioTechLabel } from "@/lib/mobilePlans";

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type CvmFilter = "all" | "ok" | "fail" | "na";
type AccessFilter = "all" | "fixed" | "mobile" | "wifi" | "cellular";

export function AdminPanel() {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [rows, setRows] = useState<MeasurementRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [filterOp, setFilterOp] = useState("");
  const [filterCvm, setFilterCvm] = useState<CvmFilter>("all");
  const [filterAccess, setFilterAccess] = useState<AccessFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setAuthLoading(false);
      return;
    }
    void sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await fetchAllMeasurements(1000);
    if (!res.ok) {
      setLoadError(res.error || "No se pudieron cargar las mediciones.");
      setRows([]);
    } else {
      setRows(res.rows);
      setSelectedId((prev) => prev ?? res.rows[0]?.id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  const filtered = useMemo(() => {
    const q = filterOp.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.operator || ""} ${r.isp_brand || ""} ${r.isp_organization || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterCvm === "ok" && r.meets_cvm !== true) return false;
      if (filterCvm === "fail" && r.meets_cvm !== false) return false;
      if (filterCvm === "na" && r.meets_cvm != null) return false;

      if (filterAccess !== "all") {
        const acc = (r.access_type || r.access_label || "").toLowerCase();
        const tech = (r.technology || r.radio_tech || "").toLowerCase();
        const mode = (r.service_mode || "").toLowerCase();
        if (filterAccess === "mobile") {
          if (
            !(
              mode === "mobile" ||
              acc.includes("cellular") ||
              acc.includes("móvil") ||
              acc.includes("movil") ||
              ["3g", "4g", "5g"].includes(tech)
            )
          ) {
            return false;
          }
        } else if (filterAccess === "fixed") {
          if (
            mode === "mobile" ||
            acc.includes("cellular") ||
            ["3g", "4g", "5g"].includes(tech)
          ) {
            return false;
          }
        } else if (filterAccess === "wifi") {
          if (!acc.includes("wifi") && !acc.includes("wi-fi")) return false;
        } else if (filterAccess === "cellular") {
          if (!acc.includes("cellular") && !acc.includes("móvil") && !acc.includes("movil"))
            return false;
        }
      }

      if (dateFrom || dateTo) {
        const t = r.finished_at || r.created_at;
        if (!t) return false;
        const d = new Date(t);
        if (dateFrom) {
          const from = new Date(dateFrom + "T00:00:00");
          if (d < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo + "T23:59:59");
          if (d > to) return false;
        }
      }
      return true;
    });
  }, [rows, filterOp, filterCvm, filterAccess, dateFrom, dateTo]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  const withGeo = useMemo(
    () =>
      filtered.filter((r) => r.latitude != null && r.longitude != null).slice(0, 200),
    [filtered]
  );

  const stats = useMemo(() => {
    const n = filtered.length;
    const withCvm = filtered.filter((r) => r.meets_cvm != null);
    const pass = withCvm.filter((r) => r.meets_cvm === true).length;
    const avgDown =
      n > 0
        ? filtered.reduce((a, r) => a + (r.download_mbps ?? 0), 0) / n
        : 0;
    return {
      n,
      passRate: withCvm.length ? Math.round((pass / withCvm.length) * 1000) / 10 : null,
      avgDown: Math.round(avgDown * 10) / 10,
      withGps: withGeo.length,
    };
  }, [filtered, withGeo.length]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    const sb = getSupabase();
    if (!sb) {
      setLoginError("Supabase no configurado.");
      setLoggingIn(false);
      return;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
    setLoggingIn(false);
  }

  async function handleLogout() {
    const sb = getSupabase();
    await sb?.auth.signOut();
    setRows([]);
    setSession(null);
  }

  if (!configured) {
    return (
      <section className="card">
        <h2>Acceso admin</h2>
        <p className="muted-p">
          Supabase no está configurado. Añade en Vercel / <code>.env.local</code>:
        </p>
        <ul className="admin-env-list">
          <li>
            <code>NEXT_PUBLIC_SUPABASE_URL</code>
          </li>
          <li>
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
          </li>
        </ul>
      </section>
    );
  }

  if (authLoading) {
    return (
      <section className="card">
        <p className="muted-p">Comprobando sesión…</p>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="card admin-login-card">
        <h2>Acceso admin</h2>
        <p className="field-hint" style={{ marginBottom: 14 }}>
          Inicia sesión con el usuario administrador de Supabase.
        </p>
        <form className="plan-form" onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="admin-email">Correo</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="admin-pass">Contraseña</label>
            <input
              id="admin-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {loginError && <div className="error-box">{loginError}</div>}
          <button type="submit" className="btn btn-primary" disabled={loggingIn}>
            {loggingIn ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </section>
    );
  }

  return (
    <div className="admin-panel">
      <section className="card">
        <div className="card-head">
          <div>
            <h2 style={{ marginBottom: 0 }}>Panel admin</h2>
            <p className="field-hint" style={{ marginTop: 4 }}>
              {session.user.email} · {stats.n} filas
              {stats.passRate != null ? ` · CVM ${stats.passRate}%` : ""}
              {stats.avgDown ? ` · ↓ media ${stats.avgDown}` : ""}
              {loading ? " · cargando…" : ""}
            </p>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost btn-touch"
              onClick={() => void load()}
              disabled={loading}
            >
              Actualizar
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-touch"
              onClick={() =>
                downloadBlob(
                  `mediciones-${new Date().toISOString().slice(0, 10)}.csv`,
                  measurementsToCsv(filtered),
                  "text/csv;charset=utf-8"
                )
              }
              disabled={!filtered.length}
            >
              CSV
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-touch"
              onClick={() =>
                downloadBlob(
                  `mediciones-${new Date().toISOString().slice(0, 10)}.json`,
                  JSON.stringify(filtered, null, 2),
                  "application/json"
                )
              }
              disabled={!filtered.length}
            >
              JSON
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-touch danger-text"
              onClick={() => void handleLogout()}
            >
              Salir
            </button>
          </div>
        </div>

        {loadError && <div className="error-box">{loadError}</div>}

        {/* Filtros */}
        <div className="admin-filters">
          <div className="field">
            <label htmlFor="filter-op">Operador</label>
            <input
              id="filter-op"
              type="search"
              placeholder="Entel, Claro…"
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="filter-cvm">CVM</label>
            <select
              id="filter-cvm"
              value={filterCvm}
              onChange={(e) => setFilterCvm(e.target.value as CvmFilter)}
            >
              <option value="all">Todos</option>
              <option value="ok">Cumple</option>
              <option value="fail">No cumple</option>
              <option value="na">Sin CVM</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="filter-acc">Acceso</label>
            <select
              id="filter-acc"
              value={filterAccess}
              onChange={(e) => setFilterAccess(e.target.value as AccessFilter)}
            >
              <option value="all">Todos</option>
              <option value="fixed">Fija</option>
              <option value="mobile">Móvil (plan)</option>
              <option value="cellular">Datos celulares</option>
              <option value="wifi">Wi‑Fi</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="date-from">Desde</label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="date-to">Hasta</label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Todas las mediciones</h2>
        {filtered.length === 0 ? (
          <div className="muted-p">
            <p>No hay mediciones con los filtros actuales.</p>
            <p className="field-hint" style={{ marginTop: 8 }}>
              Mide desde un dispositivo (mensaje <strong>nube OK</strong>) y pulsa
              Actualizar. Table Editor en Supabase debe tener filas.
            </p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Operador</th>
                  <th>Modo</th>
                  <th>Tech</th>
                  <th>↓</th>
                  <th>↑</th>
                  <th>Lat</th>
                  <th>GPS</th>
                  <th>CVM</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const tech =
                    r.radio_tech ||
                    r.technology ||
                    "";
                  const mode =
                    r.service_mode ||
                    (["3g", "4g", "5g"].includes(tech) ? "mobile" : "fixed");
                  return (
                    <tr
                      key={r.id}
                      className={
                        selected?.id === r.id ? "admin-row-selected" : undefined
                      }
                      onClick={() => setSelectedId(r.id)}
                    >
                      <td>
                        {r.finished_at
                          ? new Date(r.finished_at).toLocaleString("es-PE")
                          : "—"}
                      </td>
                      <td>{r.operator || r.isp_brand || "—"}</td>
                      <td>{mode === "mobile" ? "Móvil" : "Fija"}</td>
                      <td>
                        {["3g", "4g", "5g"].includes(tech)
                          ? radioTechLabel(tech)
                          : tech || "—"}
                      </td>
                      <td>{formatMbps(r.download_mbps ?? 0)}</td>
                      <td>{formatMbps(r.upload_mbps ?? 0)}</td>
                      <td>{formatMs(r.latency_ms ?? 0)}</td>
                      <td className="mono">
                        {r.latitude != null && r.longitude != null
                          ? formatCoords(r.latitude, r.longitude, 4)
                          : "—"}
                      </td>
                      <td>
                        {r.cvm_pct != null
                          ? `${r.cvm_pct}%${r.meets_cvm ? " ✓" : " ✗"}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Mapa multi-punto debajo de la tabla (solo admin) */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2>Mapa de mediciones ({withGeo.length} con GPS)</h2>
        <p className="field-hint" style={{ marginBottom: 8 }}>
          Clic en un punto para seleccionar la fila. Azul = normal · Rojo =
          seleccionada. Tiles OSM (no consume cuota Google).
        </p>
        {withGeo.length === 0 ? (
          <p className="muted-p">No hay mediciones con coordenadas en el filtro.</p>
        ) : (
          <AdminMultiMap
            points={withGeo}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
          />
        )}

        {selected?.latitude != null && selected?.longitude != null && (
          <div style={{ marginTop: 12 }}>
            <p className="field-hint" style={{ marginBottom: 6 }}>
              Detalle · {selected.operator || "—"} · ↓{" "}
              {formatMbps(selected.download_mbps ?? 0)} · {mapProviderLabel()}
            </p>
            <div className="map-frame-wrap" style={{ minHeight: 200, aspectRatio: "16/9" }}>
              <iframe
                title="Mapa detalle"
                className="map-frame"
                src={mapEmbedUrl(selected.latitude, selected.longitude)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <div className="map-meta-bar">
              <span className="mono">
                {formatCoords(selected.latitude, selected.longitude)}
              </span>
              <span className="map-meta-sep">·</span>
              <a
                href={mapExternalUrl(selected.latitude, selected.longitude)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir
              </a>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
