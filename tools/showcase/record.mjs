/**
 * Records the showcase video.
 *
 * It drives the real playground rather than a mock, so the video cannot show
 * something the component does not do — and re-running it after a change is
 * how the video stops being out of date.
 *
 *   npm run showcase            light
 *   npm run showcase -- dark    dark
 *
 * The dev server must already be running on :5173.
 *
 * Playwright is not a dependency of this repo — browsers are a heavy install
 * for everyone and this is a marketing tool. A global install is enough.
 */
import { mkdir, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execSync, spawn } from "node:child_process";

const loadPlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    try {
      return await import(pathToFileURL(join(root, "playwright", "index.js")).href);
    } catch {
      throw new Error(
        "Playwright is not installed. Install it with:\n" +
          "  npm i -g playwright && npx playwright install chromium"
      );
    }
  }
};

// Playwright is CommonJS, so a dynamic import by path hands it back under
// `default`.
const playwright = await loadPlaywright();
const { chromium } = playwright.default ?? playwright;

const BASE = "http://localhost:5173";
// `fileURLToPath`, not `.pathname` — the repo lives under a directory with a
// space in its name, and `.pathname` hands back the percent-encoded form,
// which fs takes literally and quietly builds a parallel tree for.
const OUT = fileURLToPath(new URL("../../Videos/showcase", import.meta.url));
const THEME = process.argv[2] === "dark" ? "dark" : "light";

// Narrower than the first cut: the chat column is about 660px, so a 1280 frame
// left 300px of nothing down each side.
const VIEWPORT = { width: 1120, height: 680 };
const SCALE = 2; // captured at 2×, so it is sharp on the displays people have
const FPS = 30;

/**
 * The demo answers are fixed, so the questions are written to fit them. A
 * video whose answer does not address its question reads as broken, however
 * good the animation is.
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
async function drawAcross(page, from, to, steps = 40) {
  await page.mouse.move(from.x, from.y);
  await beat(page, 200);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // A little vertical wander, so it reads as drawn rather than computed.
    const wobble = Math.sin(t * Math.PI * 2) * 1.6;
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t + wobble);
    await beat(page, 8);
  }
  await page.mouse.up();
}

/** The centre of the word starting with `text`, in page coordinates. */
async function wordCentre(page, text, which = "first") {
  const box = await page.evaluate(
    ({ text, which }) => {
      const spans = [...document.querySelectorAll('[data-cursor="marker"] span[data-index]')];
      const match = (s) => s.textContent.trim().startsWith(text.split(" ")[0]);
      const hit = which === "first" ? spans.find(match) : [...spans].reverse().find(match);
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    { text, which }
  );
  if (!box) throw new Error(`could not find the word "${text}" in the answer`);
  return box;
}

/**
 * Capture through CDP rather than Playwright's own recorder.
 *
 * The built-in recorder writes VP8 at a bitrate it does not expose — around
 * 100–300 kb/s, which smears text — and it records at CSS resolution, so a
 * retina display gets a soft upscale. Asking for a bigger `recordVideo.size`
 * does not help: it pads the canvas rather than scaling the page.
 *
 * A screencast hands over JPEG frames at the device pixel ratio, which is
 * 2× here, and leaves the encoding to us.
 */
async function startCapture(page, dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const client = await page.context().newCDPSession(page);
  const frames = [];
  let index = 0;

  client.on("Page.screencastFrame", async ({ data, sessionId, metadata }) => {
    const name = join(dir, `${String(index++).padStart(5, "0")}.jpg`);
    frames.push({ name, t: metadata.timestamp });
    await writeFile(name, Buffer.from(data, "base64"));
    try {
      await client.send("Page.screencastFrameAck", { sessionId });
    } catch {
      // The page can close between a frame arriving and its acknowledgement.
    }
  });

  await client.send("Page.startScreencast", {
    format: "jpeg",
    quality: 92,
    maxWidth: VIEWPORT.width * SCALE,
    maxHeight: VIEWPORT.height * SCALE,
    everyNthFrame: 1,
  });

  return {
    frames,
    stop: async () => {
      await client.send("Page.stopScreencast").catch(() => {});
      await new Promise((r) => setTimeout(r, 250)); // let the last writes land
    },
  };
}

/**
 * Screencast frames arrive only when something changes, so they are spaced
 * unevenly. Encoding needs a steady rate: for each slot on a fixed clock,
 * write whichever frame was the most recent at that moment.
 */
async function encode(frames, out) {
  if (frames.length === 0) throw new Error("no frames were captured");

  const ffmpeg = execSync("ls -d ~/Library/Caches/ms-playwright/ffmpeg-*/ffmpeg-mac | tail -1", {
    shell: "/bin/bash",
    encoding: "utf8",
  }).trim();

  const start = frames[0].t;
  const duration = frames[frames.length - 1].t - start;
  const slots = Math.max(1, Math.round(duration * FPS));

  const proc = spawn(ffmpeg, [
    "-y",
    "-f", "image2pipe",
    "-r", String(FPS),
    "-c:v", "mjpeg",
    // `pipe:0`, not `-`: this build enables the pipe and file protocols only,
    // and the shorthand resolves to neither.
    "-i", "pipe:0",
    "-c:v", "libvpx",
    // The bitrate the built-in recorder would not give us. Text stays text.
    "-b:v", "8M",
    "-qmin", "4",
    "-qmax", "24",
    "-deadline", "good",
    "-cpu-used", "1",
    "-auto-alt-ref", "0",
    "-pix_fmt", "yuv420p",
    out,
  ]);

  // Kept so a failure says what ffmpeg objected to. Without it every argument
  // mistake arrives as a bare EPIPE from the pipe it already closed.
  let stderr = "";
  proc.stderr.on("data", (chunk) => (stderr += chunk));
  proc.stdin.on("error", () => {});

  const tail = () => stderr.trim().split("\n").slice(-12).join("\n");
  let finished = false;
  const done = new Promise((resolve, reject) => {
    proc.on("error", (error) => {
      finished = true;
      reject(new Error(`could not run ffmpeg: ${error.message}`));
    });
    proc.on("close", (code) => {
      finished = true;
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${tail()}`));
    });
  });
  // Nothing downstream awaits this copy; it exists so an early exit rejects
  // rather than leaving the writer waiting for a drain that never comes.
  done.catch(() => {});

  let cursor = 0;
  for (let slot = 0; slot < slots && !finished; slot++) {
    const at = start + slot / FPS;
    while (cursor + 1 < frames.length && frames[cursor + 1].t <= at) cursor++;
    const jpeg = await readFile(frames[cursor].name);
    if (!proc.stdin.write(jpeg)) {
      // Raced against `done`, or a dead ffmpeg means waiting forever — and a
      // promise nothing can settle exits node silently with a success code.
      await Promise.race([new Promise((r) => proc.stdin.once("drain", r)), done]);
    }
  }
  proc.stdin.end();

  await done;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const framesDir = join(OUT, `.frames-${THEME}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: THEME,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  // Loaded before capture starts, so the video does not open on a blank page.
  await page.goto(`${BASE}/?showcase&theme=${THEME}`, { waitUntil: "networkidle" });
  await beat(page, 500);

  const capture = await startCapture(page, framesDir);

  // ── In ────────────────────────────────────────────────────────────────
  const start = page.getByRole("button", { name: /start experience/i });
  await start.hover();
  await beat(page, 260);
  await start.click();
  await beat(page, 850);

  // ── Ask ───────────────────────────────────────────────────────────────
  const editor = page.locator("[contenteditable]").last();
  await editor.click();
  await beat(page, 200);
  await page.keyboard.type(QUESTION, { delay: 34 });
  await beat(page, 420);

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
    { polling: 350, timeout: 30000 }
  );
  await beat(page, 400);

  // ── The actions under a settled message ───────────────────────────────
  // A beat rather than a feature tour: hovering the bubble reveals copy and
  // edit, and a video that never shows them suggests they are not there.
  const bubble = page.locator('[data-cursor="marker"]').first();
  const sent = await page.evaluate(() => {
    const pill = document.querySelector('[class*="surface"][class*="glass"]');
    if (!pill) return null;
    const r = pill.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (sent) {
    await page.mouse.move(sent.x, sent.y, { steps: 12 });
    await beat(page, 1100);
  }
  await bubble.scrollIntoViewIfNeeded().catch(() => {});
  await beat(page, 200);

  // ── Highlight ─────────────────────────────────────────────────────────
  await drawAcross(page, await wordCentre(page, HIGHLIGHT_FROM, "first"), await wordCentre(page, HIGHLIGHT_TO, "last"));
  await beat(page, 700);

  // ── Ask about the highlight ───────────────────────────────────────────
  const reply = page.getByRole("menuitem", { name: /reply in thread/i });
  await reply.hover();
  await beat(page, 280);
  await reply.click();
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await beat(page, 500);

  const threadEditor = page.locator('[role="dialog"] [contenteditable]').last();
  await threadEditor.click();
  await page.keyboard.type(THREAD_QUESTION, { delay: 34 });
  await beat(page, 350);
  await page.keyboard.press("Enter");
  await beat(page, 4200);

  // ── Out ───────────────────────────────────────────────────────────────
  await page.keyboard.press("Escape");
  await beat(page, 900);

  await capture.stop();
  await context.close();
  await browser.close();

  const webm = join(OUT, `inline-chat-${THEME}.webm`);
  await encode(capture.frames, webm);
  await rm(framesDir, { recursive: true, force: true });

  const size = (await readdir(OUT)).includes(`inline-chat-${THEME}.webm`);
  console.log(`\n  ${webm}${size ? "" : "  (missing?)"}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
