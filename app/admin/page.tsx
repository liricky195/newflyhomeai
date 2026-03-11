import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions, isAdmin } from "@/lib/auth";
import { getAdminStats, initDb } from "@/lib/db";
import StatsPanel from "@/components/admin/StatsPanel";
import UserTable from "@/components/admin/UserTable";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }

  initDb();

  if (!isAdmin(session.user.id)) {
    redirect("/");
  }

  const stats = getAdminStats();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-white">Admin Panel</h1>
      <p className="mb-8 text-sm text-slate-400">
        Internal operations — role escalation attempts are logged.
      </p>
      <StatsPanel stats={stats} />
      <UserTable currentUserId={session.user.id} />
    </div>
  );
}
