import type { MeasurementServer, ServerMetaInfo, ServerProbe } from "./types";
import { getMeasurementServers } from "./servers";
import { median, round } from "./stats";

async function probeRtt(url: string, attempts = 3): Promise<number | null> {
  const samples: number[] = [];
  for (let i = 0; i < attempts; i++) {
    const bust = `${url}${url.includes("?") ? "&" : "?"}p=${i}_${Date.now()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const t0 = performance.now();
    try {
      await fetch(bust, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
        credentials: "omit",
        signal: controller.signal,
      });
      samples.push(performance.now() - t0);
    } catch {
      /* fail sample */
    } finally {
      clearTimeout(timer);
    }
  }
  if (!samples.length) return null;
  return round(median(samples), 1);
}

export async function probeServers(
  servers: MeasurementServer[] = getMeasurementServers()
): Promise<ServerProbe[]> {
  const probes = await Promise.all(
    servers.map(async (s) => {
      const rttMs = await probeRtt(s.pingUrl);
      return {
        serverId: s.id,
        name: s.name,
        region: s.region,
        kind: s.kind,
        rttMs,
        ok: rttMs != null,
        isLoopback: s.isLoopback,
        warning: s.warning,
      } satisfies ServerProbe;
    })
  );
  return probes;
}

/**
 * Select best server for ISP measurement.
 * Prefer non-loopback internet/custom with lowest RTT.
 * Falls back to loopback only if nothing else works.
 */
export function selectBestServer(
  servers: MeasurementServer[],
  probes: ServerProbe[],
  preferredId?: string | "auto"
): { server: MeasurementServer; probe: ServerProbe | undefined } {
  if (preferredId && preferredId !== "auto") {
    const server = servers.find((s) => s.id === preferredId) ?? servers[0];
    const probe = probes.find((p) => p.serverId === server.id);
    return { server, probe };
  }

  const ranked = probes
    .filter((p) => p.ok && !p.isLoopback)
    .sort((a, b) => (a.rttMs ?? 9e9) - (b.rttMs ?? 9e9));

  const bestId = ranked[0]?.serverId;
  if (bestId) {
    const server = servers.find((s) => s.id === bestId)!;
    return { server, probe: ranked[0] };
  }

  // fallback any ok
  const anyOk = probes
    .filter((p) => p.ok)
    .sort((a, b) => (a.rttMs ?? 9e9) - (b.rttMs ?? 9e9));
  if (anyOk[0]) {
    const server = servers.find((s) => s.id === anyOk[0].serverId)!;
    return { server, probe: anyOk[0] };
  }

  return { server: servers[0], probe: probes[0] };
}

export async function fetchServerMeta(
  server: MeasurementServer
): Promise<ServerMetaInfo | null> {
  if (!server.metaUrl) return null;
  try {
    const res = await fetch(
      `${server.metaUrl}${server.metaUrl.includes("?") ? "&" : "?"}t=${Date.now()}`,
      { cache: "no-store", mode: "cors", credentials: "omit" }
    );
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<string, unknown>;

    // Cloudflare meta shape
    if (raw.clientIp || raw.colo || raw.asn) {
      return {
        clientIp: String(raw.clientIp ?? ""),
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

    // Self node shape
    return {
      clientIp: raw.clientIp != null ? String(raw.clientIp) : undefined,
      city: raw.node != null ? String(raw.node) : undefined,
      raw,
    };
  } catch {
    return null;
  }
}
