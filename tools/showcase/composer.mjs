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
import { spawn } from "node:child_process";
import { join } from "node:path";
import {
  BASE,
  FPS,
  H264,
  OUT,
  SCALE,
  beat,
  bundledFfmpeg,
  chromium,
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

/* Crop in the frame's own pixels, which are `SCALE` times the CSS ones — the
   screencast reads the browser's scale factor, not the context's. */
const filter =
  `crop=${crop.w * SCALE}:${crop.h * SCALE}:${crop.x * SCALE}:${crop.y * SCALE},` +
  `setpts=${SLOW}*PTS`;

const { frames } = capture;
if (frames.length === 0) throw new Error("no frames were captured");
const start = frames[0].t;
const duration = frames[frames.length - 1].t - start;
const slots = Math.max(1, Math.round(duration * FPS));

const proc = spawn(ffmpeg, [
  "-y",
  "-f", "image2pipe",
  "-r", String(FPS),
  "-c:v", "mjpeg",
  "-i", "pipe:0",
  "-vf", filter,
  ...H264,
  "-pix_fmt", "yuv420p",
  out,
]);
let complaint = "";
proc.stderr.on("data", (d) => (complaint += d));

/* Frames arrive only when something changes, so they are spaced unevenly.
   Encoding needs a steady rate: for each slot on a fixed clock, write whichever
   frame was the most recent at that moment. */
const { readFile } = await import("node:fs/promises");
let at = 0;
for (let slot = 0; slot < slots; slot++) {
  const t = start + slot / FPS;
  while (at + 1 < frames.length && frames[at + 1].t <= t) at++;
  proc.stdin.write(await readFile(frames[at].name));
}
proc.stdin.end();

const code = await new Promise((r) => proc.on("close", r));
await rm(frameDir, { recursive: true, force: true });
await browser.close();

if (code !== 0) {
  console.error(complaint.split("\n").slice(-12).join("\n"));
  process.exit(1);
}
console.log(
  `${out}\n  ${frames.length} frames, ${crop.w}×${crop.h} CSS px, ${SLOW}× slower than life`
);
