import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    css: true, // CSS Modules must resolve, components read class names off them
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
