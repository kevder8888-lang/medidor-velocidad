import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 32 * 1024 * 1024;

/**
 * Own measurement node: accepts upload body and reports bytes received.
 */
export async function POST(req: NextRequest) {
  const reader = req.body?.getReader();
  if (!reader) {
    return NextResponse.json(
      { ok: false, error: "missing body" },
      {
        status: 400,
        headers: corsHeaders(),
      }
    );
  }

  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > MAX_BYTES) {
          try {
            await reader.cancel();
          } catch {
            /* ignore */
          }
          return NextResponse.json(
            { ok: false, error: "payload too large", received },
            { status: 413, headers: corsHeaders() }
          );
        }
      }
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "read failed", received },
      { status: 400, headers: corsHeaders() }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      received,
      serverTime: new Date().toISOString(),
    },
    { headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}
