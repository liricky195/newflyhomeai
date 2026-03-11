/**
 * 4E — SQL injection static analysis
 * Reads lib/db.ts as a string and asserts that no template literal SQL
 * interpolates dynamic/user-supplied values.
 *
 * EXCEPTION: getAirportScanBuckets() legitimately uses a template literal with
 * ${getScanInterval('free')} — a compile-time numeric constant — which is NOT
 * an injection vector. The test must NOT flag this as a failure.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DB_FILE = path.resolve(__dirname, "../../lib/db.ts");

describe("db.ts SQL injection safety (4E)", () => {
  it("lib/db.ts can be read", () => {
    expect(fs.existsSync(DB_FILE)).toBe(true);
  });

  it("no dangerous template literal SQL: only allowed interpolation is getScanInterval()", () => {
    const src = fs.readFileSync(DB_FILE, "utf8");

    // A template literal is considered SQL if it STARTS with a DML keyword
    // (after optional whitespace/comments). Error messages that merely mention
    // SQL keywords in passing ("failed to insert session...") are not flagged.
    const IS_SQL_QUERY = /^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i;

    // Match template literal blocks: `...`
    const templateLiteralRegex = /`([^`]*)`/gs;

    const violations: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = templateLiteralRegex.exec(src)) !== null) {
      const content = match[1];
      // Only flag template literals that ARE SQL queries (start with DML keyword)
      if (!IS_SQL_QUERY.test(content)) continue;

      // This template literal IS a SQL query — check for unsafe interpolations
      const interpolationRegex = /\$\{([^}]+)\}/g;
      let interp: RegExpExecArray | null;
      while ((interp = interpolationRegex.exec(content)) !== null) {
        const expr = interp[1].trim();
        // ALLOWED: calls to getScanInterval() — compile-time numeric constant
        if (/^getScanInterval\s*\(/.test(expr)) continue;
        // Any other interpolation in a DML SQL query template literal is a violation
        violations.push(
          `Potentially unsafe SQL interpolation: \${${expr}} in SQL template literal`
        );
      }
    }

    if (violations.length > 0) {
      console.error("SQL injection violations found:\n" + violations.join("\n"));
    }
    expect(violations).toHaveLength(0);
  });

  it("no raw .query() calls with user-supplied string concatenation", () => {
    const src = fs.readFileSync(DB_FILE, "utf8");
    // Verify that all SQL runs through .prepare().run/.get/.all — not raw exec with dynamic strings
    // We check that there's no pattern like db.exec(`...${variable}...`) with SQL keywords
    const dangerousExecRegex = /\.exec\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*(SELECT|INSERT|UPDATE|DELETE)[^`]*`/gi;
    const matches = src.match(dangerousExecRegex);
    expect(matches).toBeNull();
  });
});
