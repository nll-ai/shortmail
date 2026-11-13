import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  test: {
    environment: "node",
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "convex/**/*.test.ts",
      "scripts/**/*.test.ts",
      "shared/**/*.test.ts",
      "e2e/**/*.spec.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
    },
  },
});
