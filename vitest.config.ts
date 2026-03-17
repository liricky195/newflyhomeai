import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [
      ["__tests__/components/**", "jsdom"],
      ["__tests__/contexts/**", "jsdom"],
      ["__tests__/pages/**", "jsdom"],
    ],
    globals: true,
    setupFiles: ["__tests__/setup-dom.ts"],
    coverage: {
      provider: "v8",
      // Only measure coverage for backend logic — not NextAuth config, UI components,
      // or scripts not part of the application runtime.
      include: [
        "lib/**/*.ts",
        "scripts/monitor.ts",
        "app/api/**/*.ts",
        "middleware.ts",
      ],
      exclude: [
        // NextAuth config — pure framework configuration, not unit-testable logic
        "lib/auth.ts",
        "app/api/auth/**",
        // fetch-airports is a one-off admin utility, not part of app runtime
        "scripts/fetch-airports.ts",
      ],
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
