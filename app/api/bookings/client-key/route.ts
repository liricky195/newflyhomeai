import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createComponentClientKey, ApiError } from "@/lib/duffel";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clientKey = await createComponentClientKey();
    return NextResponse.json({ clientKey });
  } catch (err) {
    const message = err instanceof ApiError ? err.apiMessage : (err as Error).message;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
