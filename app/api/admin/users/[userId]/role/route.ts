import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions, isAdmin } from "@/lib/auth";
import { getUserById, updateUserRole } from "@/lib/db";
import { log } from "@/lib/logger";

const RoleSchema = z.object({
  role: z.enum(["user", "admin"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.id)) {
    log("warn", "admin", "Forbidden access attempt", { userId: session.user.id, path: "/api/admin/users/[userId]/role" });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;

  if (userId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot modify your own role" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { role } = parsed.data;

  const targetUser = getUserById(userId);
  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const oldRole = targetUser.role;
  updateUserRole(userId, role);

  log("info", "admin", "Role change", { adminId: session.user.id, targetId: userId, from: oldRole, to: role });

  return NextResponse.json({ success: true, role });
}
