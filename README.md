# FlyHome AI

Stranded-passenger flight monitoring and booking platform built with Next.js 14, SQLite, Duffel Links, and Stripe.

## Architecture

- **Next.js 14 (App Router)** — frontend + serverless API routes deployed to Vercel
- **SQLite (better-sqlite3)** — persistent data store (see Database Persistence below)
- **Duffel Links** — canonical flight booking flow (no direct Stripe flight payments)
- **Stripe** — subscription billing only
- **scripts/monitor.ts** — long-running Node.js polling daemon (NOT on Vercel)

## Getting Started

```bash
cp .env.example .env
# Fill in all values (see .env.example for documentation)
npm install
npm run dev
```

## Database Persistence

> ⚠️ Vercel serverless functions use an ephemeral filesystem. A SQLite file at `./data/flyhome.db` **will not survive cold starts** on Vercel. Choose one of:

### Option A — Turso (recommended for serverless)

[Turso](https://turso.tech) is a hosted LibSQL service with an API-compatible SQLite interface.

1. Install the Turso CLI: `brew install tursodatabase/tap/turso`
2. Create a database: `turso db create flyhome`
3. Get credentials: `turso db tokens create flyhome`
4. Replace `better-sqlite3` with `@libsql/client` and update `lib/db.ts` accordingly
5. Set `DATABASE_URL` to your Turso URL (`libsql://...`) and add `TURSO_AUTH_TOKEN`

### Option B — Railway or Fly.io with persistent volume

Deploy the entire Next.js app (+ monitor) on Railway or Fly.io alongside a persistent volume mounted at `/data`. Set `DATABASE_URL=./data/flyhome.db`. The monitor can run as a separate service in the same project.

---

## Monitor Deployment

The monitor (`scripts/monitor.ts`) is a **persistent long-running Node.js process** that polls AeroDataBox for flight data and sends notifications. It must **not** be deployed as a Vercel serverless function.

### Railway

1. Create a new Railway project and connect your repository
2. Add a service with start command: `npx ts-node scripts/monitor.ts`
3. Set all environment variables (same as your `.env`)
4. Deploy — Railway automatically restarts on crash

### Fly.io

```bash
fly launch --no-deploy
```

In `fly.toml`, add a dedicated process:

```toml
[processes]
  monitor = "npx ts-node scripts/monitor.ts"

[machines]
  auto_stop_machines = false  # keep monitor alive 24/7
```

Set secrets:
```bash
fly secrets set DATABASE_URL=./data/flyhome.db DUFFEL_API_KEY=duffel_live_... # etc.
```

Then deploy: `fly deploy`

For persistent SQLite on Fly.io, mount a volume:

```toml
[[mounts]]
  source    = "flyhome_data"
  destination = "/data"
```

And set `DATABASE_URL=/data/flyhome.db`.

### Environment Variables

All variables required by the monitor are the same as those in `.env.example`. No monitor-specific variables are needed beyond what the Next.js app already uses.

---

## Running Tests

```bash
npm test          # run all tests
npm run test:watch  # watch mode
```

## Type Checking

```bash
npx tsc --noEmit
```
