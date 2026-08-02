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
 * Clases de dispositivo + full-bleed del banner.
 * - Honor (p.ej. DNP-NX9): zoom global + header al ancho del menú inferior.
 * - Xiaomi (p.ej. 24129PN74G): sin zoom (protege scroll); solo full-bleed.
 * El desfase se notaba sobre todo en Medir por el sticky-cta de borde a borde.
 */
type UaData = {
  brands?: Array<{ brand: string; version: string }>;
  getHighEntropyValues?: (
    hints: string[],
  ) => Promise<{ model?: string; fullVersionList?: Array<{ brand: string }> }>;
};

function applyBannerBleed() {
  const chrome = document.querySelector<HTMLElement>(".brand-chrome");
  if (!chrome) return;

  const root = document.documentElement;
  const needsBleed =
    root.classList.contains("is-xiaomi") || root.classList.contains("is-honor");

  if (!needsBleed) {
    chrome.style.removeProperty("width");
    chrome.style.removeProperty("max-width");
    chrome.style.removeProperty("margin-left");
    chrome.style.removeProperty("margin-right");
    chrome.style.removeProperty("left");
    chrome.style.removeProperty("right");
    chrome.style.removeProperty("position");
    return;
  }

  // Mismo criterio que sticky-cta / bottom-nav: ancho del viewport visible
  const vv = window.visualViewport;
  const vw = Math.round(vv?.width ?? window.innerWidth);
  const parentW = document.body.clientWidth || vw;
  const shift = Math.round((parentW - vw) / 2);

  chrome.style.boxSizing = "border-box";
  chrome.style.position = "relative";
  chrome.style.width = `${vw}px`;
  chrome.style.maxWidth = `${vw}px`;
  chrome.style.left = "0";
  chrome.style.marginLeft = `${shift}px`;
  chrome.style.marginRight = `${shift}px`;
  root.style.setProperty("--app-width", `${vw}px`);
}

export function DeviceClass() {
  useEffect(() => {
    const root = document.documentElement;
    const ua = navigator.userAgent || "";
    let xiaomi = isXiaomiUa(ua);
    let honor = !xiaomi && isHonorUa(ua);

    root.classList.toggle("is-xiaomi", xiaomi);
    root.classList.toggle("is-honor", honor);
    applyBannerBleed();

    let intervalId = 0;
    let reassertBound: (() => void) | null = null;
    let cancelled = false;
    let raf = 0;
    let ro: ResizeObserver | null = null;

    const scheduleBleed = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        applyBannerBleed();
      });
    };

    const activateHonor = () => {
      if (cancelled || reassertBound) return;
      if (root.classList.contains("is-xiaomi")) return;
      root.classList.add("is-honor");
      honor = true;

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
      applyBannerBleed();

      reassertBound = () => {
        reassertHonorScale();
        applyBannerBleed();
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
      applyBannerBleed();
    };

    if (honor) {
      activateHonor();
    } else if (xiaomi) {
      activateXiaomi();
    } else {
      // Client Hints: modelo real (24129PN74G / DNP-NX9) si el UA está reducido
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
    window.addEventListener("resize", scheduleBleed);
    window.visualViewport?.addEventListener("resize", scheduleBleed);
    window.visualViewport?.addEventListener("scroll", scheduleBleed);

    // Al cambiar Medir ↔ Mapa ↔ Admin el DOM del sticky-cta entra/sale
    const mo = new MutationObserver(() => scheduleBleed());
    mo.observe(document.body, { childList: true, subtree: true });

    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => scheduleBleed());
      ro.observe(document.body);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("resize", narrow);
      window.removeEventListener("resize", scheduleBleed);
      window.visualViewport?.removeEventListener("resize", scheduleBleed);
      window.visualViewport?.removeEventListener("scroll", scheduleBleed);
      mo.disconnect();
      ro?.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
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
