"use client";

import { useEffect } from "react";

/**
 * Sincroniza CSS vars con visualViewport (Chrome/Honor/Huawei).
 * Reduce saltos de tamaño al mostrar/ocultar la barra de URL.
 */
export function ViewportSync() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const vv = window.visualViewport;
      const ih = window.innerHeight;
      const iw = window.innerWidth;

      // Altura visible real del viewport
      const vh = vv?.height ?? ih;
      const vw = vv?.width ?? iw;

      // Espacio inferior “comido” por chrome del navegador / teclado
      let bottomGap = 0;
      if (vv) {
        bottomGap = Math.max(0, ih - vv.height - vv.offsetTop);
      }

      root.style.setProperty("--app-vh", `${vh * 0.01}px`);
      root.style.setProperty("--app-height", `${vh}px`);
      root.style.setProperty("--app-width", `${vw}px`);
      root.style.setProperty("--vv-bottom", `${bottomGap}px`);

      // Detectar pantallas estrechas / densas (Honor 70 ~360–400 CSS px)
      root.classList.toggle("is-narrow", vw < 380);
      root.classList.toggle("is-short", vh < 640);
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);

    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
    };
  }, []);

  return null;
}
