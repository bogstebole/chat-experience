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
/**
 * The demo's `anchorOffset`, read off the page rather than restated here.
 *
 * It used to be a `100` written in this file next to a `100` in the demo, and
 * two copies of a number are one copy of a number and one thing that will
 * disagree with it. The demo sets its `anchorOffset` to match the feed's own
 * `padding-top`, so the page can be asked.
 */
let ANCHOR = 100;
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
/** Where each answer left the composer, so they can be compared. */
const restingPlaces = [];
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

ANCHOR = await page.evaluate(() =>
  Math.round(parseFloat(getComputedStyle(document.querySelector(".chatFeed")).paddingTop))
);
console.log(`  the feed holds an anchored turn ${ANCHOR}px down\n`);

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
  restingPlaces.push(rest.under);

  /* And there is nowhere further to go.
  
     This is the assertion that was missing when the room under the last turn
     was first measured, and it is the one that says the room is *spent*
     rather than left over. The room exists to lift a turn to the top; sized
     right, the end of the scroll is exactly where that turn sits at the
     anchor, so coming to rest and running out of scroll are the same place.
     Any gap between them is somewhere a reader can scroll with nothing in it
     — 536px of it after every answer, when the measurement took the last
     turn's own height instead of everything under the anchor. */
  const spare = await page.evaluate(() => {
    const view = document.querySelector(".chatFeed");
    return Math.round(view.scrollHeight - view.clientHeight - view.scrollTop);
  });
  check(
    spare <= 8,
    `and answer ${i + 1} leaves nowhere further to scroll: ${spare}px of room under the view`
  );
}

/* Every answer has to leave the reader in the *same* place.
  
   "In view" alone is not enough, and this is the assertion that was missing
   when the first version of the press rule regressed: releasing the follow on
   any press meant a click into the composer released it too, so when an answer
   settled there was nothing to bring the view back — and settling is also when
   the reasoning block folds itself away, so the content shrank by its height
   and everything above dropped into view. The composer stayed visible, 304px
   clear instead of 124, and the check said ok. Where an answer leaves you must
   not depend on which answer it was. */
const spread = Math.max(...restingPlaces) - Math.min(...restingPlaces);
check(
  spread <= 4,
  `and always in the same place: ${restingPlaces.join(", ")}px clear, a spread of ${spread}`
);

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

/* ── Opening something ─────────────────────────────────────────────────────
   Everything that folds open grows the content, and growth is what makes the
   view keep up — so opening a panel while sitting at the end used to pin the
   *end* and drag the thing just opened up and off the top. Measured before the
   fix: `scrollTop` 29 to 131 and the header from 160px down the view to 58,
   which reads as a panel opening upwards, with the control to shut it going
   with it. What it has to do is stay exactly where it was pressed. */
const headerAt = () =>
  page.evaluate(() => {
    const view = document.querySelector(".chatFeed");
    const h = [...document.querySelectorAll("[aria-expanded]")].find((x) =>
      x.textContent.includes("Thought")
    );
    if (!h) return null;
    return Math.round(h.getBoundingClientRect().top - view.getBoundingClientRect().top);
  });

const fold = page.getByRole("button", { name: /Thought for/i }).first();
if (await fold.count()) {
  /* Into view first. Playwright scrolls an off-screen element before clicking
     it, so measuring "before" without this measures a header 1696px above the
     viewport and then calls the scroll that revealed it a fault. */
  await fold.scrollIntoViewIfNeeded();
  await beat(page, 700);
  const before = await headerAt();
  await fold.click();
  await beat(page, 900);
  const after = await headerAt();
  check(
    before !== null && after !== null && Math.abs(after - before) <= 4,
    `a panel opens where it was pressed: its header sat at ${before}px and now sits at ${after}px`
  );
}

/* ── The end of the scroll ─────────────────────────────────────────────────
   How far past the conversation a reader can go, which is the other half of
   holding a turn at the top: a turn can only be brought to the top if there is
   room under it to scroll into, and that room used to be a flat `99vh` in the
   demo's stylesheet. Measured before this: 697px of blank in a 680px view,
   with the last turn above the top edge — a completely empty screen at the
   bottom of every conversation.

   `Conversation` measures the room now, so the end of the scroll is exactly
   where the last turn sits at the anchor. Which is what this asserts: scroll
   as far as it goes and the last turn is *there*, not gone. */
const bottomOut = await page.evaluate(() => {
  const view = document.querySelector(".chatFeed");
  view.scrollTop = view.scrollHeight;
  const inner = view.firstElementChild;
  const last = inner.lastElementChild;
  const v = view.getBoundingClientRect();
  const r = last.getBoundingClientRect();
  return {
    fromTop: Math.round(r.top - v.top),
    blankBelow: Math.round(v.bottom - r.bottom),
    height: Math.round(v.height),
  };
});
/* Measured against where the view already rests, not against a number typed
   in here. Sized right the two are the same place, so scrolling as far as it
   will go shows what resting shows — the last turn, with the end gap under
   it. Before, the same drag ended 61px above the top edge on a blank page. */
const restingGap = restingPlaces[restingPlaces.length - 1];
check(
  bottomOut.fromTop >= 0 && bottomOut.fromTop + 8 < bottomOut.height,
  `scrolled as far as it goes, the last turn is still on screen — ` +
    `${bottomOut.fromTop}px from the top of a ${bottomOut.height}px view`
);
check(
  bottomOut.blankBelow <= restingGap + 8,
  `and what is under it is the end gap, not a screenful: ` +
    `${bottomOut.blankBelow}px, and the view rests at ${restingGap}px`
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
