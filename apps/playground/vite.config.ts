import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind every interface rather than just `localhost`. On Node 17+ that name
    // can resolve to IPv6 ::1 while a browser asks for 127.0.0.1, which shows
    // up as a refused connection in one browser and not another. Listening
    // broadly also puts the playground on the LAN, so a phone or a second
    // machine can load it — useful, since the perf problem being chased is
    // hardware dependent.
    host: true,
    port: 5173,
    // Fail loudly instead of silently moving to 5174 when the port is taken,
    // so the URL never drifts out from under you.
    strictPort: true,
  },
  resolve: {
    alias: {
      // Point at the kit's source so editing it hot-reloads here without a
      // rebuild. Consumers get the built package via its exports map instead.
      "inline-chat-kit": resolve(import.meta.dirname, "../../packages/inline-chat-kit/src/index.ts"),
    },
  },
});
