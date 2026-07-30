"use client";

import { useEffect } from "react";

/**
 * Marca el HTML con clases por fabricante/SO.
 * Honor/Huawei (MagicOS) suele renderizar un poco más grande; solo densificamos.
 * No modifica altura del viewport (evita romper scroll en Xiaomi/MIUI).
 */
export function DeviceClass() {
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const root = document.documentElement;

    const isHonor =
      /Honor|HONOR|Huawei|HUAWEI|HarmonyOS|MagicUI|MagicOS/i.test(ua);
    const isXiaomi = /XiaoMi|Xiaomi|Redmi|POCO|MIUI|HyperOS/i.test(ua);

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
