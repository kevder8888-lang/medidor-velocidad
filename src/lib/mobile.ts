/** Helpers for mobile / Android UX */

export function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

/**
 * Keep screen awake during long speed tests (Android Chrome supports this).
 */
export async function requestWakeLock(): Promise<WakeLockSentinel | null> {
  try {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wl = await (navigator as any).wakeLock.request("screen");
    return wl as WakeLockSentinel;
  } catch {
    return null;
  }
}

export async function releaseWakeLock(
  lock: WakeLockSentinel | null
): Promise<void> {
  try {
    await lock?.release();
  } catch {
    /* ignore */
  }
}
