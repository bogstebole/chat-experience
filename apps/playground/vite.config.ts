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
      /* The stylesheet first, and by its public name.

         A host is told to `import "inline-chat-kit/styles.css"` — that is what
         the README says and what the website does — and the playground never
         did. It relied on the bare `import "./styles/tokens.css"` inside the
         kit's entry, which survives the dev server and does **not** survive
         the production build: the built demo came out with every component's
         CSS module and not one token, so `--bg` and everything else resolved
         to nothing and the whole page rendered unstyled in serif. Nobody had
         looked at the playground's build.

         Pointed at the source rather than at `dist`, so it hot-reloads with
         the components beside it. The name is the consumer's, the file is the
         one being worked on. */
      "inline-chat-kit/styles.css": resolve(
        import.meta.dirname,
        "../../packages/inline-chat-kit/src/styles/tokens.css"
      ),
      /* The demo entry, before the bare name — an alias map is walked in
         order, and `"inline-chat-kit"` matched as a prefix would rewrite this
         to `src/index.ts/demo`, which is a path through a file. */
      "inline-chat-kit/demo": resolve(
        import.meta.dirname,
        "../../packages/inline-chat-kit/src/demo/index.ts"
      ),
      // Point at the kit's source so editing it hot-reloads here without a
      // rebuild. Consumers get the built package via its exports map instead.
      "inline-chat-kit": resolve(import.meta.dirname, "../../packages/inline-chat-kit/src/index.ts"),
    },
  },
});
