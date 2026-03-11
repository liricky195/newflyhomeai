import type { NextAuthOptions, Session, User } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import type { Adapter, AdapterSession, AdapterAccount } from "next-auth/adapters";
import {
  getDb,
  createUser,
  getUserByEmail,
  getUserById,
  createSession,
  getSessionByToken,
  deleteSession,
  createSubscription,
  getSubscriptionByUserId,
  createDefaultSubscription,
} from "@/lib/db";
import { log } from "@/lib/logger";

// ─────────────────────────────────────────────────────────────────────────────
// Custom SQLite adapter
// ─────────────────────────────────────────────────────────────────────────────
// NextAuth adapters must implement the Adapter interface from next-auth/adapters.
// We build it entirely on top of the typed functions in lib/db.ts.
// ─────────────────────────────────────────────────────────────────────────────

function toAdapterUser(dbUser: ReturnType<typeof getUserById>): AdapterUser {
  if (!dbUser) throw new Error("toAdapterUser: dbUser is null");
  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name ?? null,
    image: dbUser.image ?? null,
    emailVerified: null, // OAuth users are implicitly verified
  };
}

function sqliteAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">): Promise<AdapterUser> {
      const id = crypto.randomUUID();
      const created = createUser({
        id,
        email: user.email ?? "",
        name: user.name ?? null,
        image: user.image ?? null,
      });

      // Every new user gets a free-tier subscription row
      const subId = crypto.randomUUID();
      const existing = getSubscriptionByUserId(created.id);
      if (!existing) {
        createSubscription({ id: subId, user_id: created.id });
      }

      return toAdapterUser(created);
    },

    async getUser(id): Promise<AdapterUser | null> {
      const user = getUserById(id);
      return user ? toAdapterUser(user) : null;
    },

    async getUserByEmail(email): Promise<AdapterUser | null> {
      const user = getUserByEmail(email);
      return user ? toAdapterUser(user) : null;
    },

    async getUserByAccount({ providerAccountId: _pid, provider: _prov }): Promise<AdapterUser | null> {
      // We don't store OAuth accounts separately; identity is keyed by email.
      // allowDangerousEmailAccountLinking on each provider prevents OAuthAccountNotLinked
      // when getUserByEmail finds an existing user but no linked account record exists.
      return null;
    },

    async updateUser(user): Promise<AdapterUser> {
      // Upsert via createUser which uses ON CONFLICT(email) DO UPDATE
      if (!user.email) throw new Error("updateUser: user.email is required");
      const updated = createUser({
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
      });
      return toAdapterUser(updated);
    },

    async linkAccount(_account: AdapterAccount): Promise<void> {
      // No separate accounts table; email is the canonical identity.
    },

    async createSession(session): Promise<AdapterSession> {
      const expiresUnix = Math.floor(new Date(session.expires).getTime() / 1000);
      createSession({
        id: crypto.randomUUID(),
        session_token: session.sessionToken,
        user_id: session.userId,
        expires: expiresUnix,
      });
      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },

    async getSessionAndUser(
      sessionToken: string
    ): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const dbSession = getSessionByToken(sessionToken);
      if (!dbSession) return null;

      const nowUnix = Math.floor(Date.now() / 1000);
      if (dbSession.expires < nowUnix) {
        deleteSession(sessionToken);
        return null;
      }

      const dbUser = getUserById(dbSession.user_id);
      if (!dbUser) return null;

      return {
        session: {
          sessionToken: dbSession.session_token,
          userId: dbSession.user_id,
          expires: new Date(dbSession.expires * 1000),
        },
        user: toAdapterUser(dbUser),
      };
    },

    async updateSession(session): Promise<AdapterSession | null | undefined> {
      const dbSession = getSessionByToken(session.sessionToken);
      if (!dbSession) return null;

      const newExpires: Date = session.expires ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const expiresUnix = Math.floor(newExpires.getTime() / 1000);

      // UPDATE in place — avoids the window between DELETE and INSERT where a
      // concurrent getSessionAndUser call would return null and log the user out.
      getDb()
        .prepare<[number, string]>("UPDATE sessions SET expires = ? WHERE session_token = ?")
        .run(expiresUnix, session.sessionToken);

      return {
        sessionToken: session.sessionToken,
        userId: dbSession.user_id,
        expires: newExpires,
      };
    },

    async deleteSession(sessionToken: string): Promise<void> {
      deleteSession(sessionToken);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NextAuth options
// ─────────────────────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  adapter: sqliteAdapter(),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    generateSessionToken: () => crypto.randomUUID(),
  },
  callbacks: {
    async signIn({ user }): Promise<boolean> {
      if (user?.id) {
        try {
          createDefaultSubscription(user.id);
        } catch (err) {
          log("error", "auth", "createDefaultSubscription error", { err: String(err) });
        }
      }
      return true;
    },

    async session({
      session,
      user,
    }: {
      session: Session;
      user: User | AdapterUser;
      token: JWT;
    }): Promise<Session> {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
};

/**
 * Canonical admin check. Always performs a synchronous DB read.
 * Never trusts JWT claims or client-supplied data.
 * This is the ONLY authorized way to check admin status in API routes
 * and server components.
 */
export function isAdmin(userId: string): boolean {
  const user = getUserById(userId);
  return user?.role === "admin";
}
