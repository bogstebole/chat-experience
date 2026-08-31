/**
 * Records the showcase video: sending a message, marking a passage, asking
 * about it in a thread, and the theme.
 *
 * It drives the real playground rather than a mock, so the video cannot show
 * something the component does not do — and re-running it after a change is
 * how the video stops being out of date.
 *
 *   npm run showcase            light
 *   npm run showcase -- dark    dark
 *
 * The dev server must already be running on :5173. The machinery — browser,
 * screencast, encoders — is in `lib.mjs`.
 */
import { mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  BASE,
  FPS,
  H264,
  OUT,
  SCALE,
  VP8,
  beat,
  bundledFfmpeg,
  chromium,
  encode,
  startCapture,
  systemFfmpeg,
  theme,
} from "./lib.mjs";

const THEME = theme();

// Narrower than the first cut: the chat column is about 660px, so a 1280 frame
// left 300px of nothing down each side.
const VIEWPORT = { width: 1120, height: 680 };

/**
 * The demo answers are fixed, so the questions are written to fit them. A
 * video whose answer does not address its question reads as broken, however
 * good the animation is.
 *
 * The question doubles as the header's title once it is sent, so it has to
 * read as a title too — short enough to survive the truncation, and specific
 * enough that seeing it up there is worth something.
 */
const QUESTION = "What does particle physics actually study?";
const THREAD_QUESTION = "How big is the Higgs boson?";
const HIGHLIGHT_FROM = "Higgs";
const HIGHLIGHT_TO = "2012";

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

async function main() {
  await mkdir(OUT, { recursive: true });
  const framesDir = join(OUT, `.frames-${THEME}`);

  const browser = await chromium.launch({ args: [`--force-device-scale-factor=${SCALE}`] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    // The flag above is what the screencast reads; this is what the page
    // reads. Both, so anything drawing per device pixel agrees with the frame.
    deviceScaleFactor: SCALE,
    colorScheme: THEME,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  // Loaded before capture starts, so the video does not open on a blank page.
  await page.goto(`${BASE}/?showcase&theme=${THEME}`, { waitUntil: "networkidle" });
  await beat(page, 500);

  const capture = await startCapture(page, framesDir, VIEWPORT);

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
    await beat(page, 700);
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
  await beat(page, 3400);

  // ── Out ───────────────────────────────────────────────────────────────
  await page.keyboard.press("Escape");
  await beat(page, 700);

  // ── The theme ─────────────────────────────────────────────────────────
  // One click, and every colour in the frame is repainted from two channel
  // triplets. It is the only way to show a token system in a video: the work
  // is invisible right up until the moment it is not.
  const theme = page.getByRole("button", { name: /switch to the (dark|light) theme/i });
  await theme.hover();
  await beat(page, 260);
  await theme.click();
  // The last frame is the one people see when the loop pauses, so it holds.
  await beat(page, 2000);

  await capture.stop();
  await context.close();
  await browser.close();

  const webm = join(OUT, `inline-chat-${THEME}.webm`);
  await encode(capture.frames, webm, bundledFfmpeg(), VP8);

  // Written from the frames rather than from the webm. Transcoding VP8 to
  // H.264 would put the second encoder's artefacts on top of the first's,
  // and the small text is where that shows first.
  const system = systemFfmpeg();
  const mp4 = join(OUT, `inline-chat-${THEME}.mp4`);
  if (system) await encode(capture.frames, mp4, system, H264);

  await rm(framesDir, { recursive: true, force: true });

  const written = await readdir(OUT);
  console.log(`\n  ${webm}`);
  if (system) console.log(`  ${mp4}`);
  else console.log("  (no system ffmpeg on PATH, so no mp4 — `brew install ffmpeg`)");
  console.log();
  void written;
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
