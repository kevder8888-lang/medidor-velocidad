"use client";

import { useEffect } from "react";

/** Escala base Honor: ~15% más compacta (UI se veía grande en MagicOS). */
const HONOR_SCALE_DEFAULT = 0.85;
/** Si el SO infla mucho el texto, bajamos un poco más. */
const HONOR_SCALE_MIN = 0.8;

/**
 * Clases de dispositivo en <html>.
 * Honor: zoom de página más agresivo (solo is-honor).
 * Xiaomi: sin zoom (protege scroll).
 */
export function DeviceClass() {
  useEffect(() => {
    const root = document.documentElement;
    const ua = navigator.userAgent || "";

    const isXiaomi = /XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS/i.test(ua);
    const isHonor =
      !isXiaomi &&
      /Honor|HONOR|Huawei|HUAWEI|HarmonyOS|MagicUI|MagicOS/i.test(ua);

    root.classList.toggle("is-xiaomi", isXiaomi);
    root.classList.toggle("is-honor", isHonor);

    if (isHonor) {
      let scale = HONOR_SCALE_DEFAULT;
      try {
        const probe = document.createElement("div");
        probe.setAttribute("aria-hidden", "true");
        probe.style.cssText =
          "position:absolute;left:-9999px;top:0;width:auto;height:auto;" +
          "font-size:100px;line-height:100px;font-family:system-ui,sans-serif;" +
          "padding:0;margin:0;border:0;white-space:nowrap;";
        probe.textContent = "Ag";
        root.appendChild(probe);
        const h = probe.getBoundingClientRect().height || 100;
        probe.remove();
        const inflation = h / 100;
        if (inflation > 1.12) {
          scale = HONOR_SCALE_MIN;
        } else if (inflation > 1.05) {
          scale = 0.82;
        }
      } catch {
        scale = HONOR_SCALE_DEFAULT;
      }
      root.style.setProperty(
        "--honor-ui-scale",
        String(Number(scale.toFixed(3)))
      );
      // Refuerzo inline por si MagicOS tarda en aplicar la clase CSS
      root.style.zoom = String(scale);
    } else {
      root.style.removeProperty("--honor-ui-scale");
      root.style.removeProperty("zoom");
    }

    const narrow = () => {
      root.classList.toggle("is-narrow", window.innerWidth < 380);
    };
    narrow();
    window.addEventListener("resize", narrow);

    return () => {
      window.removeEventListener("resize", narrow);
      root.classList.remove("is-narrow", "is-honor", "is-xiaomi");
      root.style.removeProperty("--honor-ui-scale");
      root.style.removeProperty("zoom");
    };
  }, []);

  return null;
}
