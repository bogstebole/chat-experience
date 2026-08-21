import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Point at the kit's source so editing it hot-reloads here without a
      // rebuild. Consumers get the built package via its exports map instead.
      "inline-chat-kit": resolve(__dirname, "../../packages/inline-chat-kit/src/index.ts"),
    },
  },
});
