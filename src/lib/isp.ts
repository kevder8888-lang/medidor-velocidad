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

/** Well-known Peruvian (and common) ASNs → commercial brand */
const ASN_BRAND: Record<
  number,
  { brand: string; category: IspIdentity["category"] }
> = {
  // Telefónica / Movistar Perú
  6147: { brand: "Movistar", category: "fixed_isp" },
  12252: { brand: "Movistar", category: "fixed_isp" },
  19114: { brand: "Movistar", category: "mobile_operator" },
  // América Móvil / Claro Perú
  19180: { brand: "Claro", category: "fixed_isp" },
  21575: { brand: "Claro", category: "mobile_operator" },
  27843: { brand: "WIN", category: "fixed_isp" },
  // Entel Perú
  265691: { brand: "Bitel", category: "mobile_operator" }, // Viettel Perú often
  262210: { brand: "Entel", category: "mobile_operator" },
  22411: { brand: "Entel", category: "mobile_operator" },
  // Others seen in PE
  3132: { brand: "RCP / Internet", category: "fixed_isp" },
  10569: { brand: "Red Científica Peruana", category: "fixed_isp" },
  28032: { brand: "Internexa", category: "fixed_isp" },
  263189: { brand: "Optical Technologies", category: "fixed_isp" },
  52227: { brand: "WOW", category: "fixed_isp" },
  264668: { brand: "FiberLux", category: "fixed_isp" },
  // Global / hosting (VPN / cloud exit)
  13335: { brand: "Cloudflare", category: "hosting_vpn" },
  15169: { brand: "Google", category: "hosting_vpn" },
  16509: { brand: "Amazon AWS", category: "hosting_vpn" },
  8075: { brand: "Microsoft", category: "hosting_vpn" },
};

const ORG_RULES: {
  re: RegExp;
  brand: string;
  category: IspIdentity["category"];
}[] = [
  { re: /telefonica|telefónica|movistar/i, brand: "Movistar", category: "fixed_isp" },
  { re: /america\s*movil|am[eé]rica\s*m[oó]vil|claro/i, brand: "Claro", category: "fixed_isp" },
  { re: /\bentel\b/i, brand: "Entel", category: "mobile_operator" },
  { re: /viettel|bitel/i, brand: "Bitel", category: "mobile_operator" },
  { re: /\bwin\b|win\s*empresas/i, brand: "WIN", category: "fixed_isp" },
  { re: /optical/i, brand: "Optical", category: "fixed_isp" },
  { re: /\bwow\b/i, brand: "WOW", category: "fixed_isp" },
  { re: /fiberlux|fiber\s*lux/i, brand: "FiberLux", category: "fixed_isp" },
  { re: /starlink|spacex/i, brand: "Starlink", category: "fixed_isp" },
  { re: /cloudflare/i, brand: "Cloudflare", category: "hosting_vpn" },
  { re: /amazon|aws/i, brand: "Amazon AWS", category: "hosting_vpn" },
  { re: /google/i, brand: "Google", category: "hosting_vpn" },
  { re: /microsoft|azure/i, brand: "Microsoft", category: "hosting_vpn" },
  { re: /digitalocean|linode|vultr|ovh|hetzner/i, brand: "Hosting/VPS", category: "hosting_vpn" },
];

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

export function identifyFromMeta(
  meta: ServerMetaInfo | null | undefined,
  access: NetworkAccessKind
): IspIdentity {
  const notes: string[] = [];
  const asn = parseAsn(meta?.asn);
  const organization = meta?.asOrganization?.trim() || null;
  const clientIp = meta?.clientIp?.trim() || null;

  let brand: string | null = null;
  let category: IspIdentity["category"] = "unknown";
  let source: IspIdentity["source"] = "none";
  let confidence: IspIdentity["confidence"] = "baja";

  if (asn != null && ASN_BRAND[asn]) {
    brand = ASN_BRAND[asn].brand;
    category = ASN_BRAND[asn].category;
    source = "asn_map";
    confidence = "alta";
  } else if (organization) {
    const rule = ORG_RULES.find((r) => r.re.test(organization));
    if (rule) {
      brand = rule.brand;
      category = rule.category;
      source = "org_heuristic";
      confidence = "media";
    } else {
      brand = null;
      source = "org_raw";
      confidence = "media";
      category = "unknown";
    }
  }

  // If user is on cellular, re-label fixed_isp as mobile_operator when brand is a telco
  if (access === "cellular" && brand) {
    if (
      ["Movistar", "Claro", "Entel", "Bitel"].includes(brand) &&
      category === "fixed_isp"
    ) {
      category = "mobile_operator";
    }
    notes.push(
      "Red celular detectada por el navegador: el ISP de la IP pública suele ser el operador móvil."
    );
  }

  if (access === "wifi") {
    notes.push(
      "Wi‑Fi: el ISP es el de la red a la que estás conectado (hogar/trabajo), no el de la SIM del celular."
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
    country: meta?.country ?? null,
    city: meta?.city ?? null,
    colo: meta?.colo ?? null,
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
  // Primary: Cloudflare
  try {
    const res = await fetch(
      `https://speed.cloudflare.com/meta?t=${Date.now()}`,
      { cache: "no-store", mode: "cors", credentials: "omit" }
    );
    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
      return {
        clientIp: raw.clientIp != null ? String(raw.clientIp) : undefined,
        colo: raw.colo != null ? String(raw.colo) : undefined,
        city: raw.city != null ? String(raw.city) : undefined,
        country: raw.country != null ? String(raw.country) : undefined,
        asn: (raw.asn as number | string) ?? undefined,
        asOrganization:
          raw.asOrganization != null ? String(raw.asOrganization) : undefined,
        latitude: raw.latitude as string | number | undefined,
        longitude: raw.longitude as string | number | undefined,
        raw,
      };
    }
  } catch {
    /* fall through */
  }

  // Fallback: ipapi.co (best-effort, may rate-limit)
  try {
    const res = await fetch(`https://ipapi.co/json/?t=${Date.now()}`, {
      cache: "no-store",
      mode: "cors",
      credentials: "omit",
    });
    if (res.ok) {
      const raw = (await res.json()) as Record<string, unknown>;
      return {
        clientIp: raw.ip != null ? String(raw.ip) : undefined,
        city: raw.city != null ? String(raw.city) : undefined,
        country: raw.country_code != null ? String(raw.country_code) : undefined,
        asn:
          raw.asn != null
            ? String(raw.asn).replace(/^AS/i, "")
            : undefined,
        asOrganization:
          raw.org != null
            ? String(raw.org)
            : raw.asn_org != null
              ? String(raw.asn_org)
              : undefined,
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
    // shorten long org names
    return isp.organization.length > 40
      ? isp.organization.slice(0, 37) + "…"
      : isp.organization;
  }
  return null;
}
