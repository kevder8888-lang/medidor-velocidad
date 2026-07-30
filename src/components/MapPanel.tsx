"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatCoords,
  getDevicePosition,
  hasGoogleMaps,
  mapEmbedUrl,
  mapExternalUrl,
  mapProviderLabel,
  type DeviceGeo,
} from "@/lib/geo";
import { formatMbps } from "@/lib/stats";
import type { SpeedTestResult } from "@/lib/types";

export function MapPanel({
  history,
  lastGeo,
  onGeoUpdate,
}: {
  history: SpeedTestResult[];
  lastGeo: DeviceGeo | null;
  onGeoUpdate: (g: DeviceGeo) => void;
}) {
  const [geo, setGeo] = useState<DeviceGeo | null>(lastGeo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provider = mapProviderLabel();
  const usingGoogle = hasGoogleMaps();

  const locate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getDevicePosition({ highAccuracy: true });
      setGeo(pos);
      onGeoUpdate(pos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de geolocalización");
    } finally {
      setLoading(false);
    }
  }, [onGeoUpdate]);

  useEffect(() => {
    if (!geo) void locate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lastGeo) setGeo(lastGeo);
  }, [lastGeo]);

  const points = history
    .filter((h) => h.geo?.latitude != null && h.geo?.longitude != null)
    .slice(0, 30);

  return (
    <div className="map-panel">
      <section className="card map-hero-card">
        <div className="map-hero-head">
          <div>
            <h2 className="map-hero-title">Mapa</h2>
            <p className="map-hero-sub">
              GPS del dispositivo · {provider}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost map-gps-btn"
            onClick={() => void locate()}
            disabled={loading}
          >
            {loading ? "…" : "↻ GPS"}
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        {/* Protagonista: el mapa primero y grande */}
        {geo ? (
          <div className="map-frame-wrap map-frame-hero">
            <iframe
              title={`Mapa ${provider}`}
              className="map-frame"
              src={mapEmbedUrl(geo.latitude, geo.longitude)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="map-frame-wrap map-frame-hero map-frame-empty">
            <p className="muted-p" style={{ padding: 16, textAlign: "center" }}>
              {loading
                ? "Obteniendo ubicación…"
                : "Pulsa «↻ GPS» y acepta el permiso de ubicación."}
            </p>
          </div>
        )}

        {geo && (
          <div className="map-meta-bar">
            <span className="mono">
              {formatCoords(geo.latitude, geo.longitude)}
            </span>
            <span className="map-meta-sep">·</span>
            <span>
              {geo.accuracyM != null
                ? `±${Math.round(geo.accuracyM)} m`
                : "prec. N/D"}
            </span>
            <span className="map-meta-sep">·</span>
            <a
              href={mapExternalUrl(geo.latitude, geo.longitude)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir
            </a>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2>Puntos de mediciones</h2>
        {points.length === 0 ? (
          <p className="muted-p">
            Aún no hay mediciones con coordenadas.
          </p>
        ) : (
          <div className="history-list">
            {points.map((h) => (
              <div className="history-item" key={h.id}>
                <div>
                  <div className="nums">
                    ↓ {formatMbps(h.download?.medianMbps ?? 0)} Mbps
                    {h.networkIdentity?.isp.displayName
                      ? ` · ${h.networkIdentity.isp.displayName}`
                      : ""}
                  </div>
                  <div className="when mono">
                    {h.geo
                      ? formatCoords(h.geo.latitude, h.geo.longitude)
                      : "—"}
                    {h.finishedAt
                      ? ` · ${new Date(h.finishedAt).toLocaleString("es-PE")}`
                      : ""}
                  </div>
                </div>
                {h.geo && (
                  <a
                    className="btn btn-ghost btn-touch"
                    href={mapExternalUrl(h.geo.latitude, h.geo.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Ver
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Ayuda al final — no compite con el mapa */}
      {usingGoogle && (
        <details className="map-help-details">
          <summary>Ayuda: error de API key</summary>
          <p>
            Si ves <em>“not authorized to use this API key”</em>: en Google Cloud
            la key debe ser de tipo <strong>Sitios web (HTTP referrers)</strong>,
            no “Aplicaciones Android”, e incluir{" "}
            <code>https://medidor-velocidad-pi.vercel.app/*</code> y{" "}
            <code>http://localhost:3000/*</code>. Activa{" "}
            <strong>Maps Embed API</strong> y espera 1–5 min.
          </p>
        </details>
      )}
    </div>
  );
}
