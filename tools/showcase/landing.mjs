/**
 * Records the landing page leaving for the chat.
 *
 * The whole transition is 280ms of staggered exit, and the question is the
 * curve it leaves on — so this is recorded at life speed, uncropped. A curve
 * is a claim about how something feels at the speed it actually happens; a
 * slowed clip can prove what the numbers do but not that.
 *
 *   npm run dev                      (the playground, on :5173)
 *   node tools/showcase/landing.mjs before
 *   node tools/showcase/landing.mjs after
 */
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import {
  BASE,
  OUT,
  SCALE,
  beat,
  bundledFfmpeg,
  chromium,
  clip,
  startCapture,
  systemFfmpeg,
} from "./lib.mjs";

const NAME = process.argv[2] ?? "landing";
const VIEWPORT = { width: 1120, height: 680 };

const frameDir = join(OUT, `${NAME}-frames`);
await rm(frameDir, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [`--force-device-scale-factor=${SCALE}`, "--hide-scrollbars"],
});
const page = await browser.newPage({ viewport: VIEWPORT });

/* Light, so the two recordings cannot differ by theme. `?theme=` is read by
   the playground's showcase module and handed to the kit as a chosen theme. */
await page.goto(`${BASE}/chat?theme=light`, { waitUntil: "networkidle" });

/* The landing has a staggered entrance of its own. Let it finish, or the
   recording opens mid-arrival and the exit is judged against a page that was
   still settling. */
await beat(page, 2500);

const capture = await startCapture(page, frameDir, VIEWPORT);

/* A beat of stillness first, so there is something to leave *from* — a clip
   that opens on the click gives the eye no starting state. */
await beat(page, 600);
await page.getByRole("button", { name: /start experience/i }).click();
/* Through the exit and far enough into the chat's own entrance to see where
   the transition lands. */
await beat(page, 2400);

await capture.stop();

const ffmpeg = systemFfmpeg() ?? bundledFfmpeg();
const out = join(OUT, `landing-${NAME}.mp4`);
const result = await clip({ frames: capture.frames, out, ffmpeg, slow: 1 });

await rm(frameDir, { recursive: true, force: true });
await browser.close();

console.log(`${out}\n  ${result.frames} frames, ${VIEWPORT.width}×${VIEWPORT.height}, life speed`);
