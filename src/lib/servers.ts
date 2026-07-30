import type { MeasurementServer, ServerKind } from "./types";

export const PROTOCOL_VERSION = "1.1.0-mvp";
export const CLIENT_VERSION = "0.2.0";

/** CVM threshold per Ley 31207 / Reglamento de Calidad OSIPTEL */
export const CVM_THRESHOLD_PCT = 70;

/** Contract asymmetry floor: upload >= 1/3 of download */
export const ASYMMETRY_MIN_RATIO = 1 / 3;

function isBrowserLocalhost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

function originBase(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function selfHosted(kind: ServerKind = "self_hosted"): MeasurementServer {
  const base = originBase();
  const loopback = isBrowserLocalhost();
  return {
    id: "self-app",
    name: loopback ? "Nodo app (localhost)" : "Nodo propio (esta app)",
    region: loopback ? "Loopback local — no mide ISP" : "Mismo origen desplegado",
    kind,
    downloadUrl: (bytes) =>
      `${base}/api/measure/download?bytes=${bytes}&t=${Date.now()}`,
    uploadUrl: `${base}/api/measure/upload`,
    pingUrl: `${base}/api/measure/echo`,
    metaUrl: `${base}/api/measure/meta`,
    isLoopback: loopback,
    warning: loopback
      ? "En localhost este nodo mide el loopback, no tu internet. Úsalo solo para calibrar la app."
      : "Mide hacia el servidor donde está desplegada esta aplicación.",
  };
}

function cloudflare(): MeasurementServer {
  return {
    id: "cf-global",
    name: "Cloudflare Speed",
    region: "Anycast (PoP más cercano)",
    kind: "internet",
    downloadUrl: (bytes) =>
      `https://speed.cloudflare.com/__down?bytes=${bytes}&measId=${Date.now()}`,
    uploadUrl: "https://speed.cloudflare.com/__up",
    pingUrl: "https://speed.cloudflare.com/__down?bytes=0",
    metaUrl: "https://speed.cloudflare.com/meta",
    isLoopback: false,
  };
}

interface ExtraServerConfig {
  id: string;
  name: string;
  region: string;
  baseUrl: string;
}

function parseExtraServers(): MeasurementServer[] {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_EXTRA_SERVERS
      : undefined;
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as ExtraServerConfig[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((s) => s?.id && s?.baseUrl)
      .map((s) => {
        const base = s.baseUrl.replace(/\/$/, "");
        return {
          id: s.id,
          name: s.name || s.id,
          region: s.region || "Personalizado",
          kind: "custom" as const,
          downloadUrl: (bytes: number) =>
            `${base}/api/measure/download?bytes=${bytes}&t=${Date.now()}`,
          uploadUrl: `${base}/api/measure/upload`,
          pingUrl: `${base}/api/measure/echo`,
          metaUrl: `${base}/api/measure/meta`,
          isLoopback: false,
        };
      });
  } catch {
    return [];
  }
}

/** Built at call time so origin/localhost is correct in the browser. */
export function getMeasurementServers(): MeasurementServer[] {
  return [cloudflare(), selfHosted(), ...parseExtraServers()];
}

export function getServerById(id: string): MeasurementServer | undefined {
  return getMeasurementServers().find((s) => s.id === id);
}

export function getDefaultServerId(): string {
  // Prefer real internet path for ISP measurement
  return "cf-global";
}

export const DEFAULT_SERVER = cloudflare();
