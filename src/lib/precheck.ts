import type { AccessType, PreCheckResult } from "./types";

interface NetworkInformation {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

function mapConnectionType(raw: string | undefined): AccessType {
  if (!raw) return "unknown";
  const t = raw.toLowerCase();
  if (t === "ethernet" || t === "wired") return "ethernet";
  if (t === "wifi" || t === "wlan") return "wifi";
  if (t === "cellular" || t === "cell" || t === "wimax") return "cellular";
  return "unknown";
}

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

/**
 * Best-effort environment pre-check.
 * Browsers expose limited link info; SIM operator is NOT available on web.
 */
export async function runPrecheck(): Promise<PreCheckResult> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const conn = (nav as Navigator & { connection?: NetworkInformation })
    ?.connection;

  const networkTypeRaw = conn?.type ?? null;
  const connectionType = mapConnectionType(conn?.type);
  const effectiveType = conn?.effectiveType ?? null;
  const downlinkMbpsHint =
    typeof conn?.downlink === "number" ? conn.downlink : null;
  const rttHintMs = typeof conn?.rtt === "number" ? conn.rtt : null;
  const saveData = Boolean(conn?.saveData);

  const ua = nav?.userAgent ?? "unknown";
  const isAndroid = /Android/i.test(ua);
  const isMobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

  const pageOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  const isLocalhostApp =
    typeof window !== "undefined"
      ? isLocalhostHost(window.location.hostname)
      : false;

  // Soft VPN hint: not reliable from browser alone
  const vpnHint = false;

  return {
    online: nav?.onLine ?? true,
    connectionType,
    networkTypeRaw,
    effectiveType,
    downlinkMbpsHint,
    rttHintMs,
    saveData,
    hardwareConcurrency: nav?.hardwareConcurrency ?? 4,
    deviceMemoryGb:
      typeof (nav as Navigator & { deviceMemory?: number })?.deviceMemory ===
      "number"
        ? (nav as Navigator & { deviceMemory?: number }).deviceMemory!
        : null,
    vpnHint,
    userAgent: ua,
    timestamp: new Date().toISOString(),
    pageOrigin,
    isLocalhostApp,
    isAndroid,
    isMobileUa,
  };
}
