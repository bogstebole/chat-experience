import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    dts({ include: ["src"], rollupTypes: false }),
  ],
  css: {
    modules: {
      // Stable, readable class names so consumers can target them if they must.
      generateScopedName: "ick-[local]-[hash:base64:4]",
    },
  },
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "inline-chat-kit.js",
    },
    cssFileName: "inline-chat-kit",
    rollupOptions: {
      // Everything the host app already has stays external.
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "motion",
        "motion/react",
        "lucide-react",
      ],
      output: {
        // The whole kit is client-side; Next needs the directive on the bundle.
        banner: '"use client";',
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
