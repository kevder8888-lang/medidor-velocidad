"use client";

import { useEffect } from "react";

/** Escala Honor: ~25% más compacta (UI desbordaba en MagicOS). */
const HONOR_SCALE_DEFAULT = 0.75;
const HONOR_SCALE_MIN = 0.72;

function detectHonor(ua: string): boolean {
  const isXiaomi = /XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS/i.test(ua);
  if (isXiaomi) return false;
  return /Honor|HONOR|Huawei|HUAWEI|HarmonyOS|MagicUI|MagicOS/i.test(ua);
}

function applyHonorScale(root: HTMLElement, scale: number) {
  const s = String(Number(scale.toFixed(3)));
  root.classList.add("is-honor");
  root.style.setProperty("--honor-ui-scale", s);
  // Inline: MagicOS a veces ignora solo la clase CSS
  root.style.zoom = s;
  // Aplica también a body para que mapa/admin/fixed hereden igual
  if (document.body) {
    document.body.style.zoom = "1";
  }
}

/**
 * Clases de dispositivo. Honor: zoom global en TODAS las pestañas
 * (Medir, Mapa local, Historial, Admin). Xiaomi: sin zoom.
 */
export function DeviceClass() {
  useEffect(() => {
    const root = document.documentElement;
    const ua = navigator.userAgent || "";
    const isXiaomi = /XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS/i.test(ua);
    const isHonor = detectHonor(ua);

    root.classList.toggle("is-xiaomi", isXiaomi);
    root.classList.toggle("is-honor", isHonor);

    if (isHonor) {
      let scale = HONOR_SCALE_DEFAULT;
      try {
        const probe = document.createElement("div");
        probe.setAttribute("aria-hidden", "true");
        probe.style.cssText =
          "position:absolute;left:-9999px;top:0;" +
          "font-size:100px;line-height:100px;font-family:system-ui,sans-serif;" +
          "padding:0;margin:0;border:0;";
        probe.textContent = "Ag";
        root.appendChild(probe);
        const h = probe.getBoundingClientRect().height || 100;
        probe.remove();
        if (h / 100 > 1.1) scale = HONOR_SCALE_MIN;
      } catch {
        scale = HONOR_SCALE_DEFAULT;
      }
      applyHonorScale(root, scale);

      // Reaplicar al cambiar de pestaña / reflows (mapa Leaflet, admin)
      const reassert = () => {
        if (root.classList.contains("is-honor")) {
          const current =
            root.style.getPropertyValue("--honor-ui-scale") ||
            String(HONOR_SCALE_DEFAULT);
          root.style.zoom = current;
        }
      };
      window.addEventListener("resize", reassert);
      // MutationObserver ligero no; resize + pageshow bastan
      window.addEventListener("pageshow", reassert);

      const narrow = () => {
        root.classList.toggle("is-narrow", window.innerWidth < 380);
      };
      narrow();
      window.addEventListener("resize", narrow);

      return () => {
        window.removeEventListener("resize", reassert);
        window.removeEventListener("pageshow", reassert);
        window.removeEventListener("resize", narrow);
        root.classList.remove("is-narrow", "is-honor", "is-xiaomi");
        root.style.removeProperty("--honor-ui-scale");
        root.style.removeProperty("zoom");
      };
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
