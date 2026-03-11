import { NextRequest, NextResponse } from "next/server";
import { getDb, initDb } from "@/lib/db";
import { logRequest } from "@/lib/logger"; // HARDENED IN STEP 10
import { corsHeaders } from "@/lib/cors"; // HARDENED IN STEP 10

// HARDENED IN STEP 10: OPTIONS for CORS preflight (unrestricted)
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(origin, true),
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startMs = Date.now(); // HARDENED IN STEP 10
  const origin = request.headers.get("origin");

  try {
    initDb();
    getDb().prepare("SELECT 1 FROM schema_version LIMIT 1").get();

    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/health", 200, durationMs);
    return NextResponse.json(
      { status: "ok", db: "connected", timestamp: new Date().toISOString() },
      // HARDENED IN STEP 10: health is always unrestricted CORS
      { headers: corsHeaders(origin, true) }
    );
  } catch (err) {
    const durationMs = Date.now() - startMs;
    logRequest("GET", "/api/health", 503, durationMs);
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        error: (err as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: corsHeaders(origin, true) }
    );
  }
}
