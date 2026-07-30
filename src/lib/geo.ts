export interface DeviceGeo {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  altitudeM: number | null;
  altitudeAccuracyM: number | null;
  heading: number | null;
  speedMps: number | null;
  timestamp: string;
  source: "device_gps" | "device_network" | "unknown";
}

export type GeoStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; position: DeviceGeo }
  | { state: "error"; message: string };

function mapPosition(pos: GeolocationPosition): DeviceGeo {
  const c = pos.coords;
  // high accuracy GPS often has accuracy < 50m
  const source: DeviceGeo["source"] =
    c.accuracy != null && c.accuracy <= 50
      ? "device_gps"
      : c.accuracy != null
        ? "device_network"
        : "unknown";

  return {
    latitude: c.latitude,
    longitude: c.longitude,
    accuracyM: typeof c.accuracy === "number" ? c.accuracy : null,
    altitudeM: typeof c.altitude === "number" ? c.altitude : null,
    altitudeAccuracyM:
      typeof c.altitudeAccuracy === "number" ? c.altitudeAccuracy : null,
    heading: typeof c.heading === "number" ? c.heading : null,
    speedMps: typeof c.speed === "number" ? c.speed : null,
    timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
    source,
  };
}

/**
 * Geolocalización del equipo (GPS/red del dispositivo).
 * En Android Chrome pide permiso y usa el sensor del teléfono.
 */
export function getDevicePosition(options?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
  highAccuracy?: boolean;
}): Promise<DeviceGeo> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalización no disponible en este navegador."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(mapPosition(pos)),
      (err) => {
        let msg = "No se pudo obtener la ubicación.";
        if (err.code === err.PERMISSION_DENIED) {
          msg =
            "Permiso de ubicación denegado. Actívalo en Ajustes del navegador/Android.";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = "Ubicación no disponible. Activa GPS/ubicación del dispositivo.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Tiempo agotado al obtener GPS. Intenta de nuevo al aire libre.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: options?.highAccuracy ?? true,
        timeout: options?.timeoutMs ?? 20_000,
        maximumAge: options?.maximumAgeMs ?? 10_000,
      }
    );
  });
}

export function formatCoords(lat: number, lon: number, digits = 5): string {
  return `${lat.toFixed(digits)}, ${lon.toFixed(digits)}`;
}

export function osmEmbedUrl(lat: number, lon: number, zoom = 16): string {
  const d = 0.01;
  const left = lon - d;
  const right = lon + d;
  const top = lat + d;
  const bottom = lat - d;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export function osmExternalUrl(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}

/** API key de Google Maps (definida en .env.local o Vercel) */
export function getGoogleMapsApiKey(): string | null {
  const k = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!k || !String(k).trim()) return null;
  return String(k).trim();
}

export function hasGoogleMaps(): boolean {
  return Boolean(getGoogleMapsApiKey());
}

/**
 * Maps Embed API — requiere Maps Embed API habilitada en Google Cloud.
 * https://developers.google.com/maps/documentation/embed/get-started
 */
export function googleMapsEmbedUrl(
  lat: number,
  lon: number,
  zoom = 16
): string | null {
  const key = getGoogleMapsApiKey();
  if (!key) return null;
  const q = encodeURIComponent(`${lat},${lon}`);
  return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${q}&zoom=${zoom}&language=es`;
}

/** Enlace externo a Google Maps (no requiere key en la URL pública del usuario) */
export function googleMapsExternalUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}&z=17&hl=es`;
}

/** Elige Google si hay key; si no, OpenStreetMap */
export function mapEmbedUrl(lat: number, lon: number, zoom = 16): string {
  return googleMapsEmbedUrl(lat, lon, zoom) ?? osmEmbedUrl(lat, lon, zoom);
}

export function mapExternalUrl(lat: number, lon: number): string {
  return hasGoogleMaps()
    ? googleMapsExternalUrl(lat, lon)
    : osmExternalUrl(lat, lon);
}

export function mapProviderLabel(): "Google Maps" | "OpenStreetMap" {
  return hasGoogleMaps() ? "Google Maps" : "OpenStreetMap";
}
