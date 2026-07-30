"use client";

import { useEffect, useState } from "react";
import { isAndroid } from "@/lib/mobile";

const MIN_MS = 1600;
const MAX_MS = 3200;

/**
 * Pantalla de carga inicial (prioridad Android).
 * Muestra el arte de marca mientras hidrata la app.
 */
export function SplashScreen({ onDone }: { onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  const [fade, setFade] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Mostrar en Android siempre; en desktop muy breve o omitible
    const android = isAndroid();
    setShow(android || true); // todos ven splash; Android un poco más largo

    const min = android ? MIN_MS : 900;
    const max = android ? MAX_MS : 1400;
    const t0 = Date.now();

    const finish = () => {
      const elapsed = Date.now() - t0;
      const wait = Math.max(0, min - elapsed);
      window.setTimeout(() => {
        setFade(true);
        window.setTimeout(() => {
          setVisible(false);
          onDone?.();
        }, 380);
      }, wait);
    };

    // Esperar a que la imagen cargue o timeout max
    const img = new Image();
    img.src = "/brand/splash.png";
    let done = false;
    const once = () => {
      if (done) return;
      done = true;
      finish();
    };
    img.onload = once;
    img.onerror = once;
    const cap = window.setTimeout(once, max);

    return () => {
      window.clearTimeout(cap);
    };
  }, [onDone]);

  if (!visible || !show) return null;

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
          alt="Medidor de velocidad OSIPTEL"
          className="splash-img"
          decoding="async"
        />
        <div className="splash-bar" aria-hidden>
          <span />
        </div>
        <p className="splash-text">Cargando…</p>
      </div>
    </div>
  );
}
