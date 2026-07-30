"use client";

import { useEffect } from "react";

/**
 * Clases de dispositivo en <html>.
 *
 * Honor/Huawei (MagicOS) a menudo pinta la UI un poco más grande que
 * Chrome stock / Xiaomi. Buenas prácticas (solo is-honor):
 *  1. -webkit-text-size-adjust: 100% → frena inflación de texto del motor
 *  2. zoom CSS (Chromium) → escala layout + fixed de forma uniforme
 *     (mejor que transform:scale, que rompe position:fixed y el scroll)
 *  3. Escala suave 0.92–0.96 según medición ligera; nunca en Xiaomi
 *
 * is-narrow: solo padding en pantallas < 380px (todos los fabricantes).
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
      // Escala base ~6% más compacta; afinamos si el texto del sistema infla
      let scale = 0.94;
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
        // En render “normal” ~100–110; si el SO infla mucho, h sube
        const inflation = h / 100;
        if (inflation > 1.08) {
          // Compensar parte de la inflación del sistema (tope suave)
          scale = Math.max(0.9, Math.min(0.94, 0.94 / (inflation * 0.5 + 0.5)));
        } else if (inflation > 1.02) {
          scale = 0.93;
        }
      } catch {
        scale = 0.94;
      }
      root.style.setProperty("--honor-ui-scale", String(Number(scale.toFixed(3))));
    } else {
      root.style.removeProperty("--honor-ui-scale");
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
    };
  }, []);

  return null;
}
