/**
 * Visual QA: geometry rules over every story, in a real browser.
 *
 *   npm run build-storybook --workspace packages/inline-chat-kit
 *   node tools/visual-qa/run.mjs
 *   node tools/visual-qa/run.mjs --theme dark
 *   node tools/visual-qa/run.mjs --story components-chatheader
 *
 * **Rules, not screenshots.** A pixel snapshot fails on every intentional
 * change and on a different font renderer, and all it can say is that
 * something moved. A rule says which rule broke and by how much, which is the
 * difference between a suite people keep and one they delete.
 *
 * Storybook rather than the playground: every component has a story, the
 * stories are isolated, and `build-storybook` already runs in `npm run
 * verify`. What is checked here is what the kit claims to look like.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../showcase/lib.mjs";
import { RULES_SOURCE } from "./rules.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const STATIC = join(HERE, "..", "..", "packages", "inline-chat-kit", "storybook-static");
const PORT = 4681;
/**
 * Sub-pixel differences are the browser splitting an odd number between two
 * gaps and are nobody's fault. Anything a person can see is above this.
 */
const TOLERANCE = 1;

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const THEME = flag("theme", "light");
const ONLY = flag("story", null);

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".png": "image/png",
};

if (!existsSync(join(STATIC, "index.json"))) {
  console.error(
    "No built Storybook. Run:\n" +
      "  npm run build-storybook --workspace packages/inline-chat-kit\n"
  );
  process.exit(1);
}

const serve = () =>
  new Promise((ready) => {
    const server = createServer(async (req, res) => {
      const path = join(STATIC, decodeURIComponent(req.url.split("?")[0]));
      try {
        const body = await readFile(path);
        res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("not here");
      }
    });
    server.listen(PORT, () => ready(server));
  });

const server = await serve();
const index = JSON.parse(await readFile(join(STATIC, "index.json"), "utf8"));
const stories = Object.values(index.entries)
  .filter((e) => e.type === "story")
  .filter((e) => !ONLY || e.id.includes(ONLY));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1000, height: 800 },
  deviceScaleFactor: 2,
  colorScheme: THEME,
  // A rule about geometry should measure where things come to rest, not where
  // an entrance animation had them when the page was read.
  reducedMotion: "reduce",
});
const page = await context.newPage();

const found = [];
let checked = 0;

for (const story of stories) {
  await page.goto(`http://localhost:${PORT}/iframe.html?id=${story.id}&viewMode=story`, {
    waitUntil: "networkidle",
  });
  // Let springs settle and fonts land; a box measured mid-flight is a box
  // measured wrong, and this is the whole failure mode the suite exists for.
  await page.waitForTimeout(450);
  await page.evaluate(() => document.fonts?.ready);

  const violations = await page.evaluate(
    ([source, tolerance]) => {
      // eslint-disable-next-line no-eval
      (0, eval)(source);
      return window.__visualQa(tolerance);
    },
    [RULES_SOURCE, TOLERANCE]
  );
  checked += 1;
  for (const v of violations) found.push({ ...v, story: story.id });
}

await browser.close();
server.close();

const byRule = found.reduce((acc, v) => ({ ...acc, [v.rule]: (acc[v.rule] ?? 0) + 1 }), {});

console.log(`\n  ${checked} stories, ${THEME} theme, tolerance ${TOLERANCE}px\n`);
if (!found.length) {
  console.log("  nothing out of place\n");
} else {
  let last = null;
  for (const v of found) {
    if (v.story !== last) {
      console.log(`  ${v.story}`);
      last = v.story;
    }
    console.log(`    ${v.rule.padEnd(10)} ${v.element}`);
    console.log(`               ${v.detail}`);
  }
  console.log(
    `\n  ${found.length} in all — ` +
      Object.entries(byRule).map(([r, n]) => `${r} ${n}`).join(", ") +
      "\n"
  );
}

process.exit(found.length ? 1 : 0);
