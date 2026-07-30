import type { AccessType, ServerMetaInfo } from "./types";

export type NetworkAccessKind =
  | "ethernet"
  | "wifi"
  | "cellular"
  | "unknown";

export interface IspIdentity {
  /** Brand name if mapped (Movistar, Claro, Entel, Bitel…) */
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
    for (const key of ["name", "city", "country", "label", "value", "code"]) {
      if (typeof o[key] === "string" && o[key]) {
        return String(o[key]).trim();
      }
    }
    return null;
  }
  return null;
}

function normalizeOrg(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Marca comercial desde el nombre de organización (prioridad alta).
 *
 * - América Móvil Perú → Claro
 * - Integratel / Telefónica → Movistar
 * - Viettel Perú → Bitel
 * - Entel Perú S.A. → Entel
 */
export function matchOrg(
  organization: string
): { brand: string; category: IspIdentity["category"] } | null {
  const raw = organization.trim();
  const n = normalizeOrg(raw);

  // 1) Bitel / Viettel (antes que cualquier otra cosa)
  if (n.includes("viettel") || n.includes("bitel")) {
    return { brand: "Bitel", category: "mobile_operator" };
  }

  // 2) Entel — antes de Claro; no confundir con Viettel (ya filtrado)
  //    Acepta: "ENTEL PERU S.A.", "Entel Peru", "ENTEL PCS", etc.
  if (
    /\bentel\b/.test(n) ||
    n.includes("entel peru") ||
    n.includes("entel s.a") ||
    n.includes("entel sa")
  ) {
    return { brand: "Entel", category: "mobile_operator" };
  }

  // 3) Claro / América Móvil — "claro" con límite de palabra (no substrings raras)
  if (
    n.includes("america movil") ||
    n.includes("americamovil") ||
    /\bclaro\b/.test(n)
  ) {
    return { brand: "Claro", category: "fixed_isp" };
  }

  // 4) Movistar / Telefónica / Integratel
  if (
    n.includes("integratel") ||
    n.includes("telefonica") ||
    n.includes("movistar")
  ) {
    return { brand: "Movistar", category: "fixed_isp" };
  }

  // 5) Otros fijos PE
  if (/\bwin\b/.test(n) || n.includes("win empresas")) {
    return { brand: "WIN", category: "fixed_isp" };
  }
  if (n.includes("optical")) {
    return { brand: "Optical", category: "fixed_isp" };
  }
  if (/\bwow\b/.test(n)) {
    return { brand: "WOW", category: "fixed_isp" };
  }
  if (n.includes("fiberlux") || n.includes("fiber lux")) {
    return { brand: "FiberLux", category: "fixed_isp" };
  }
  if (n.includes("starlink") || n.includes("spacex")) {
    return { brand: "Starlink", category: "fixed_isp" };
  }

  // 6) Hosting / VPN
  if (n.includes("cloudflare")) {
    return { brand: "Cloudflare", category: "hosting_vpn" };
  }
  if (n.includes("amazon") || /\baws\b/.test(n)) {
    return { brand: "Amazon AWS", category: "hosting_vpn" };
  }
  if (n.includes("google")) {
    return { brand: "Google", category: "hosting_vpn" };
  }
  if (n.includes("microsoft") || n.includes("azure")) {
    return { brand: "Microsoft", category: "hosting_vpn" };
  }

  return null;
}

/**
 * ASN conocidos en Perú (secundario: solo si no hay org clara).
 * Actualizado: Entel Perú ≠ Claro; no mezclar WIN y Entel.
 *
 * Referencias habituales (pueden cambiar):
 * - AS6147 / AS12252 Telefónica-Movistar
 * - AS21575 / AS19180 América Móvil-Claro (verificar en uso real)
 * - AS27843 Entel Perú S.A. (varios registros lo asocian a Entel)
 * - AS265691 Viettel/Bitel
 */
const ASN_BRAND: Record<
  number,
  { brand: string; category: IspIdentity["category"] }
> = {
  // Movistar / Telefónica / Integratel
  6147: { brand: "Movistar", category: "fixed_isp" },
  12252: { brand: "Movistar", category: "fixed_isp" },
  19114: { brand: "Movistar", category: "mobile_operator" },
  // Claro / América Móvil
  19180: { brand: "Claro", category: "fixed_isp" },
  21575: { brand: "Claro", category: "mobile_operator" },
  11664: { brand: "Claro", category: "mobile_operator" },
  // Entel Perú (NO mapear a Claro)
  27843: { brand: "Entel", category: "mobile_operator" },
  262210: { brand: "Entel", category: "mobile_operator" },
  22411: { brand: "Entel", category: "mobile_operator" },
  6535: { brand: "Entel", category: "mobile_operator" },
  // Bitel / Viettel
  265691: { brand: "Bitel", category: "mobile_operator" },
  // WIN (solo si no hay org Entel; org gana siempre)
  264668: { brand: "FiberLux", category: "fixed_isp" },
  52227: { brand: "WOW", category: "fixed_isp" },
  263189: { brand: "Optical Technologies", category: "fixed_isp" },
  3132: { brand: "RCP / Internet", category: "fixed_isp" },
  10569: { brand: "Red Científica Peruana", category: "fixed_isp" },
  28032: { brand: "Internexa", category: "fixed_isp" },
  // Hosting
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

export function serviceModeLabel(access: NetworkAccessKind): string {
  if (access === "cellular") return "Internet móvil";
  if (access === "wifi" || access === "ethernet") return "Internet fija";
  return "Internet fija";
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

  // 1) Organización gana SIEMPRE (ej. "ENTEL PERU S.A." → Entel)
  if (organization) {
    const orgHit = matchOrg(organization);
    if (orgHit) {
      brand = orgHit.brand;
      category = orgHit.category;
      source = "org_heuristic";
      confidence = "alta";
    }
  }

  // 2) ASN solo si la org no dio marca
  if (!brand && asn != null && ASN_BRAND[asn]) {
    brand = ASN_BRAND[asn].brand;
    category = ASN_BRAND[asn].category;
    source = "asn_map";
    confidence = "media";
  }

  // 3) Si org y ASN discrepan, confiar en org y avisar
  if (organization && brand && asn != null && ASN_BRAND[asn]) {
    const asnBrand = ASN_BRAND[asn].brand;
    const orgHit = matchOrg(organization);
    if (orgHit && orgHit.brand !== asnBrand) {
      brand = orgHit.brand;
      category = orgHit.category;
      source = "org_heuristic";
      confidence = "alta";
      notes.push(
        `La organización (${organization}) indica ${orgHit.brand}; el ASN AS${asn} se asocia a veces a ${asnBrand}. Se prioriza la organización.`
      );
    }
  }

  if (!brand && organization) {
    source = "org_raw";
    confidence = "media";
    category = "unknown";
  }

  if (access === "cellular" && brand) {
    if (
      ["Movistar", "Claro", "Entel", "Bitel"].includes(brand) &&
      category === "fixed_isp"
    ) {
      category = "mobile_operator";
    }
    notes.push(
      "Red celular: el operador se estima por IP/ASN (no por el nombre de la SIM)."
    );
  }

  if (access === "wifi") {
    notes.push(
      "Wi‑Fi: el ISP es el de la red del router, no necesariamente el de la SIM."
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
 * Prefer Cloudflare Speed meta (CORS-friendly).
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
        country:
          safeText(raw.country_code) ?? safeText(raw.country) ?? undefined,
        asn:
          raw.asn != null ? String(raw.asn).replace(/^AS/i, "") : undefined,
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

/** Operador de red detectado (para el registro de medición) */
export function suggestOperatorName(isp: IspIdentity): string | null {
  if (isp.brand && isp.category !== "hosting_vpn") return isp.brand;
  if (isp.organization && isp.category !== "hosting_vpn") {
    return isp.organization.length > 40
      ? isp.organization.slice(0, 37) + "…"
      : isp.organization;
  }
  return null;
}

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
