"use client";

import { useEffect } from "react";
import {
  applyHonorScale,
  HONOR_SCALE_DEFAULT,
  HONOR_SCALE_MIN,
  isHonorUa,
  isXiaomiUa,
  reassertHonorScale,
  readStoredHonorScale,
} from "@/lib/honorScale";

/**
 * Clases de dispositivo.
 * Honor (DNP-NX9): zoom global. NO tocar anchos del banner (ya OK).
 * Xiaomi (24129PN74G): sin zoom; full-bleed del banner solo por CSS
 * (box-shadow en globals). Aquí solo se limpia basura inline de fixes viejos.
 */
type UaData = {
  brands?: Array<{ brand: string; version: string }>;
  getHighEntropyValues?: (
    hints: string[],
  ) => Promise<{ model?: string; fullVersionList?: Array<{ brand: string }> }>;
};

/** Quita anchos en px/vw que dejan el header centrado y corto (sobre todo con zoom Honor). */
function clearBannerInlineStyles() {
  const chrome = document.querySelector<HTMLElement>(".brand-chrome");
  if (!chrome) return;
  chrome.style.removeProperty("width");
  chrome.style.removeProperty("max-width");
  chrome.style.removeProperty("margin-left");
  chrome.style.removeProperty("margin-right");
  chrome.style.removeProperty("left");
  chrome.style.removeProperty("right");
  chrome.style.removeProperty("position");
  document.documentElement.style.removeProperty("--app-width");
}

export function DeviceClass() {
  useEffect(() => {
    const root = document.documentElement;
    const ua = navigator.userAgent || "";
    let xiaomi = isXiaomiUa(ua);
    let honor = !xiaomi && isHonorUa(ua);

    root.classList.toggle("is-xiaomi", xiaomi);
    root.classList.toggle("is-honor", honor);
    // Quitar width/margin en px de fixes viejos (no reintroducir en Honor ni Xiaomi)
    clearBannerInlineStyles();

    let intervalId = 0;
    let reassertBound: (() => void) | null = null;
    let cancelled = false;

    const activateHonor = () => {
      if (cancelled || reassertBound) return;
      if (root.classList.contains("is-xiaomi")) return;
      root.classList.add("is-honor");
      honor = true;
      clearBannerInlineStyles();

      let scale = readStoredHonorScale();
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
          if (ratio > 1.05) {
            const adjusted = HONOR_SCALE_DEFAULT / ratio;
            scale = Math.max(
              HONOR_SCALE_MIN,
              Math.min(HONOR_SCALE_DEFAULT, adjusted),
            );
          }
        } catch {
          /* keep default */
        }
      }
      applyHonorScale(scale);
      clearBannerInlineStyles();

      reassertBound = () => {
        reassertHonorScale();
        // Tras reassert de zoom, no reintroducir widths en px
        clearBannerInlineStyles();
      };

      window.addEventListener("resize", reassertBound);
      window.addEventListener("pageshow", reassertBound);
      window.addEventListener("focus", reassertBound);
      document.addEventListener("visibilitychange", reassertBound);
      document.addEventListener("click", reassertBound, true);
      document.addEventListener("touchend", reassertBound, true);
      intervalId = window.setInterval(reassertBound, 600);
    };

    const activateXiaomi = () => {
      if (cancelled) return;
      root.classList.add("is-xiaomi");
      root.classList.remove("is-honor");
      root.style.zoom = "normal";
      xiaomi = true;
      honor = false;
      clearBannerInlineStyles();
    };

    if (honor) {
      activateHonor();
    } else if (xiaomi) {
      activateXiaomi();
    } else {
      const uaData = (navigator as unknown as { userAgentData?: UaData })
        .userAgentData;
      const brands = (uaData?.brands ?? []).map((b) => b.brand).join(" ");
      if (isXiaomiUa(brands)) {
        activateXiaomi();
      } else if (isHonorUa(brands)) {
        activateHonor();
      } else {
        uaData
          ?.getHighEntropyValues?.(["model", "fullVersionList"])
          .then((info) => {
            if (cancelled) return;
            const model = info?.model ?? "";
            const list = (info?.fullVersionList ?? [])
              .map((b) => b.brand)
              .join(" ");
            const blob = `${model} ${list}`;
            if (isXiaomiUa(blob) || isXiaomiUa(model)) activateXiaomi();
            else if (isHonorUa(blob) || isHonorUa(model)) activateHonor();
          })
          .catch(() => {
            /* ignore */
          });
      }
    }

    const narrow = () => {
      root.classList.toggle("is-narrow", window.innerWidth < 380);
    };
    narrow();
    window.addEventListener("resize", narrow);

    // Si React remonta el header, quitar estilos inline residuales
    const mo = new MutationObserver(() => clearBannerInlineStyles());
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", narrow);
      mo.disconnect();
      if (reassertBound) {
        window.removeEventListener("resize", reassertBound);
        window.removeEventListener("pageshow", reassertBound);
        window.removeEventListener("focus", reassertBound);
        document.removeEventListener("visibilitychange", reassertBound);
        document.removeEventListener("click", reassertBound, true);
        document.removeEventListener("touchend", reassertBound, true);
      }
      if (intervalId) window.clearInterval(intervalId);
      root.classList.remove("is-narrow");
    };
  }, []);

  return null;
}
