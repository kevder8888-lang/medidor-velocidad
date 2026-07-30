"use client";

import { useEffect } from "react";

/**
 * Utilidades de clase en <html> (sin overrides por fabricante).
 * Solo marca pantallas muy estrechas para un poco más de padding lateral.
 * No densifica ni reescala UI en Honor/Xiaomi/etc.
 */
export function DeviceClass() {
  useEffect(() => {
    const root = document.documentElement;

    const narrow = () => {
      root.classList.toggle("is-narrow", window.innerWidth < 380);
    };
    narrow();
    window.addEventListener("resize", narrow);
    return () => {
      window.removeEventListener("resize", narrow);
      root.classList.remove("is-narrow", "is-honor", "is-xiaomi");
    };
  }, []);

  return null;
}
