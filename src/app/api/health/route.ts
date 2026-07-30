import { NextResponse } from "next/server";
import { CLIENT_VERSION, PROTOCOL_VERSION } from "@/lib/servers";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "medidor-velocidad-osiptel",
    protocolVersion: PROTOCOL_VERSION,
    clientVersion: CLIENT_VERSION,
    time: new Date().toISOString(),
    measureEndpoints: [
      "/api/measure/download",
      "/api/measure/upload",
      "/api/measure/echo",
      "/api/measure/meta",
    ],
    note: "Throughput ISP: usar nodos Internet (Cloudflare o despliegue remoto). Loopback solo calibra la app.",
  });
}
