/**
 * What the browser checks need before they can run: a browser, and something
 * to serve.
 *
 * Both of these exist so the checks can go into `npm run verify`. That script
 * is documented as "everything CI runs", and it only stays true if the browser
 * checks are in it — but Playwright is deliberately not a dependency of this
 * repo, because a browser download is a heavy thing to put on everyone who
 * clones it. So the checks **skip out loud** where it is missing rather than
 * failing, and CI installs it so that there they really run.
 *
 * A skip that is silent would be worse than not running at all: a green gate
 * that checked nothing is exactly the failure this repo keeps finding.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Playwright, or `null`.
 *
 * Resolved without throwing, unlike `showcase/lib.mjs`, which throws at import
 * time — fine for a recording somebody asked for by name, useless for a check
 * that has to decide whether it can run.
 */
export async function browsers() {
  try {
    const mod = await import("playwright");
    return mod.default ?? mod;
  } catch {
    try {
      const root = execSync("npm root -g", { encoding: "utf8" }).trim();
      const mod = await import(pathToFileURL(join(root, "playwright", "index.js")).href);
      return mod.default ?? mod;
    } catch {
      return null;
    }
  }
}

/** Says why it is not running, and leaves the gate green. */
export function skip(what, how = "npm i -g playwright && npx playwright install chromium webkit") {
  console.log(`\n  ${what} skipped — Playwright is not installed.\n  ${how}\n`);
  process.exit(0);
}

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".mp3": "audio/mpeg",
};

/**
 * A static server over a built directory.
 *
 * The checks run against the **build**, not against a dev server somebody
 * remembered to start. A check that needs a human to have run something first
 * is a check that will be skipped, and one that silently measures a stale dev
 * server is worse than that.
 *
 * Anything not on disk falls back to `index.html`, so a client-routed app
 * answers on every path.
 */
export async function serveStatic(dir, port) {
  if (!existsSync(join(dir, "index.html"))) {
    console.error(`\n  Nothing built at ${dir}. Run \`npm run build\` first.\n`);
    process.exit(1);
  }
  const server = createServer(async (req, res) => {
    const path = join(dir, decodeURIComponent(req.url.split("?")[0]));
    try {
      const body = await readFile(path);
      res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      /* Fall back to `index.html` only for a **navigation**, never for an
         asset.
      
         Falling back for everything answers a missing stylesheet with a page
         of HTML, and a browser handed HTML for a `<link rel=stylesheet>` drops
         it without a word. The playground came up in serif with no surfaces
         at all and every colour read as transparent — which is what a colour
         probe reports when there is no CSS, and it looks exactly like a
         measurement bug. A request with a file extension wants that file or a
         404. */
      if (extname(path)) {
        res.writeHead(404);
        res.end("not here");
        return;
      }
      try {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(await readFile(join(dir, "index.html")));
      } catch {
        res.writeHead(404);
        res.end("not here");
      }
    }
  });
  await new Promise((ready) => server.listen(port, ready));
  return { url: `http://localhost:${port}`, close: () => server.close() };
}
