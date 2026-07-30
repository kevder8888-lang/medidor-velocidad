/** Escala global Honor (todas las pestañas). Persistida para no perderse al cambiar vista. */

export const HONOR_SCALE_DEFAULT = 0.7;
export const HONOR_SCALE_MIN = 0.55;
const STORAGE_KEY = "osiptel-honor-ui-scale";

export function isHonorUa(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (/XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS/i.test(ua)) return false;
  return /Honor|HONOR|Huawei|HUAWEI|HarmonyOS|MagicUI|MagicOS/i.test(ua);
}

export function readStoredHonorScale(): number {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    if (v) {
      const n = Number(v);
      if (n >= HONOR_SCALE_MIN && n <= 0.95) return n;
    }
  } catch {
    /* private mode */
  }
  return HONOR_SCALE_DEFAULT;
}

export function storeHonorScale(scale: number): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(scale));
  } catch {
    /* ignore */
  }
}

function viewportMeta(): HTMLMetaElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector('meta[name="viewport"]');
}

/**
 * Aplica la reducción vía viewport initial-scale (no CSS zoom).
 * El zoom de CSS resultó poco fiable en el WebView de MagicOS/Honor;
 * initial-scale del meta viewport es el mecanismo estándar que todo
 * navegador móvil respeta, incluidos los forks de Chromium de fabricante.
 */
export function applyHonorScale(scale?: number): void {
  if (typeof document === "undefined") return;
  if (!isHonorUa()) return;

  const root = document.documentElement;
  const s = scale ?? readStoredHonorScale();
  const value = String(Number(s.toFixed(3)));

  root.classList.add("is-honor");
  root.style.setProperty("--honor-ui-scale", value);

  const meta = viewportMeta();
  if (meta) {
    meta.setAttribute(
      "content",
      `width=device-width, initial-scale=${value}, minimum-scale=${value}, maximum-scale=5, viewport-fit=cover`
    );
  }
  storeHonorScale(s);
}

/** Reafirma la escala si MagicOS la quitó al cambiar de pestaña / mapa. */
export function reassertHonorScale(): void {
  if (typeof document === "undefined") return;
  if (!isHonorUa()) return;
  const root = document.documentElement;
  const expected = readStoredHonorScale();
  const expectedStr = String(Number(expected.toFixed(3)));
  const meta = viewportMeta();
  const content = meta?.getAttribute("content") || "";
  if (
    !root.classList.contains("is-honor") ||
    !content.includes(`initial-scale=${expectedStr}`) ||
    root.style.getPropertyValue("--honor-ui-scale") !== expectedStr
  ) {
    applyHonorScale(expected);
  }
}
