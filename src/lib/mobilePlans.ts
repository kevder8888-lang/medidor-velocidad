/**
 * Velocidades de referencia móvil por operador y tecnología de radio.
 * Cada operador define (comercialmente) lo ofrecido en 3G / 4G / 5G.
 * El usuario puede editar estos Mbps en el plan antes de medir.
 * CVM móvil = 70% de esa velocidad de referencia (misma regla de umbral).
 *
 * Valores por defecto: orden de magnitud típica de mercado PE (editables).
 * No son cifras oficiales OSIPTEL; son plantilla operativa.
 */

export type RadioTech = "3g" | "4g" | "5g";
export type MobileOperatorId = "Movistar" | "Claro" | "Entel" | "Bitel" | "Otro";

export interface SpeedPair {
  downMbps: number;
  upMbps: number;
}

/** Catálogo por defecto: operador → tecnología → velocidades ofrecidas */
export const MOBILE_SPEED_CATALOG: Record<
  Exclude<MobileOperatorId, "Otro">,
  Record<RadioTech, SpeedPair>
> = {
  Movistar: {
    "3g": { downMbps: 2, upMbps: 0.5 },
    "4g": { downMbps: 15, upMbps: 5 },
    "5g": { downMbps: 120, upMbps: 25 },
  },
  Claro: {
    "3g": { downMbps: 2, upMbps: 0.5 },
    "4g": { downMbps: 18, upMbps: 6 },
    "5g": { downMbps: 150, upMbps: 30 },
  },
  Entel: {
    "3g": { downMbps: 1.5, upMbps: 0.4 },
    "4g": { downMbps: 20, upMbps: 7 },
    "5g": { downMbps: 180, upMbps: 35 },
  },
  Bitel: {
    "3g": { downMbps: 1.5, upMbps: 0.4 },
    "4g": { downMbps: 12, upMbps: 4 },
    "5g": { downMbps: 80, upMbps: 15 },
  },
};

export const MOBILE_OPERATORS: MobileOperatorId[] = [
  "Movistar",
  "Claro",
  "Entel",
  "Bitel",
  "Otro",
];

export const RADIO_TECHS: { id: RadioTech; label: string }[] = [
  { id: "3g", label: "3G" },
  { id: "4g", label: "4G / LTE" },
  { id: "5g", label: "5G" },
];

export function getDefaultMobileSpeeds(
  operator: string,
  radio: RadioTech
): SpeedPair {
  const key = operator as Exclude<MobileOperatorId, "Otro">;
  if (key in MOBILE_SPEED_CATALOG) {
    return { ...MOBILE_SPEED_CATALOG[key][radio] };
  }
  // "Otro" u operador no listado
  const fallback: Record<RadioTech, SpeedPair> = {
    "3g": { downMbps: 1.5, upMbps: 0.4 },
    "4g": { downMbps: 15, upMbps: 5 },
    "5g": { downMbps: 100, upMbps: 20 },
  };
  return { ...fallback[radio] };
}

export function radioTechLabel(r: RadioTech | string | undefined): string {
  if (r === "3g") return "3G";
  if (r === "4g") return "4G / LTE";
  if (r === "5g") return "5G";
  return r || "—";
}
