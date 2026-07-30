"use client";

import { useEffect } from "react";

/**
 * Marca el HTML con clases por fabricante/SO.
 *
 * - is-honor: SOLO Honor/Huawei/MagicOS — densificación y header especial.
 * - is-xiaomi: Xiaomi/MIUI — NO recibe reglas de Honor (scroll y layout intactos).
 * No modifica altura del viewport.
 */
export function DeviceClass() {
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const root = document.documentElement;

    const isXiaomi = /XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS/i.test(ua);
    // Honor no se marca si el UA es Xiaomi (por si acaso hay solapamiento raro)
    const isHonor =
      !isXiaomi &&
      /Honor|HONOR|Huawei|HUAWEI|HarmonyOS|MagicUI|MagicOS/i.test(ua);

    root.classList.toggle("is-honor", isHonor);
    root.classList.toggle("is-xiaomi", isXiaomi);

    // Ancho CSS (sin fijar altura)
    const narrow = () => {
      root.classList.toggle("is-narrow", window.innerWidth < 380);
    };
    narrow();
    window.addEventListener("resize", narrow);
    return () => {
      window.removeEventListener("resize", narrow);
      root.classList.remove("is-honor", "is-xiaomi", "is-narrow");
    };
  }, []);

  return null;
}
