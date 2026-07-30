"use client";

import { useCallback, useEffect, useState } from "react";
import {
  formatCoords,
  getDevicePosition,
  osmEmbedUrl,
  osmExternalUrl,
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
      <section className="card">
        <div className="card-head">
          <h2 style={{ marginBottom: 0 }}>Mapa de medición</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void locate()}
            disabled={loading}
          >
            {loading ? "Ubicando…" : "Actualizar GPS"}
          </button>
        </div>

        <p className="field-hint" style={{ marginBottom: 12 }}>
          Coordenadas del <strong>dispositivo</strong> (GPS/red Android). No es la
          ubicación del ISP por IP.
        </p>

        {error && <div className="error-box">{error}</div>}

        {geo ? (
          <>
            <div className="kv" style={{ marginBottom: 12 }}>
              <div className="kv-row">
                <span className="k">Latitud / longitud</span>
                <span className="v mono">
                  {formatCoords(geo.latitude, geo.longitude)}
                </span>
              </div>
              <div className="kv-row">
                <span className="k">Precisión</span>
                <span className="v">
                  {geo.accuracyM != null
                    ? `± ${Math.round(geo.accuracyM)} m`
                    : "—"}
                  {geo.source === "device_gps"
                    ? " · GPS"
                    : geo.source === "device_network"
                      ? " · red"
                      : ""}
                </span>
              </div>
              <div className="kv-row">
                <span className="k">Capturado</span>
                <span className="v">
                  {new Date(geo.timestamp).toLocaleString("es-PE")}
                </span>
              </div>
            </div>

            <div className="map-frame-wrap">
              <iframe
                title="Mapa de ubicación del dispositivo"
                className="map-frame"
                src={osmEmbedUrl(geo.latitude, geo.longitude)}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            <p style={{ marginTop: 10, fontSize: 13 }}>
              <a
                href={osmExternalUrl(geo.latitude, geo.longitude)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en OpenStreetMap
              </a>
            </p>
          </>
        ) : (
          !loading && (
            <p className="muted-p">
              Pulsa «Actualizar GPS» y acepta el permiso de ubicación en Android.
            </p>
          )
        )}
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2>Puntos de mediciones previas</h2>
        {points.length === 0 ? (
          <p className="muted-p">
            Aún no hay mediciones con coordenadas. Al medir se intentará capturar
            el GPS del equipo.
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
                    href={osmExternalUrl(h.geo.latitude, h.geo.longitude)}
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
    </div>
  );
}
