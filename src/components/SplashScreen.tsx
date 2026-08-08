"use client";

import { useEffect, useState } from "react";

/** Alineado a Bitácora Digital: 1200 ms visibles + 400 ms fade. */
const DISPLAY_MS = 1200;
const FADE_MS = 400;

/**
 * Pantalla de carga: degradado blanco → #0056AC + arte de marca.
 */
export function SplashScreen({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFade(true), DISPLAY_MS);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, DISPLAY_MS + FADE_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [onDone]);

  if (!visible) return null;

  return (
    <div
      className={`splash-screen ${fade ? "splash-out" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Cargando medidor de velocidad"
    >
      <div className="splash-inner">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/splash.png"
          alt=""
          className="splash-img"
          decoding="async"
        />
      </div>
    </div>
  );
}
