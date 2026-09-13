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
      /* Two entries, because the demo is not the library.

         `inline-chat-kit` is what an app builds on. `inline-chat-kit/demo` is
         the scripted showcase — a landing page, a conversation full of
         particle physics, and the answers behind it — which two apps were each
         keeping their own copy of. Behind its own entry, an app that never
         imports it never carries a line of it. */
      entry: {
        "inline-chat-kit": resolve(import.meta.dirname, "src/index.ts"),
        demo: resolve(import.meta.dirname, "src/demo/index.ts"),
      },
      formats: ["es"],
      fileName: (_format, name) => `${name}.js`,
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
