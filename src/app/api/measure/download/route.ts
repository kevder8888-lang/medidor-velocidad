import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 64 * 1024 * 1024; // 64 MiB per request
const CHUNK = 64 * 1024;

/**
 * Own measurement node: streams binary payload for download throughput tests.
 * Deploy this app on a VPS/datacenter in PE to use as a real measurement server.
 */
export async function GET(req: NextRequest) {
  const bytesParam = Number(req.nextUrl.searchParams.get("bytes") ?? 1_048_576);
  const total = Math.min(
    Math.max(0, Number.isFinite(bytesParam) ? Math.floor(bytesParam) : 0),
    MAX_BYTES
  );

  let sent = 0;
  // Deterministic non-zero pattern (avoids some naive compressors; not crypto-secure)
  let seed = (Date.now() ^ (total * 2654435761)) >>> 0;

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const size = Math.min(CHUNK, total - sent);
      const buf = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        buf[i] = seed & 0xff;
      }
      sent += size;
      controller.enqueue(buf);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(total),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Content-Encoding": "identity",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Expose-Headers": "Content-Length",
      "X-Measure-Node": "osiptel-mvp",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
