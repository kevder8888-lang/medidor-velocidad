import { NextRequest, NextResponse } from "next/server";
import { CLIENT_VERSION, PROTOCOL_VERSION } from "@/lib/servers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Metadata of this measurement node (for client reports). */
export async function GET(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  const clientIp =
    forwarded?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  return NextResponse.json(
    {
      node: "osiptel-mvp-self",
      protocolVersion: PROTOCOL_VERSION,
      clientVersion: CLIENT_VERSION,
      serverTime: new Date().toISOString(),
      clientIp,
      note: "Despliega esta app en un datacenter/VPS en Perú para usarla como nodo de medición real.",
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
