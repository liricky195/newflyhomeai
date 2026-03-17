#!/bin/sh
set -e

# Ensure the persistent data directory exists even if volume isn't mounted
mkdir -p /data

echo "[start] Starting monitor process in background..."
node .scripts-dist/scripts/monitor.js &
MONITOR_PID=$!

echo "[start] Starting Next.js server..."
npm start
EXIT_CODE=$?

echo "[start] Next.js exited ($EXIT_CODE) — stopping monitor..."
kill "$MONITOR_PID" 2>/dev/null || true
exit "$EXIT_CODE"
