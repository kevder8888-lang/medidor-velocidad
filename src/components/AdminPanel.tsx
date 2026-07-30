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
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.operator || "").toLowerCase().includes(q) ||
        (r.isp_brand || "").toLowerCase().includes(q) ||
        (r.isp_organization || "").toLowerCase().includes(q)
    );
  }, [rows, filterOp]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  const withGeo = useMemo(
    () =>
      filtered.filter((r) => r.latitude != null && r.longitude != null).slice(0, 50),
    [filtered]
  );

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
        <p className="field-hint">
          Luego ejecuta el SQL de <code>supabase/schema.sql</code> en el SQL
          Editor de Supabase y crea un usuario en Authentication → Users.
        </p>
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
          Inicia sesión con el usuario administrador de Supabase. Las mediciones
          de todos los dispositivos se guardan en la nube de forma anónima; solo
          el admin puede listarlas.
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
              placeholder="admin@ejemplo.com"
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
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loggingIn}
          >
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
              {session.user.email} · {filtered.length} mediciones
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

        <div className="field" style={{ marginTop: 10, maxWidth: 280 }}>
          <label htmlFor="filter-op">Filtrar operador</label>
          <input
            id="filter-op"
            type="search"
            placeholder="Entel, Claro, Movistar…"
            value={filterOp}
            onChange={(e) => setFilterOp(e.target.value)}
          />
        </div>
      </section>

      {selected?.latitude != null && selected?.longitude != null && (
        <section className="card" style={{ marginTop: 12 }}>
          <h2>Mapa · medición seleccionada</h2>
          <p className="field-hint" style={{ marginBottom: 8 }}>
            {selected.operator || "—"} · ↓{" "}
            {formatMbps(selected.download_mbps ?? 0)} ·{" "}
            {mapProviderLabel()}
          </p>
          <div className="map-frame-wrap map-frame-hero">
            <iframe
              title="Mapa admin"
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
              Abrir mapa
            </a>
          </div>
          {withGeo.length > 1 && (
            <p className="field-hint" style={{ marginTop: 8 }}>
              {withGeo.length} mediciones con GPS en el filtro actual (el mapa
              muestra la seleccionada).
            </p>
          )}
        </section>
      )}

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Todas las mediciones</h2>
        {filtered.length === 0 ? (
          <div className="muted-p">
            <p>
              No hay mediciones en la nube todavía.
            </p>
            <ol style={{ margin: "10px 0 0 18px", lineHeight: 1.5 }}>
              <li>
                En el otro dispositivo abre la misma URL de Vercel (no localhost).
              </li>
              <li>
                Haz una medición nueva y revisa el mensaje: debe decir{" "}
                <strong>nube OK</strong> (no “nube ERROR”).
              </li>
              <li>
                En Supabase → <strong>Table Editor → measurements</strong> debe
                aparecer una fila.
              </li>
              <li>
                Aquí pulsa <strong>Actualizar</strong>.
              </li>
            </ol>
            <p className="field-hint" style={{ marginTop: 10 }}>
              Si Table Editor está vacío, el otro dispositivo no está subiendo
              (variables de entorno o error de insert). Si Table Editor tiene filas
              y aquí no, es un problema de login/RLS.
            </p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Operador</th>
                  <th>↓</th>
                  <th>↑</th>
                  <th>Lat</th>
                  <th>Acceso</th>
                  <th>GPS</th>
                  <th>CVM</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
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
                    <td>{formatMbps(r.download_mbps ?? 0)}</td>
                    <td>{formatMbps(r.upload_mbps ?? 0)}</td>
                    <td>{formatMs(r.latency_ms ?? 0)}</td>
                    <td>{r.access_label || r.access_type || "—"}</td>
                    <td className="mono">
                      {r.latitude != null && r.longitude != null
                        ? formatCoords(r.latitude, r.longitude, 4)
                        : "—"}
                    </td>
                    <td>
                      {r.cvm_pct != null
                        ? `${r.cvm_pct}%${r.meets_cvm ? " ✓" : ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
