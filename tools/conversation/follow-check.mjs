/**
 * Does the conversation keep up with an answer, and does a sent message still
 * go to the top?
 *
 *   npm run build && npm run follow-check
 *
 * Two things that pull in opposite directions, which is why they are checked
 * together. A sent message is scrolled to the **top** of the view, so the
 * question you just asked stays put while its answer is written under it. An
 * answer longer than the screen has to be followed at the **bottom**, or every
 * line after the first screenful is written where nobody can see it.
 *
 * `Conversation` takes the further of the two targets, which hands the view
 * from one to the other exactly when the turn outgrows the viewport. Neither
 * half is worth checking alone: pinning the top passes the first and fails the
 * second, following the bottom passes the second and fails the first.
 *
 * The bug this was written after was not in that logic at all. The demo had
 * `padding-bottom: 99vh` on the scroll container, and `box-sizing: border-box`
 * will not let a box be shorter than its own padding — so the scroller stood
 * 773px tall inside a 680px page, the extra 93px were clipped away by the
 * page, and the follow logic read `clientHeight` 773 and believed a line drawn
 * at 700 was on screen.
 */
import { browsers, serveStatic, skip } from "../harness.mjs";

const playwright = await browsers();
if (!playwright) skip("the follow check");
const { chromium } = playwright;

/* Against the build, like the other gate checks — not a dev server somebody
   remembered to start. */
const site = await serveStatic(
  new URL("../../apps/playground/dist", import.meta.url).pathname.replace(/%20/g, " "),
  4693
);
const BASE = site.url;
const beat = (p, ms) => p.waitForTimeout(ms);

const HEIGHT = Number(process.argv[2] ?? 680);
/** The demo's `anchorOffset`: the header sits over the top of the feed. */
const ANCHOR = 100;
/**
 * A single frame behind is a repaint, not a fault — the content grew and the
 * scroll caught it on the next one, 16ms later and 11px down. A run of them is
 * the thing a reader sees. Measured: the handover frame costs one, every other
 * frame of a 1400-frame answer costs none.
 */
const TRANSIENT = 2;

const QUESTIONS = [
  "How big is the Higgs boson?",
  "Write me a plan for running a 5k",
  "How big is the Higgs boson?",
];

let bad = 0;
const check = (ok, line) => {
  if (!ok) bad += 1;
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${line}`);
};

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1120, height: HEIGHT } })).newPage();
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await beat(page, 900);
await page.getByRole("button", { name: /start experience/i }).click();
await beat(page, 1500);

/**
 * The last turn **that has something in it**.
 *
 * `useChatTurns` always keeps an empty turn at the end — it is the composer,
 * waiting for the next message — and it is the last `[id^="turn-"]` in the
 * document. Measuring that instead of the answer is how the first version of
 * this reported 851 frames of 1467 below the fold: the empty row sits under
 * the fold by design, for ever, and nothing was ever wrong.
 */
const lastTurn = () =>
  page.evaluate(() => {
    const view = document.querySelector(".chatFeed");
    const answered = [...view.querySelectorAll("[id^='turn-']")].filter(
      (t) => t.textContent.trim().length > 0
    );
    const last = answered[answered.length - 1];
    if (!last) return null;
    const v = view.getBoundingClientRect();
    const r = last.getBoundingClientRect();
    return { fromTop: Math.round(r.top - v.top), below: Math.round(r.bottom - v.bottom) };
  });

const send = async (text) => {
  const editor = page.locator("[contenteditable]").last();
  await editor.click();
  await page.keyboard.type(text, { delay: 3 });
  await page.keyboard.press("Enter");
};

console.log(`\n  a ${HEIGHT}px window\n`);

for (const [i, q] of QUESTIONS.entries()) {
  await send(q);
  await beat(page, 500);
  const at = await lastTurn();
  check(
    Math.abs(at.fromTop - ANCHOR) <= 8,
    `message ${i + 1} lands ${at.fromTop}px from the top of the view, wanted ${ANCHOR}`
  );
  await beat(page, 9000);

  /* And when it settles, the composer is somewhere you can reach.
  
     In this kit the composer *is* the next turn — the input is the message —
     so an anchor that holds the question at the top leaves the thing you type
     into below the fold. The demo used to set the anchor on submit and never
     let go of it, so that was every answer, for the rest of the session: you
     could finish reading and have nowhere visible to type. */
  const rest = await page.evaluate(() => {
    const view = document.querySelector(".chatFeed");
    const editor = [...view.querySelectorAll("[contenteditable]")].pop();
    const row = editor.closest("[id^='turn-']") ?? editor;
    const v = view.getBoundingClientRect();
    const r = row.getBoundingClientRect();
    return { under: Math.round(v.bottom - r.bottom), top: Math.round(r.top - v.top), tall: Math.round(v.height) };
  });
  check(
    rest.under > 0 && rest.top > 0 && rest.top < rest.tall,
    `after answer ${i + 1} the composer is in view, ${rest.under}px clear of the bottom edge`
  );
}

// Now the conversation is long. Watch one more answer arrive.
//
// Sampled in a `ResizeObserver`, not in `requestAnimationFrame`, and the
// difference is the whole reading. The frame goes: rAF callbacks, then layout,
// then resize observers, then paint — so a rAF sampler reads the scroll
// *before* the component has been told the content grew, and reports a lag of
// exactly one frame on every frame where anything changed. That is what "19
// frames behind, worst 49px" was: not the scroll, the sampler standing in the
// wrong place in the frame. Observers fire in registration order, and this one
// is registered last, so it sees what the reader will.
await page.evaluate(() => {
  window.__seen = [];
  const view = document.querySelector(".chatFeed");
  const content = view.firstElementChild;
  const read = () => {
    const answered = [...view.querySelectorAll("[id^='turn-']")].filter(
      (t) => t.textContent.trim().length > 0
    );
    const last = answered[answered.length - 1];
    if (!last) return;
    window.__seen.push({
      top: Math.round(view.scrollTop),
      below: Math.round(
        last.offsetTop + last.offsetHeight - (view.scrollTop + view.clientHeight)
      ),
    });
  };
  window.__ro = new ResizeObserver(read);
  window.__ro.observe(content);
  read();
});

await send("How big is the Higgs boson?");
await beat(page, 12000);

const seen = await page.evaluate(() => {
  window.__ro.disconnect();
  return window.__seen;
});
const late = seen.filter((s) => s.below > 2);
const travelled = Math.max(...seen.map((s) => s.top)) - Math.min(...seen.map((s) => s.top));

check(travelled > 100, `the view followed the answer down, ${travelled}px across ${seen.length} growth steps`);
// Scattered single frames are repaints; a run of them is a lag a reader sees.
let run = 0, worstRun = 0;
for (const s of seen) { run = s.below > 2 ? run + 1 : 0; worstRun = Math.max(worstRun, run); }
console.log(`    (longest unbroken run behind: ${worstRun} frames)`);

check(
  worstRun <= TRANSIENT,
  `the newest line was behind on ${late.length} of ${seen.length} growth steps, ` +
    `longest run ${worstRun}` +
    (late.length ? `, worst ${Math.max(...late.map((s) => s.below))}px` : "")
);

/* ── The way back ──────────────────────────────────────────────────────────
   Scroll up to read something, then press the button that offers to take you
   back. It has to *travel*: `jump` asks for a smooth scroll and the effect
   that keeps up with an answer used to overwrite `scrollTop` in the same
   frame, which cancels one. Measured before the fix — 0 to 1088 inside 80ms,
   a teleport, and a reader loses their place with nothing to follow. */
/* With the wheel, not `scrollTo`. The component reads intent from the input on
   purpose — a programmatic scroll is not somebody choosing to leave, so it
   never raises the button, and a check that scrolls that way is testing
   nothing. */
await page.mouse.move(560, 400);
await page.mouse.wheel(0, -1400);
await beat(page, 900);
const button = page.getByRole("button", { name: /jump to the latest/i });
const shown = await button.count();
check(shown > 0, "the way-back button appears once you have scrolled away");
if (shown) {
  const at = () => page.evaluate(() => Math.round(document.querySelector(".chatFeed").scrollTop));
  await button.click();
  const path = [];
  for (let i = 0; i < 8; i++) {
    await beat(page, 70);
    path.push(await at());
  }
  const stops = new Set(path).size;
  check(stops >= 3, `and travels rather than teleporting: ${path.join(" → ")}`);
}

await browser.close();
site.close();
console.log(bad ? `\n  ${bad} wrong\n` : "\n  keeps up, and still takes a sent message to the top\n");
process.exit(bad ? 1 : 0);
