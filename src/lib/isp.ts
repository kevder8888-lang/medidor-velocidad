import type { AccessType, ServerMetaInfo } from "./types";

export type NetworkAccessKind =
  | "ethernet"
  | "wifi"
  | "cellular"
  | "unknown";

export interface IspIdentity {
  /** Brand name if mapped (Movistar, Claro, …) */
  brand: string | null;
  /** Organization from ASN registry / CF meta */
  organization: string | null;
  asn: number | null;
  clientIp: string | null;
  country: string | null;
  city: string | null;
  colo: string | null;
  /** How we inferred the name */
  source: "asn_map" | "org_heuristic" | "org_raw" | "none";
  /** Fixed ISP vs mobile carrier estimate */
  category: "fixed_isp" | "mobile_operator" | "hosting_vpn" | "unknown";
  /** Human label for UI */
  displayName: string;
  /** Confidence of brand mapping */
  confidence: "alta" | "media" | "baja";
  notes: string[];
}

/** Safe string from unknown API fields (avoids "[object Object]") */
export function safeText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t || t === "[object Object]") return null;
    return t;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    // common nested shapes
    for (const key of ["name", "city", "country", "label", "value", "code"]) {
      if (typeof o[key] === "string" && o[key]) {
        return String(o[key]).trim();
      }
    }
    return null;
  }
  return null;
}

/**
 * Commercial brand mapping for Peru.
 * Order matters: more specific rules first (viettel before entel).
 *
 * - América Móvil Perú S.A.C. → Claro
 * - Integratel / Telefónica → Movistar
 * - Viettel Peru S.A.C. → Bitel
 * - Entel Perú S.A. → Entel
 */
const ORG_RULES: {
  re: RegExp;
  brand: string;
  category: IspIdentity["category"];
}[] = [
  // Bitel (Viettel) — MUST be before any "entel" rule (VIETTEL contains letters near entel in some fonts/OCR; also org names)
  { re: /viettel|bitel/i, brand: "Bitel", category: "mobile_operator" },
  // Claro (América Móvil)
  {
    re: /america\s*movil|am[eé]rica\s*m[oó]vil|am[eé]rica\s*movil|claro\s*per[uú]|claro/i,
    brand: "Claro",
    category: "fixed_isp",
  },
  // Movistar (Telefónica / Integratel)
  {
    re: /integratel|telefonica|telef[oó]nica|movistar/i,
    brand: "Movistar",
    category: "fixed_isp",
  },
  // Entel — require "entel" not as part of "viettel"
  {
    re: /(?<!vi)entel(\s*per[uú]|\s*s\.?\s*a|\b)/i,
    brand: "Entel",
    category: "mobile_operator",
  },
  { re: /\bwin\b|win\s*empresas/i, brand: "WIN", category: "fixed_isp" },
  { re: /optical/i, brand: "Optical", category: "fixed_isp" },
  { re: /\bwow\b/i, brand: "WOW", category: "fixed_isp" },
  { re: /fiberlux|fiber\s*lux/i, brand: "FiberLux", category: "fixed_isp" },
  { re: /starlink|spacex/i, brand: "Starlink", category: "fixed_isp" },
  { re: /cloudflare/i, brand: "Cloudflare", category: "hosting_vpn" },
  { re: /amazon|aws/i, brand: "Amazon AWS", category: "hosting_vpn" },
  { re: /google/i, brand: "Google", category: "hosting_vpn" },
  { re: /microsoft|azure/i, brand: "Microsoft", category: "hosting_vpn" },
  {
    re: /digitalocean|linode|vultr|ovh|hetzner/i,
    brand: "Hosting/VPS",
    category: "hosting_vpn",
  },
];

/** ASN map (secondary; org string wins when it clearly maps) */
const ASN_BRAND: Record<
  number,
  { brand: string; category: IspIdentity["category"] }
> = {
  // Telefónica / Movistar / Integratel
  6147: { brand: "Movistar", category: "fixed_isp" },
  12252: { brand: "Movistar", category: "fixed_isp" },
  19114: { brand: "Movistar", category: "mobile_operator" },
  // América Móvil / Claro
  19180: { brand: "Claro", category: "fixed_isp" },
  21575: { brand: "Claro", category: "mobile_operator" },
  // WIN
  27843: { brand: "WIN", category: "fixed_isp" },
  // Viettel / Bitel
  265691: { brand: "Bitel", category: "mobile_operator" },
  // Entel (verify; org string takes priority if conflict)
  262210: { brand: "Entel", category: "mobile_operator" },
  22411: { brand: "Entel", category: "mobile_operator" },
  // Others
  3132: { brand: "RCP / Internet", category: "fixed_isp" },
  10569: { brand: "Red Científica Peruana", category: "fixed_isp" },
  28032: { brand: "Internexa", category: "fixed_isp" },
  263189: { brand: "Optical Technologies", category: "fixed_isp" },
  52227: { brand: "WOW", category: "fixed_isp" },
  264668: { brand: "FiberLux", category: "fixed_isp" },
  13335: { brand: "Cloudflare", category: "hosting_vpn" },
  15169: { brand: "Google", category: "hosting_vpn" },
  16509: { brand: "Amazon AWS", category: "hosting_vpn" },
  8075: { brand: "Microsoft", category: "hosting_vpn" },
};

function parseAsn(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const m = raw.replace(/^AS/i, "").trim();
    const n = Number(m);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function matchOrg(
  organization: string
): { brand: string; category: IspIdentity["category"] } | null {
  const org = organization.trim();
  // Explicit checks first (clear and robust)
  const lower = org.toLowerCase();
  if (lower.includes("viettel") || lower.includes("bitel")) {
    return { brand: "Bitel", category: "mobile_operator" };
  }
  if (
    lower.includes("america movil") ||
    lower.includes("américa móvil") ||
    lower.includes("america móvil") ||
    lower.includes("américa movil") ||
    (lower.includes("claro") && lower.includes("peru"))
  ) {
    return { brand: "Claro", category: "fixed_isp" };
  }
  if (lower.includes("integratel")) {
    return { brand: "Movistar", category: "fixed_isp" };
  }
  if (
    lower.includes("telefonica") ||
    lower.includes("telefónica") ||
    lower.includes("movistar")
  ) {
    return { brand: "Movistar", category: "fixed_isp" };
  }
  // Entel but not Viettel (already handled)
  if (/\bentel\b/i.test(org) && !/viettel/i.test(org)) {
    return { brand: "Entel", category: "mobile_operator" };
  }

  for (const rule of ORG_RULES) {
    if (rule.re.test(org)) {
      return { brand: rule.brand, category: rule.category };
    }
  }
  return null;
}

export function mapAccessKind(
  connectionType: AccessType | string | undefined,
  networkTypeRaw?: string | null
): NetworkAccessKind {
  const t = (networkTypeRaw || connectionType || "").toLowerCase();
  if (t === "cellular" || t === "cell" || t === "wimax") return "cellular";
  if (t === "wifi" || t === "wlan") return "wifi";
  if (t === "ethernet" || t === "wired") return "ethernet";
  return "unknown";
}

/** Label for product mode: fixed vs mobile internet */
export function serviceModeLabel(access: NetworkAccessKind): string {
  if (access === "cellular") return "Internet móvil";
  if (access === "wifi" || access === "ethernet") return "Internet fija";
  return "Internet fija"; // default until known
}

export function identifyFromMeta(
  meta: ServerMetaInfo | null | undefined,
  access: NetworkAccessKind
): IspIdentity {
  const notes: string[] = [];
  const asn = parseAsn(meta?.asn);
  const organization = safeText(meta?.asOrganization);
  const clientIp = safeText(meta?.clientIp);
  const city = safeText(meta?.city);
  const country = safeText(meta?.country);
  const colo = safeText(meta?.colo);

  let brand: string | null = null;
  let category: IspIdentity["category"] = "unknown";
  let source: IspIdentity["source"] = "none";
  let confidence: IspIdentity["confidence"] = "baja";

  // 1) Organization string wins (more reliable than stale ASN maps)
  if (organization) {
    const orgHit = matchOrg(organization);
    if (orgHit) {
      brand = orgHit.brand;
      category = orgHit.category;
      source = "org_heuristic";
      confidence = "alta";
    }
  }

  // 2) ASN only if org did not resolve a brand
  if (!brand && asn != null && ASN_BRAND[asn]) {
    brand = ASN_BRAND[asn].brand;
    category = ASN_BRAND[asn].category;
    source = "asn_map";
    confidence = "media";
  }

  if (!brand && organization) {
    source = "org_raw";
    confidence = "media";
    category = "unknown";
  }

  // Cellular: telco brands → mobile_operator
  if (access === "cellular" && brand) {
    if (
      ["Movistar", "Claro", "Entel", "Bitel"].includes(brand) &&
      category === "fixed_isp"
    ) {
      category = "mobile_operator";
    }
    notes.push(
      "Red celular detectada: el operador se estima por la IP pública (ASN/organización)."
    );
  }

  if (access === "wifi") {
    notes.push(
      "Wi‑Fi: el ISP es el de la red a la que estás conectado (hogar/trabajo), no el de la SIM."
    );
  }

  if (category === "hosting_vpn") {
    notes.push(
      "La IP parece de hosting/VPN/cloud: puede no ser tu operador real."
    );
    confidence = "baja";
  }

  if (!clientIp && !asn && !organization) {
    notes.push("No se pudo obtener metadatos de IP/ASN en esta prueba.");
  }

  const displayName =
    brand ||
    organization ||
    (asn != null ? `AS${asn}` : "No identificado");

  return {
    brand,
    organization,
    asn,
    clientIp,
    country,
    city,
    colo,
    source,
    category,
    displayName,
    confidence,
    notes,
  };
}

/**
 * Fetch public IP / ASN identity.
 * Prefer Cloudflare Speed meta (CORS-friendly, same stack as measurement).
 */
export async function fetchIspMeta(): Promise<ServerMetaInfo | null> {
  try {
    const res = await fetch(
      `https://speed.cloudflare.com/meta?t=${Date.now()}`,
      { cache: "no-store", mode: "cors", credentials: "omit" }
    );
    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
      return {
        clientIp: safeText(raw.clientIp) ?? undefined,
        colo: safeText(raw.colo) ?? undefined,
        city: safeText(raw.city) ?? undefined,
        country: safeText(raw.country) ?? undefined,
        asn: (raw.asn as number | string) ?? undefined,
        asOrganization: safeText(raw.asOrganization) ?? undefined,
        latitude:
          typeof raw.latitude === "number" || typeof raw.latitude === "string"
            ? (raw.latitude as string | number)
            : undefined,
        longitude:
          typeof raw.longitude === "number" || typeof raw.longitude === "string"
            ? (raw.longitude as string | number)
            : undefined,
        raw,
      };
    }
  } catch {
    /* fall through */
  }

  try {
    const res = await fetch(`https://ipapi.co/json/?t=${Date.now()}`, {
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });
    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
      return {
        clientIp: safeText(raw.ip) ?? undefined,
        city: safeText(raw.city) ?? undefined,
        country: safeText(raw.country_code) ?? safeText(raw.country) ?? undefined,
        asn:
          raw.asn != null
            ? String(raw.asn).replace(/^AS/i, "")
            : undefined,
        asOrganization:
          safeText(raw.org) ?? safeText(raw.asn_org) ?? undefined,
        raw,
      };
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function accessKindLabel(k: NetworkAccessKind): string {
  switch (k) {
    case "cellular":
      return "Red móvil (datos)";
    case "wifi":
      return "Wi‑Fi";
    case "ethernet":
      return "Ethernet / cable";
    default:
      return "Acceso no reportado";
  }
}

export function categoryLabel(c: IspIdentity["category"]): string {
  switch (c) {
    case "mobile_operator":
      return "Operador móvil (estimado)";
    case "fixed_isp":
      return "ISP fijo (estimado)";
    case "hosting_vpn":
      return "Hosting / VPN / cloud";
    default:
      return "Proveedor de Internet";
  }
}

/** Suggest operator string for the plan form */
export function suggestOperatorName(isp: IspIdentity): string | null {
  if (isp.brand && isp.category !== "hosting_vpn") return isp.brand;
  if (isp.organization && isp.category !== "hosting_vpn") {
    return isp.organization.length > 40
      ? isp.organization.slice(0, 37) + "…"
      : isp.organization;
  }
  return null;
}

/** Format location line without [object Object] */
export function formatLocation(
  city: string | null | undefined,
  country: string | null | undefined,
  colo: string | null | undefined
): string {
  const parts = [
    safeText(city),
    safeText(country),
    colo ? `PoP ${safeText(colo)}` : null,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : "—";
}
