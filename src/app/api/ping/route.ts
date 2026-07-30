import { NextResponse } from "next/server";

/** Lightweight local RTT endpoint (app latency only — not ISP latency). */
export async function GET() {
  return new NextResponse("pong", {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "text/plain",
    },
  });
}
