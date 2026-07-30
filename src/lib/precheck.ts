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
 * Browsers expose limited link info; we never claim absolute certainty.
 */
export async function runPrecheck(): Promise<PreCheckResult> {
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const conn = (nav as Navigator & { connection?: NetworkInformation })
    ?.connection;

  const connectionType = mapConnectionType(conn?.type);
  const effectiveType = conn?.effectiveType ?? null;
  const downlinkMbpsHint =
    typeof conn?.downlink === "number" ? conn.downlink : null;
  const rttHintMs = typeof conn?.rtt === "number" ? conn.rtt : null;
  const saveData = Boolean(conn?.saveData);

  const pageOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  const isLocalhostApp =
    typeof window !== "undefined"
      ? isLocalhostHost(window.location.hostname)
      : false;

  // Soft heuristic: WebRTC local candidates vs public would be better;
  // for MVP keep false unless saveData + offline combos appear later.
  const vpnHint = false;

  return {
    online: nav?.onLine ?? true,
    connectionType,
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
    userAgent: nav?.userAgent ?? "unknown",
    timestamp: new Date().toISOString(),
    pageOrigin,
    isLocalhostApp,
  };
}
