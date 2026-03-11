import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getAdminStats } from "@/lib/db";
import { log } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.id)) {
    log("warn", "admin", "Forbidden access attempt", { userId: session.user.id, path: "/api/admin/stats" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stats = getAdminStats();
  return NextResponse.json(stats);
}
