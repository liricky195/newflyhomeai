-- Migration 008: Admin seed
-- This is the ONLY place in the codebase that associates an email address with the admin role.
-- Do not reference this email in middleware, lib/auth.ts, API routes, or environment variables.
INSERT INTO users (id, email, role, created_at, updated_at)
VALUES (lower(hex(randomblob(16))), 'rickygreenplanet@gmail.com', 'admin', unixepoch(), unixepoch())
ON CONFLICT(email) DO UPDATE SET role = 'admin';
