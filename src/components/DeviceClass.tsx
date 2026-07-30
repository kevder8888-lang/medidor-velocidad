"use client";

import { useEffect } from "react";
import {
  applyHonorScale,
  HONOR_SCALE_DEFAULT,
  HONOR_SCALE_MIN,
  isHonorUa,
  reassertHonorScale,
  readStoredHonorScale,
} from "@/lib/honorScale";

/**
 * Clases de dispositivo.
 * Honor: zoom global persistente en Medir / Mapa / Historial / Admin.
 * Se reafirma al cambiar de pestaña (MagicOS a veces resetea zoom).
 */
type UaData = {
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }>;
};

export function DeviceClass() {
  useEffect(() => {
    const root = document.documentElement;
    const ua = navigator.userAgent || "";
    const isXiaomi = /XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS/i.test(ua);
    const isHonor = isHonorUa(ua);

    root.classList.toggle("is-xiaomi", isXiaomi);
    root.classList.toggle("is-honor", isHonor);

    let intervalId = 0;
    let reassertBound: (() => void) | null = null;
    let cancelled = false;

    const activateHonor = () => {
      if (cancelled || reassertBound) return; // ya activo
      root.classList.add("is-honor");

      let scale = readStoredHonorScale();
      // Primera visita: medir inflación una sola vez
      if (scale === HONOR_SCALE_DEFAULT) {
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
          const ratio = h / 100;
          // Compensación proporcional a la inflación real medida,
          // en vez de saltar a un valor fijo adivinado.
          if (ratio > 1.05) {
            const adjusted = HONOR_SCALE_DEFAULT / ratio;
            scale = Math.max(HONOR_SCALE_MIN, Math.min(HONOR_SCALE_DEFAULT, adjusted));
          }
        } catch {
          /* keep default */
        }
      }
      applyHonorScale(scale);

      reassertBound = () => reassertHonorScale();

      // MagicOS pierde zoom al montar mapa / cambiar pestaña
      window.addEventListener("resize", reassertBound);
      window.addEventListener("pageshow", reassertBound);
      window.addEventListener("focus", reassertBound);
      document.addEventListener("visibilitychange", reassertBound);
      // Clics de navegación inferior (captura, antes del setState)
      document.addEventListener("click", reassertBound, true);
      document.addEventListener("touchend", reassertBound, true);

      // Reafirmación periódica ligera (solo Honor)
      intervalId = window.setInterval(reassertBound, 600);
    };

    if (isHonor) {
      activateHonor();
    } else if (!isXiaomi) {
      // Chrome en Android puede reducir el UA y ocultar el modelo real
      // (ej. "FNE-NX9" desaparece del navigator.userAgent). Client Hints
      // sí expone el modelo real sin depender del string del UA.
      const uaData = (navigator as unknown as { userAgentData?: UaData })
        .userAgentData;
      uaData
        ?.getHighEntropyValues?.(["model"])
        .then((info) => {
          if (!cancelled && info?.model && isHonorUa(info.model)) {
            activateHonor();
          }
        })
        .catch(() => {
          /* API no disponible o rechazada: sin cambios */
        });
    }

    const narrow = () => {
      root.classList.toggle("is-narrow", window.innerWidth < 380);
    };
    narrow();
    window.addEventListener("resize", narrow);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", narrow);
      if (reassertBound) {
        window.removeEventListener("resize", reassertBound);
        window.removeEventListener("pageshow", reassertBound);
        window.removeEventListener("focus", reassertBound);
        document.removeEventListener("visibilitychange", reassertBound);
        document.removeEventListener("click", reassertBound, true);
        document.removeEventListener("touchend", reassertBound, true);
      }
      if (intervalId) window.clearInterval(intervalId);
      // NO quitar zoom en cleanup de Strict Mode: se reaplicará al remontar.
      // Solo limpia clases auxiliares no críticas.
      root.classList.remove("is-narrow");
    };
  }, []);

  return null;
}
