/** Escala global Honor (todas las pestañas). Persistida para no perderse al cambiar vista. */

export const HONOR_SCALE_DEFAULT = 0.7;
export const HONOR_SCALE_MIN = 0.55;
const STORAGE_KEY = "osiptel-honor-ui-scale";

/**
 * Google Chrome en Android NO incluye la marca ("Honor"/"MagicOS") en su
 * User-Agent — solo el código de modelo interno, ej.:
 * "Mozilla/5.0 (Linux; Android 14; FNE-NX9) AppleWebKit/537.36 ...".
 * Por eso el chequeo por marca nunca detectaba un Honor 70 real: is-honor
 * jamás se aplicaba y ningún fix de zoom llegaba a ejecutarse.
 * Se agregan códigos de modelo Honor conocidos; sumar más aquí si se
 * reportan otros equipos (el modelo se puede pedir al usuario o leerse
 * desde navigator.userAgentData.getHighEntropyValues(["model"])).
 */
/**
 * Códigos de modelo (Chrome a menudo no envía la marca, solo esto).
 * Honor 400 Pro MagicOS 10 → DNP-NX9
 * Honor 70 y series previas → FNE / CRT / REA / ANY
 */
const HONOR_MODEL_CODES =
  /\bDNP-NX9\b|\bFNE-(NX9|AN00|LX1)\b|\bCRT-(NX1|N09|LX1)\b|\bREA-(NX9|AN00)\b|\bANY-(NX1|LX1|AN00)\b/i;

/** Xiaomi 15 y variantes; HyperOS a menudo solo expone el código. */
const XIAOMI_MODEL_CODES =
  /\b24129PN74[CG]\b|\b24129PN74G\b|\b2410DPN6CC\b|\b24117RN76[LO]\b/i;

export function isXiaomiUa(
  ua = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  if (!ua) return false;
  if (/XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS|MiuiBrowser/i.test(ua)) return true;
  return XIAOMI_MODEL_CODES.test(ua);
}

export function isHonorUa(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  if (isXiaomiUa(ua)) return false;
  if (/Honor|HONOR|Huawei|HUAWEI|HarmonyOS|MagicUI|MagicOS/i.test(ua)) return true;
  return HONOR_MODEL_CODES.test(ua);
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

/**
 * Aplica la reducción vía CSS zoom en <html>.
 * Se probó initial-scale del meta viewport, pero mutar el atributo
 * `content` después de la carga NO fuerza a Chrome/MagicOS a re-zoomear
 * — solo se lee en la carga inicial. Eso dejaba el reassert al cambiar
 * de pestaña sin efecto real. `style.zoom` es una escritura de estilo
 * síncrona: siempre se re-aplica al instante, por eso es el mecanismo
 * fiable para "reafirmar" tras cada cambio de vista.
 */
function honorActive(): boolean {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("is-honor")) {
    return true;
  }
  // Nunca en Xiaomi (aunque el modelo se haya marcado por Client Hints)
  if (typeof document !== "undefined" && document.documentElement.classList.contains("is-xiaomi")) {
    return false;
  }
  return isHonorUa();
}

export function applyHonorScale(scale?: number): void {
  if (typeof document === "undefined") return;
  if (!honorActive()) return;

  const root = document.documentElement;
  const s = scale ?? readStoredHonorScale();
  const value = String(Number(s.toFixed(3)));

  root.classList.add("is-honor");
  root.style.setProperty("--honor-ui-scale", value);
  root.style.zoom = value;
  storeHonorScale(s);

  if (document.body) {
    // Evitar doble zoom; body no reescala por su cuenta
    document.body.style.zoom = "1";
  }
}

/** Reafirma el zoom si MagicOS lo quitó al cambiar de pestaña / mapa. */
export function reassertHonorScale(): void {
  if (typeof document === "undefined") return;
  if (!honorActive()) return;
  const root = document.documentElement;
  const expected = readStoredHonorScale();
  const current = Number(root.style.zoom) || 0;
  if (
    !root.classList.contains("is-honor") ||
    Math.abs(current - expected) > 0.01 ||
    root.style.getPropertyValue("--honor-ui-scale") !== String(expected)
  ) {
    applyHonorScale(expected);
  }
}
