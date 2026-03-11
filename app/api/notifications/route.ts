import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb, getNotificationsByUserId, markNotificationsRead } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initDb();
    const userId = session.user.id;

    // Return only unread notifications — they persist until the user
    // explicitly presses "Mark all as Read" (POST below).
    const all = getNotificationsByUserId(userId).filter((n) => !n.read_at);
    const total = all.length;
    const notifications = all.slice(0, 10);

    return NextResponse.json({ notifications, total });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    initDb();
    markNotificationsRead(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
