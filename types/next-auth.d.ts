import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      // role is intentionally omitted — use isAdmin(session.user.id) from lib/auth.ts
      // for all authorization checks. Never rely on session data for role verification.
    } & DefaultSession["user"];
  }
}
