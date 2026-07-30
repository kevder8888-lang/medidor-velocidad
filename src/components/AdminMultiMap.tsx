"use client";

import { useEffect, useRef } from "react";
import type { MeasurementRow } from "@/lib/supabase/types";
import { formatMbps } from "@/lib/stats";

/**
 * Mapa multi-punto (Leaflet + OSM tiles) solo para panel admin.
 * No requiere Google Maps JS API.
 */
export function AdminMultiMap({
  points,
  selectedId,
  onSelect,
}: {
  points: MeasurementRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | null = null;

    async function init() {
      if (!containerRef.current) return;
      const L = await import("leaflet");
      // CSS de Leaflet
      if (typeof document !== "undefined") {
        const id = "leaflet-css";
        if (!document.getElementById(id)) {
          const link = document.createElement("link");
          link.id = id;
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }
      }

      if (cancelled || !containerRef.current) return;

      // Fix default marker icons in bundlers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      map = L.map(containerRef.current, {
        scrollWheelZoom: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const withCoords = points.filter(
        (p) => p.latitude != null && p.longitude != null
      );

      if (withCoords.length === 0) {
        map.setView([-12.0464, -77.0428], 11); // Lima
        return;
      }

      const bounds = L.latLngBounds([]);
      for (const p of withCoords) {
        const lat = Number(p.latitude);
        const lon = Number(p.longitude);
        const isSel = p.id === selectedId;
        const marker = L.circleMarker([lat, lon], {
          radius: isSel ? 10 : 7,
          color: isSel ? "#BF0909" : "#0056AC",
          weight: isSel ? 3 : 2,
          fillColor: isSel ? "#ff5c7a" : "#3b9eff",
          fillOpacity: 0.85,
        }).addTo(map);

        const when = p.finished_at
          ? new Date(p.finished_at).toLocaleString("es-PE")
          : "—";
        marker.bindPopup(
          `<strong>${p.operator || p.isp_brand || "—"}</strong><br/>` +
            `↓ ${formatMbps(p.download_mbps ?? 0)} · ↑ ${formatMbps(p.upload_mbps ?? 0)} Mbps<br/>` +
            `${when}<br/>` +
            (p.cvm_pct != null ? `CVM ${p.cvm_pct}%` : "")
        );
        marker.on("click", () => onSelect(p.id));
        bounds.extend([lat, lon]);
      }

      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.2));
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      } else if (map) {
        map.remove();
      }
    };
    // re-render when points or selection change
  }, [points, selectedId, onSelect]);

  return (
    <div
      ref={containerRef}
      className="admin-multi-map"
      role="img"
      aria-label="Mapa de mediciones"
    />
  );
}
