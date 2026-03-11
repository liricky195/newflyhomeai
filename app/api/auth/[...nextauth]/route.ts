import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { initDb } from "@/lib/db";

// Initialise the database schema on first request.
// better-sqlite3 is synchronous; initDb is idempotent (CREATE TABLE IF NOT EXISTS).
initDb();

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
