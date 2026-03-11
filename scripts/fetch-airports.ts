/**
 * Build-time script: downloads OpenFlights airports.dat and emits
 * public/data/airports.json — a filtered, minimal JSON asset.
 *
 * Run once: npx ts-node scripts/fetch-airports.ts
 * Output is committed to the repo — no runtime dependency on OpenFlights.
 *
 * CSV columns (index):
 *  0  Airport ID (internal)
 *  1  Name
 *  2  City
 *  3  Country
 *  4  IATA (3-letter, or "\N" if unassigned)
 *  5  ICAO (4-letter)
 *  6  Latitude
 *  7  Longitude
 *  8  Altitude
 *  9  Timezone
 *  10 DST
 *  11 Tz database timezone
 *  12 Type (airport | station | port | unknown)
 *  13 Source
 */

import https from "https";
import fs from "fs";
import path from "path";

const SOURCE_URL =
  "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat";

const OUT_DIR = path.resolve(process.cwd(), "public", "data");
const OUT_FILE = path.join(OUT_DIR, "airports.json");

export interface AirportEntry {
  iata: string;
  name: string;
  city: string;
  country: string;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let inQuote = false;
  let current = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
        return;
      }
      let data = "";
      res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function main(): Promise<void> {
  console.log(`Fetching airports.dat from OpenFlights...`);
  const raw = await fetchText(SOURCE_URL);

  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const airports: AirportEntry[] = [];

  for (const line of lines) {
    const cols = parseCsvLine(line);
    if (cols.length < 14) continue;

    const iata = cols[4];
    const type = cols[12];

    // Skip rows with no IATA code or non-airport types
    if (!iata || iata === "\\N" || iata === "") continue;
    if (type !== "airport") continue;

    airports.push({
      iata: iata.trim(),
      name: cols[1].trim(),
      city: cols[2].trim(),
      country: cols[3].trim(),
    });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(airports), "utf8");

  console.log(`Done. ${airports.length} airports written to ${OUT_FILE}`);
  console.log(`File size: ${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
