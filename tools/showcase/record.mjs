/**
 * Records the showcase video.
 *
 * It drives the real playground rather than a mock, so the video cannot show
 * something the component does not do — and re-running it after a change is
 * how the video stops being out of date.
 *
 * Needs Playwright. It is not a dependency of this repo: browsers are a heavy
 * install for everyone, and this is a marketing tool rather than part of the
 * package. Run with a global install:
 *
 *   npm run showcase          (from the repo root)
 *
 * The dev server must already be running on :5173.
 */
import { mkdir, rm, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync } from "node:child_process";

/**
 * Resolve Playwright from wherever it is: this repo if someone installed it
 * here, otherwise the global install. ESM ignores NODE_PATH, so a bare
 * `import "playwright"` only works for the first case — and the first case is
 * the one that is not true here.
 */
const loadPlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    try {
      return await import(pathToFileURL(join(root, "playwright", "index.js")).href);
    } catch {
      throw new Error(
        "Playwright is not installed. It is deliberately not a dependency of this repo — " +
          "browsers are a heavy install for everyone and this is a marketing tool. " +
          "Install it with: npm i -g playwright && npx playwright install chromium"
      );
    }
  }
};

// Playwright is CommonJS, so a dynamic import hands it back under `default`
// when it comes from a path rather than from the package name.
const playwright = await loadPlaywright();
const { chromium } = playwright.default ?? playwright;

const BASE = "http://localhost:5173";
// `fileURLToPath`, not `.pathname` — the repo lives under a directory with a
// space in its name, and `.pathname` hands back the percent-encoded form,
// which fs takes literally and quietly builds a parallel tree for.
const OUT = fileURLToPath(new URL("../../Videos/showcase", import.meta.url));
const THEME = process.argv[2] === "dark" ? "dark" : "light";

// Short enough that the chat is not marooned in white space. The thread
// popup is the tallest thing that has to fit.
const VIEWPORT = { width: 1280, height: 680 };

/**
 * The demo answers are fixed, so the questions are written to fit them.
 * A video where the answer does not address the question is a video that
 * reads as broken, however good the animation is.
 */
const QUESTION = "What does particle physics actually study?";
const THREAD_QUESTION = "How big is the Higgs boson?";
const HIGHLIGHT_FROM = "Higgs";
const HIGHLIGHT_TO = "2012";

const beat = (page, ms) => page.waitForTimeout(ms);

/**
 * A drag with enough intermediate points to look like a hand.
 *
 * The marker records a point per pointermove, so a two-point drag draws a
 * straight line with nothing in between and the stroke arrives instantly.
 */
async function drawAcross(page, from, to, steps = 44) {
  await page.mouse.move(from.x, from.y);
  await beat(page, 260);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // A little vertical wander, so it reads as drawn rather than computed.
    const wobble = Math.sin(t * Math.PI * 2) * 1.6;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t + wobble);
    await beat(page, 9);
  }
  await page.mouse.up();
}

/** The centre of the word containing `text`, in page coordinates. */
async function wordCentre(page, text, which = "first") {
  const box = await page.evaluate(
    ({ text, which }) => {
      const spans = [...document.querySelectorAll('[data-cursor="marker"] span[data-index]')];
      const hit = which === "first"
        ? spans.find((s) => s.textContent.trim().startsWith(text.split(" ")[0]))
        : [...spans].reverse().find((s) => s.textContent.trim().startsWith(text.split(" ")[0]));
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    { text, which }
  );
  if (!box) throw new Error(`could not find the word "${text}" in the answer`);
  return box;
}

async function main() {
  // Clear only this theme's files. Wiping the directory would mean recording
  // the second theme deletes the first, which is exactly what it did.
  await mkdir(OUT, { recursive: true });
  for (const stale of await readdir(OUT).catch(() => [])) {
    if (stale.startsWith(`inline-chat-${THEME}.`) || stale.endsWith(".webm.tmp")) {
      await rm(join(OUT, stale), { force: true });
    }
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: VIEWPORT },
    colorScheme: THEME,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/?showcase&theme=${THEME}`, { waitUntil: "networkidle" });
  await beat(page, 900);

  // ── In ────────────────────────────────────────────────────────────────
  const start = page.getByRole("button", { name: /start experience/i });
  await start.hover();
  await beat(page, 420);
  await start.click();
  await beat(page, 1100);

  // ── Ask ───────────────────────────────────────────────────────────────
  const editor = page.locator("[contenteditable]").last();
  await editor.click();
  await beat(page, 300);
  await page.keyboard.type(QUESTION, { delay: 52 });
  await beat(page, 620);

  // The morph out of the input is the moment worth watching.
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-cursor="marker"]', { timeout: 15000 });

  // Let the answer finish arriving.
  await page.waitForFunction(
    () => {
      const el = document.querySelector('[data-cursor="marker"]');
      if (!el) return false;
      const now = el.textContent.length;
      const settled = window.__len === now;
      window.__len = now;
      return settled && now > 80;
    },
    null,
    { polling: 420, timeout: 30000 }
  );
  await beat(page, 900);

  // ── Highlight ─────────────────────────────────────────────────────────
  const from = await wordCentre(page, HIGHLIGHT_FROM, "first");
  const to = await wordCentre(page, HIGHLIGHT_TO, "last");
  await drawAcross(page, from, to);
  await beat(page, 1000);

  // ── Ask about the highlight ───────────────────────────────────────────
  const reply = page.getByRole("menuitem", { name: /reply in thread/i });
  await reply.hover();
  await beat(page, 380);
  await reply.click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await beat(page, 800);

  const threadEditor = page.locator('[role="dialog"] [contenteditable]').last();
  await threadEditor.click();
  await page.keyboard.type(THREAD_QUESTION, { delay: 48 });
  await beat(page, 500);
  await page.keyboard.press("Enter");
  await beat(page, 5200);

  // ── Out ───────────────────────────────────────────────────────────────
  await page.keyboard.press("Escape");
  await beat(page, 1400);

  await context.close();
  await browser.close();

  // Playwright names the file after the page's guid; give it a name. Anything
  // already called `inline-chat-*` is a previous run's output — picking the
  // first .webm in the directory grabbed one of those and renamed it over
  // itself, leaving the actual recording behind under its guid.
  const [file] = (await readdir(OUT)).filter(
    (f) => f.endsWith(".webm") && !f.startsWith("inline-chat-")
  );
  if (!file) throw new Error("Playwright wrote no video");
  const webm = join(OUT, `inline-chat-${THEME}.webm`);
  await rename(join(OUT, file), webm);

  // mp4 as well, when there is an ffmpeg that can make one. Playwright ships
  // its own, but it is a stripped build with VP8 and nothing else — it made
  // the webm and cannot re-encode it. macOS's avconvert cannot read VP8 at
  // all. So this needs a real ffmpeg, and says so rather than failing quietly.
  const mp4 = webm.replace(/\.webm$/, ".mp4");
  const poster = webm.replace(/\.webm$/, "-poster.jpg");
  const hasFfmpeg = (() => {
    try {
      execSync("command -v ffmpeg", { stdio: "ignore", shell: "/bin/bash" });
      return true;
    } catch {
      return false;
    }
  })();

  if (hasFfmpeg) {
    execSync(
      `ffmpeg -y -i "${webm}" -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart "${mp4}"`,
      { stdio: "ignore", shell: "/bin/bash" }
    );
    execSync(`ffmpeg -y -ss 12 -i "${webm}" -frames:v 1 -q:v 3 "${poster}"`, {
      stdio: "ignore",
      shell: "/bin/bash",
    });
    console.log(`\n  ${mp4}\n  ${webm}\n  ${poster}\n`);
  } else {
    console.log(
      `\n  ${webm}\n\n` +
        "  No mp4: this needs a real ffmpeg (`brew install ffmpeg`).\n" +
        "  Safari plays VP8 webm from 16 onwards, so the webm alone is enough\n" +
        "  for most sites — mp4 is the safer bet if older Safari matters.\n"
    );
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
