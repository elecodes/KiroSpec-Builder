import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/infrastructure/web/ui/**"],
    },
  },
  resolve: {
    alias: {
      "@domain": path.resolve(__dirname, "./src/domain"),
      "@use-cases": path.resolve(__dirname, "./src/use-cases"),
      "@adapters": path.resolve(__dirname, "./src/adapters"),
      "@infrastructure": path.resolve(__dirname, "./src/infrastructure"),
    },
  },
});
