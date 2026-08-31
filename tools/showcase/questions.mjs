/**
 * Records the question-card showcase: the assistant asking rather than
 * answering, and every state a question passes through.
 *
 *   npm run showcase:questions            light
 *   npm run showcase:questions -- dark    dark
 *
 * Square, because this is for a feed. A 16:9 frame of a chat column is two
 * thirds empty on a phone, and both LinkedIn and X give a square post more
 * vertical room than a landscape one.
 *
 * It drives the real playground rather than a mock, so the video cannot show
 * something the component does not do. The dev server must be on :5173.
 */
import { mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  BASE,
  H264,
  OUT,
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

/**
 * 840 square, captured at 2× and encoded down to 1080.
 *
 * Downscaling 1680 → 1080 is what makes the small text crisp; rendering at
 * 1080 directly would be softer for the same file.
 *
 * 840 rather than 1120: the chat column is a fixed 720 at most, so a wider
 * frame does not make the card bigger — it only adds empty page down both
 * sides and pushes the same content into a smaller share of a square.
 *
 * And not 760 either, which was the take before this one: the third question
 * has four options and a footer, and at 760 the last option and the button
 * under it fell off the bottom of the frame. A square is as short as it is
 * wide, so the width has to be chosen for the tallest thing on screen.
 */
const VIEWPORT = { width: 840, height: 840 };
const SIDE = 1080;
const DOWNSCALE = ["-vf", `scale=${SIDE}:${SIDE}:flags=lanczos`];

/** The opener that routes to the question branch of the scripted agent. */
const ASK = "Set up a double-slit experiment";

/** What gets typed into the two free-text fields of the first question. */
const PARTICLE = "Electron";
const SEPARATION = "120 nm";
const OTHER = "Detection rate over time";

/**
 * Bring the open question fully into frame, footer and all.
 *
 * `scrollIntoViewIfNeeded` on the control being clicked is not enough: it
 * stops as soon as *that* is visible, which leaves the Next button under it
 * off the bottom. This scrolls the card.
 */
const showCard = async (page) => {
  await page.evaluate(() => {
    const card = document.querySelector('[class*="item"][data-card]');
    card?.scrollIntoView({ block: "center", behavior: "smooth" });
  });
  await page.waitForTimeout(500);
};

/** Move like a hand: a straight jump to a control reads as a script. */
const reach = async (page, locator, pause = 240) => {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.hover();
  await beat(page, pause);
};

const press = async (page, locator, pause = 420) => {
  await reach(page, locator);
  await locator.click();
  await beat(page, pause);
};

const type = async (page, locator, text) => {
  await press(page, locator, 120);
  await page.keyboard.type(text, { delay: 42 });
  await beat(page, 260);
};

async function main() {
  await mkdir(OUT, { recursive: true });
  const framesDir = join(OUT, `.frames-questions-${THEME}`);

  const browser = await chromium.launch({ args: ["--force-device-scale-factor=2"] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: THEME,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/?showcase&theme=${THEME}`, { waitUntil: "networkidle" });
  await beat(page, 500);

  const capture = await startCapture(page, framesDir, VIEWPORT);

  // ── In ────────────────────────────────────────────────────────────────
  await press(page, page.getByRole("button", { name: /start experience/i }), 900);

  // ── Asking to be asked ────────────────────────────────────────────────
  // The opener, rather than typing it: this video is about what comes back.
  await press(page, page.getByRole("button", { name: ASK }), 300);

  // Three questions arrive: one open, two waiting with their numbers.
  await page.waitForSelector("text=What are we running?", { timeout: 15000 });
  await beat(page, 1500);

  // ── 1. Free text ──────────────────────────────────────────────────────
  /* By placeholder, not by index. The chat's own composer is a `textbox` too,
     so `getByRole("textbox").nth(0)` picks the box at the bottom of the page
     and the card's fields stay empty — which is how the first take reached a
     disabled Next and sat there for thirty seconds. */
  await type(page, page.getByPlaceholder("Electron"), PARTICLE);
  await type(page, page.getByPlaceholder("100 nm"), SEPARATION);
  await beat(page, 400);

  /* Committing is the moment worth watching: the card folds into an answered
     row carrying its own answers, and the next one opens in the same motion. */
  await press(page, page.getByRole("button", { name: "Next" }), 400);
  await page.waitForSelector("text=Where do you put the detector?", { timeout: 10000 });
  await beat(page, 1400);

  // ── 2. Pick one ───────────────────────────────────────────────────────
  /* No Next here, and that is the point of the type: picking *is* answering.
     A beat between the pick and the fold, so the choice is visible before the
     card is gone. */
  await reach(page, page.getByRole("button", { name: /At the slits/ }), 500);
  /* "Nowhere" is the answer that makes the experiment interesting, and the
     one a video should land on. */
  await press(page, page.getByRole("button", { name: /Nowhere/ }), 500);
  await page.waitForSelector("text=What should I plot?", { timeout: 10000 });
  await showCard(page);
  await beat(page, 900);

  // ── 3. Pick several, or say something else ────────────────────────────
  await press(page, page.getByRole("button", { name: /Interference pattern/ }), 450);
  await press(page, page.getByRole("button", { name: /Wavefunction/ }), 700);
  await type(page, page.getByPlaceholder("Something else"), OTHER);
  await beat(page, 500);
  await press(page, page.getByRole("button", { name: "Next" }), 2400);

  // ── The whole step, folded ────────────────────────────────────────────
  /* With every question answered the group folds itself into one row. Three
     answered cards is a receipt taking up half the screen; one row saying
     what was covered is the same information at the size it deserves. */
  await press(page, page.getByRole("button", { name: /The setup · Detector/ }), 1800);

  // ── Going back ────────────────────────────────────────────────────────
  /* An answered question is not a receipt either. The row is a control: it
     reopens with what was said still in it. */
  await press(page, page.getByRole("button", { name: /Edit answer: The setup/ }), 900);
  /* The pointer leaves, so the last frames are the thing rather than a cursor
     sitting on it. A social video loops, and this is the frame it pauses on. */
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height - 40, { steps: 18 });
  await beat(page, 3200);

  /* The theme switch lives in the other video. This one is about a question,
     and ending on "you can go back and change your answer" is the sentence it
     was making. */

  await capture.stop();
  await context.close();
  await browser.close();

  const webm = join(OUT, `questions-${THEME}.webm`);
  await encode(capture.frames, webm, bundledFfmpeg(), [...VP8, ...DOWNSCALE]);

  const system = systemFfmpeg();
  const mp4 = join(OUT, `questions-${THEME}.mp4`);
  if (system) await encode(capture.frames, mp4, system, [...H264, ...DOWNSCALE]);

  await rm(framesDir, { recursive: true, force: true });

  console.log(`\n  ${webm}`);
  if (system) console.log(`  ${mp4}`);
  else console.log("  (no system ffmpeg on PATH, so no mp4 — `brew install ffmpeg`)");
  console.log();
  void (await readdir(OUT));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
