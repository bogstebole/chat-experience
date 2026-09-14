/**
 * Records the composer's button row leaving for a second line and coming back.
 *
 * It exists for a before/after: the row's three controls — the microphone, the
 * plus and the send glyph — enter from `scale: 0` while animating `width`,
 * `height` and `marginLeft`, which is a layout property animated on the one
 * control a reader sees all day. That is the sort of thing an argument does
 * not settle and a slowed-down recording does.
 *
 *   npm run dev                       (the playground, on :5173)
 *   node tools/showcase/composer.mjs before
 *   node tools/showcase/composer.mjs after
 *
 * Written out at a quarter speed, because the whole thing is 400ms and the
 * question is what happens inside it. Cropped to the composer, measured off
 * the page rather than guessed, with room around it for the shadow.
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

const NAME = process.argv[2] ?? "composer";
/** A quarter speed: 400ms of motion becomes 1.6 seconds to look at. */
const SLOW = 4;
const VIEWPORT = { width: 1120, height: 680 };

/** Long enough to wrap the editor onto a second line, and no longer. */
const LONG = "Tell me what a quark actually is, and how anybody ever found one";

const frameDir = join(OUT, `${NAME}-frames`);
await rm(frameDir, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: [`--force-device-scale-factor=${SCALE}`, "--hide-scrollbars"],
});
const page = await browser.newPage({ viewport: VIEWPORT });

await page.goto(`${BASE}/chat`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /start experience/i }).click();
await beat(page, 1200);

const editor = page.locator('[contenteditable="plaintext-only"]').last();
await editor.click();
await beat(page, 400);

/* Where the composer is, so the crop is measured rather than guessed. The row
   sits at the end of the conversation, and it moves as soon as anything is
   sent — which is why nothing is sent here. */
const box = await page.evaluate(() => {
  const turn = [...document.querySelectorAll("[id^='turn-']")].pop();
  const r = turn.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
});
/* Room for the shadow and for the second line the editor is about to grow. */
const PAD = 28;
const crop = {
  x: Math.max(0, box.x - PAD),
  y: Math.max(0, box.y - PAD),
  w: Math.min(VIEWPORT.width, box.w + PAD * 2),
  h: Math.min(VIEWPORT.height, box.h + PAD * 2 + 48),
};

const capture = await startCapture(page, frameDir, VIEWPORT);

await beat(page, 500);
/* Typed rather than set, because the row leaves when the editor wraps and the
   wrap happens on a keystroke. Fast enough not to pad the clip, slow enough
   that the wrap is a moment rather than a jump. */
await editor.pressSequentially(LONG, { delay: 22 });
await beat(page, 1400);
/* And back. Select-all then delete collapses it in one go, which is the same
   moment in reverse and the one worth comparing. */
await page.keyboard.press("ControlOrMeta+a");
await page.keyboard.press("Backspace");
await beat(page, 1600);

await capture.stop();

const ffmpeg = systemFfmpeg() ?? bundledFfmpeg();
const out = join(OUT, `composer-${NAME}.mp4`);
const result = await clip({ frames: capture.frames, out, ffmpeg, crop, slow: SLOW });

await rm(frameDir, { recursive: true, force: true });
await browser.close();

console.log(
  `${out}\n  ${result.frames} frames, ${crop.w}\u00d7${crop.h} CSS px, ${SLOW}\u00d7 slower than life`
);
