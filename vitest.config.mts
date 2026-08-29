import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    // Mirror the "@/*" path alias from tsconfig so tests import like the app does.
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
