/**
 * Records the artifact card and the pane opening — and measures what the
 * recording is supposed to show.
 *
 *   npm run showcase:artifact            light
 *   npm run showcase:artifact -- dark    dark
 *
 * Two outputs, because they answer different questions. The video says whether
 * it *looks* right, which is the only judge of an animation. The numbers say
 * whether the thing it claims to do is the thing it does — that the card moves
 * and its surface does not, and that the pane's document is laid out once at
 * the width it ends up at rather than re-wrapping on every frame of its own
 * entrance. The second is not visible at speed and is exactly the sort of
 * claim that goes into a comment and quietly stops being true.
 *
 * The dev server must already be running on :5173. Machinery is in `lib.mjs`.
 */
import { mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  BASE,
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
/** Wide enough that the pane stands beside the conversation rather than over it. */
const VIEWPORT = { width: 1120, height: 680 };

const round = (n) => Math.round(n * 100) / 100;

/** The card's three states, read off the element rather than off the stylesheet. */
const stateOf = (page) =>
  page.evaluate(() => {
    const card = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("5k training plan")
    );
    if (!card) return null;
    const cs = getComputedStyle(card);
    const m = new DOMMatrixReadOnly(cs.transform);
    return {
      lift: Math.round(m.m42 * 100) / 100,
      scale: Math.round(m.m11 * 1000) / 1000,
      surface: cs.backgroundColor,
      /* The numbers out of the shadow, not the string.
      
         The first cut printed `boxShadow.split(",")[0]`, which cuts inside
         `rgba(17, 17, 17, .08)` and reported the word `rgba(17` in every state
         — three identical readings that looked like agreement and were the
         same truncation three times. What matters is how far it is thrown, so
         take the lengths and add them up. */
      throw: Math.round(
        [...cs.boxShadow.matchAll(/(-?\d*\.?\d+)px/g)]
          .map((m) => Math.abs(Number(m[1])))
          .reduce((a, b) => a + b, 0) * 100
      ) / 100,
      expanded: card.getAttribute("aria-expanded"),
    };
  });

/**
 * Watches the opening, frame by frame.
 *
 * Reached through `[data-pane]` and its children rather than by class name:
 * the layout states that attribute as part of what it is, while the hashed
 * module class is an implementation detail that would make this quietly stop
 * matching the day the file is renamed.
 */
const watch = (page) =>
  page.evaluate(() => {
    window.__samples = [];
    /* The layout root, found by the demo's own class rather than by
       `[data-pane]`, and the reason is that this ran wrong twice.

       `[data-pane]` is on the root only while a pane is being asked for. So a
       sampler that looked it up each frame lost the element at the instant the
       close began — four identical frames — and one that looked it up once
       before the open found nothing at all, because there was no pane yet.
       Both halves of the measurement need a handle that exists in both
       states, and `ChatLayout` is handed this class by the page it is in. */
    const layout = document.querySelector(".chatWorkspace");
    if (!layout) throw new Error("no .chatWorkspace — the demo's layout is not on the page");
    const tick = () => {
      const slot = layout?.children[1];
      const card = slot?.firstElementChild;
      if (slot && card) {
        window.__samples.push({
          room: Math.round(slot.getBoundingClientRect().width * 100) / 100,
          pane: Math.round(card.getBoundingClientRect().width * 100) / 100,
          chat: Math.round(layout.children[0].getBoundingClientRect().width * 100) / 100,
        });
      }
      window.__raf = requestAnimationFrame(tick);
    };
    window.__raf = requestAnimationFrame(tick);
  });

const samples = (page) =>
  page.evaluate(() => {
    cancelAnimationFrame(window.__raf);
    const seen = window.__samples;
    window.__samples = [];
    return seen;
  });

/** What a run of measurements did, in one line each. */
function report(label, seen) {
  if (!seen.length) return console.log(`  ${label}: nothing sampled`);
  const span = (key) => {
    const all = seen.map((s) => s[key]);
    return { min: round(Math.min(...all)), max: round(Math.max(...all)), steps: new Set(all).size };
  };
  const room = span("room");
  const pane = span("pane");
  const chat = span("chat");
  console.log(`  ${label}  (${seen.length} frames)`);
  console.log(`    room   ${room.min} → ${room.max}px over ${room.steps} distinct widths`);
  console.log(`    pane   ${pane.min} → ${pane.max}px over ${pane.steps} distinct widths`);
  console.log(`    chat   ${chat.min} → ${chat.max}px over ${chat.steps} distinct widths`);
  /* The claim in `ChatLayout.module.css`, checked: the room moves, the pane
     does not. One width for the pane across the whole entrance means its text
     was laid out once. */
  const laidOutOnce = pane.steps === 1;
  const travelled = round(room.max - room.min);
  console.log(
    `    ${laidOutOnce ? "ok  " : "FAIL"}  the pane holds one width while the room ` +
      `travels ${travelled}px` +
      (laidOutOnce ? "" : ` — it took ${pane.steps}, so the document re-wrapped`)
  );
  /* Both halves matter. One pane width means the document never re-wrapped;
     a room that travelled means there was an animation to re-wrap during. A
     pass on the first alone would also be what a snap looks like. */
  const moved = travelled > 50 && room.steps > 5;
  console.log(
    `    ${moved ? "ok  " : "FAIL"}  and it was an animation, not a snap: ` +
      `${room.steps} distinct widths across ${seen.length} frames`
  );
  return laidOutOnce && moved;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const framesDir = join(OUT, `.frames-artifact-${THEME}`);

  const browser = await chromium.launch({ args: [`--force-device-scale-factor=${SCALE}`] });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: THEME,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();

  await page.goto(`${BASE}/?showcase&theme=${THEME}`, { waitUntil: "networkidle" });
  await beat(page, 500);

  const capture = await startCapture(page, framesDir, VIEWPORT);

  await page.getByRole("button", { name: /start experience/i }).click();
  await beat(page, 900);

  // ── Ask for the thing that produces an artifact ────────────────────────
  await page.getByRole("button", { name: /plan for running a 5k/i }).click();
  const card = page.locator("button", { hasText: "5k training plan" }).first();
  await card.waitFor({ timeout: 20000 });
  await beat(page, 1400);

  console.log(`\n  the card, ${THEME}\n`);

  // ── At rest ───────────────────────────────────────────────────────────
  await page.mouse.move(60, VIEWPORT.height - 60);
  await beat(page, 500);
  const rest = await stateOf(page);
  console.log("    rest    ", JSON.stringify(rest));

  // ── Pointed at ────────────────────────────────────────────────────────
  const box = await card.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
  await beat(page, 500);
  const hover = await stateOf(page);
  console.log("    hover   ", JSON.stringify(hover));

  // ── Pressed ───────────────────────────────────────────────────────────
  await page.mouse.down();
  await beat(page, 260);
  const pressed = await stateOf(page);
  console.log("    pressed ", JSON.stringify(pressed));

  const moves = rest.lift === 0 && hover.lift < 0 && pressed.lift > 0;
  const surfaceHeld = rest.surface === hover.surface && hover.surface === pressed.surface;
  /* A lift is a shadow moving. Travel without it is a card sliding up the
     page rather than off it, which reads as a glitch. */
  const thrown = hover.throw > rest.throw && pressed.throw < rest.throw;
  console.log(
    `\n    ${moves ? "ok  " : "FAIL"}  it travels: rest ${rest.lift}, hover ${hover.lift}, pressed ${pressed.lift}`
  );
  console.log(
    `    ${thrown ? "ok  " : "FAIL"}  and the shadow goes with it: rest ${rest.throw}, hover ${hover.throw}, pressed ${pressed.throw}`
  );
  console.log(
    `    ${surfaceHeld ? "ok  " : "FAIL"}  the surface never changes: ${rest.surface} throughout`
  );

  // ── Open, and watch the room ──────────────────────────────────────────
  console.log(`\n  opening\n`);
  await watch(page);
  await page.mouse.up();
  await beat(page, 1200);
  const opening = report("open ", await samples(page));
  await page.mouse.move(60, VIEWPORT.height - 60, { steps: 20 });
  await beat(page, 900);

  const open = await stateOf(page);
  console.log(
    `\n    ${open.expanded === "true" ? "ok  " : "FAIL"}  the open card says so: ` +
      `aria-expanded=${open.expanded}, and draws nothing for it ` +
      `(lift ${open.lift}, surface ${open.surface})`
  );

  // ── Widened, then back ────────────────────────────────────────────────
  await page.getByRole("button", { name: /widen/i }).click();
  await beat(page, 1100);
  await page.getByRole("button", { name: /narrow/i }).click();
  await beat(page, 1100);

  // ── Closed ────────────────────────────────────────────────────────────
  console.log(`\n  closing\n`);
  await watch(page);
  await page.getByRole("button", { name: /^close$/i }).click();
  await beat(page, 1000);
  const closing = report("close", await samples(page));
  await beat(page, 700);

  await capture.stop();
  await browser.close();

  // ── Encode ────────────────────────────────────────────────────────────
  const frames = capture.frames;
  const bundled = bundledFfmpeg();
  const system = systemFfmpeg();
  await encode(frames, join(OUT, `artifact-${THEME}.webm`), bundled, VP8);
  if (system) await encode(frames, join(OUT, `artifact-${THEME}.mp4`), system, H264);
  await rm(framesDir, { recursive: true, force: true });

  const written = (await readdir(OUT)).filter((f) => f.startsWith(`artifact-${THEME}.`));
  console.log(`\n  ${frames.length} frames → ${written.join(", ")}\n`);

  const bad = !moves || !thrown || !surfaceHeld || !opening || !closing;
  process.exit(bad ? 1 : 0);
}

await main();
