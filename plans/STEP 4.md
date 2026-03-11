Verification Checklist
Set AERODATABOX_API_KEY in .env
tsc --noEmit exits 0
npx ts-node --project tsconfig.scripts.json scripts/monitor.ts shows polling logs
After first tick: sqlite3 data/flyhome.db "SELECT flight_number, status FROM flights LIMIT 5;" returns real rows
npm test -- all aerodatabox and monitor tests pass
