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
/** Where each answer left the composer, reported rather than compared. */
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

  /* And the message you sent is still at the top when the answer is done.
  
     This is the assertion that matters, and it replaces one that compared
     where each answer left the *composer*. That comparison held only while
     every answer was longer than the screen — which is all this check ever
     sent — because there the room falls to its floor and the composer always
     lands the same distance from the bottom. Give the window room and the
     answers come out shorter than it: the composer then sits directly under
     whatever the answer turned out to be, so its distance from the bottom is
     supposed to vary, and a spread of 43px read as a fault while a real one
     of 551px went unnoticed for a different reason.
  
     Where the *turn* ends up is the thing that must not vary. It fits on the
     screen, it is at the anchor; it does not, it has scrolled past the anchor
     and the end of the answer is what you are looking at. */
  const settled = await page.evaluate(() => {
    const view = document.querySelector(".chatFeed");
    const answered = [...view.querySelectorAll("[id^='turn-']")].filter(
      (t) => t.textContent.trim().length > 0
    );
    const last = answered[answered.length - 1];
    const v = view.getBoundingClientRect();
    const r = last.getBoundingClientRect();
    return {
      fromTop: Math.round(r.top - v.top),
      turn: Math.round(r.height),
      view: Math.round(v.height),
    };
  });
  /* One rule, stated without repeating the component's arithmetic: the turn
     never comes to rest **below** the anchor. It is at the anchor, or the
     view has gone past it because the turn and the composer under it together
     outgrew the screen. What is not allowed is what the report showed — the
     message you sent sitting in the middle of the view with room unspent
     beneath it.
  
     A first attempt did repeat the arithmetic, predicating on the turn's own
     height, and got it wrong: a 494px turn fits a 680px view and still cannot
     be held at the anchor, because the composer comes after it. Which is the
     same mistake as the one being fixed, in the check instead of the code. */
  const past = settled.fromTop < ANCHOR - 4;
  check(
    settled.fromTop <= ANCHOR + 4,
    `and turn ${i + 1} rests ${past ? "past" : "at"} the anchor — ${settled.fromTop}px, ` +
      `never below ${ANCHOR} (${settled.turn}px of turn in a ${settled.view}px view)`
  );

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

console.log(`    (the composer came to rest ${restingPlaces.join(", ")}px clear of the bottom)`);

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

/* ── While the answer is written ───────────────────────────────────────────
   The anchored message must not move at all.

   Every check here until now measured *transitions* — where a message lands,
   where the view comes to rest, whether it travelled. None of them watched
   the long quiet stretch in between, and that is where the fault lived: the
   message sat at the anchor and flipped a pixel up and down for the whole
   length of every answer after the first. Reported three times, "fixed"
   twice, because the measurements were of the wrong moment and each one was
   true.

   It was a feedback loop. The room under the conversation is part of
   `scrollHeight`, `target` clamps to `scrollHeight`, and the room was
   recomputed from measurements on every frame — so the room moved the view,
   the view moved the measurements, and the measurements moved the room.
   Sized to be exactly enough, the clamp sat on a knife edge and a fraction of
   a pixel chose the side. Measured before: the message sat at 100, flipped to
   101 and back thirty-one times, with the room going 418, 379, 374, 372, 362,
   360, 351 underneath it. After: it decelerates into the anchor and then does
   not move again for the rest of the answer — 473 frames at 680px, 466 at
   1400px, not one of them a pixel off. */
await page.evaluate(() => {
  window.__still = [];
  const view = document.querySelector(".chatFeed");
  const tick = () => {
    const answered = [...view.querySelectorAll("[id^='turn-']")].filter(
      (t) => t.textContent.trim().length > 0
    );
    const last = answered[answered.length - 1];
    if (last) {
      const box = last.getBoundingClientRect();
      window.__still.push({
        y: Math.round(box.top - view.getBoundingClientRect().top),
        /* The turn says so itself: `aria-busy` is on it for screen readers
           while the answer is arriving. So the window measured below is the
           one the assertion names. Inferring it from the turn's height
           instead — while it grows, the answer is arriving — ran past the
           end: a finished turn still changes height as the streaming caret
           goes and the actions appear, and those frames dragged the window
           over the settle. */
        writing: last.getAttribute("aria-busy") === "true",
      });
    }
    window.__raf2 = requestAnimationFrame(tick);
  };
  window.__raf2 = requestAnimationFrame(tick);
});
await send("What does particle physics actually study?");
await beat(page, 11000);
const still = await page.evaluate(() => {
  cancelAnimationFrame(window.__raf2);
  return window.__still;
});
/* The stretch where the answer is being written, and nothing either side:
   the journey to the anchor is before it and the settle is after it, and both
   are supposed to move. Contiguous, because "every frame where it was
   writing" would staple two answers together across the gap between them. */
let streak = [];
let writing = [];
for (const frame of still) {
  if (frame.writing) streak.push(frame.y);
  else {
    if (streak.length > writing.length) writing = streak;
    streak = [];
  }
}
if (streak.length > writing.length) writing = streak;

/* Jitter is not motion. It is motion that **changes its mind**.
  
   That distinction is the whole of this check, and getting it wrong is what
   made the first version of it lie. It took every frame within a few pixels
   of the anchor and counted each change of position — which caught the last
   five frames of the deceleration, 106, 105, 103, 102, 101, and reported the
   arrival as the fault. The arrival is required to move; the check above it
   asserts exactly that. A reversal is not required by anything.
  
   Measured on the fault this was written for: the message flipped between 100
   and 101 for the length of every answer after the first — thirty-one
   reversals. Measured after: none, at either height. */
let reversals = 0;
let heading = 0;
for (let i = 1; i < writing.length; i++) {
  const step = Math.sign(writing[i] - writing[i - 1]);
  if (step && heading && step !== heading) reversals++;
  if (step) heading = step;
}

/* Reversals alone would let a slow creep through, since a creep never turns
   around. By halfway through an answer the message has long since arrived, so
   the back half has to be a single number — and that number has to be the
   anchor, or it is holding still somewhere it does not belong. */
const settledHalf = writing.slice(Math.floor(writing.length / 2));
const spread = settledHalf.length
  ? Math.max(...settledHalf) - Math.min(...settledHalf)
  : Infinity;
const restsAt = settledHalf[settledHalf.length - 1] ?? -1;

check(
  writing.length > 200 &&
    reversals === 0 &&
    spread === 0 &&
    Math.abs(restsAt - ANCHOR) <= 4,
  `the anchored message holds still while its answer is written: ` +
    `${reversals} reversals over ${writing.length} frames, ` +
    `and the back half sits at ${restsAt}px within ${spread}px`
);

/* ── Reading back through it ───────────────────────────────────────────────
   Scrolling up must not be a fight.

   Since the room under the last turn became measured, the view comes to rest
   exactly at the end of the scroll — so every upward scroll starts inside
   whatever band counts as "back at the end". With that band at the release
   threshold, the scroll event re-acquired a reader who was still on their way
   out and put them back at the bottom: measured at rest, wheeling up 20, 40
   and 63 pixels all ended at the bottom again, and 80 was free. Sixty-four
   pixels of fighting and then it let go all at once. */
const held = await page.evaluate(async () => {
  const view = document.querySelector(".chatFeed");
  const max = view.scrollHeight - view.clientHeight;
  const settle = () => new Promise((r) => setTimeout(r, 300));
  const out = [];
  for (const back of [20, 40, 63, 120]) {
    view.scrollTop = max;
    await settle();
    /* A real wheel: that is what tells the component the reader left. A
       programmatic scroll alone never releases it, so a check that only moved
       `scrollTop` would pass against the fault. */
    view.dispatchEvent(new WheelEvent("wheel", { deltaY: -back, bubbles: true, cancelable: true }));
    view.scrollTop = max - back;
    await settle();
    out.push({ back, wanted: max - back, at: Math.round(view.scrollTop) });
  }
  view.scrollTop = max;
  return out;
});
const dragged = held.filter((h) => Math.abs(h.at - h.wanted) > 4);
check(
  dragged.length === 0,
  dragged.length
    ? `scrolling up is fought: ` +
      dragged.map((h) => `${h.back}px up ended at ${h.at} not ${h.wanted}`).join(", ")
    : `scrolling up stays where it is put — ` +
      held.map((h) => `${h.back}→${h.at}`).join(", ")
);
await beat(page, 400);

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

/* ── Sending one is a journey, not a cut ───────────────────────────────────
   A sent message goes to the top, and it has to *travel* there. Sending adds
   a whole turn at once, so the content grows by its height in a single frame,
   and the scroll used to be assigned the new position in that same frame.
   Traced at 1120×680 across two answers: three moves over 24px in the whole
   session, every one of them a single frame — 154px, 416px, 172px. The 416
   was the send. That is what "too sharp" was; the reasoning folding away at
   the end was already gradual and cost nothing.

   Growth is still instant on purpose and is not what this measures: easing
   the arrival of text would mean the line being read slides for a third of a
   second. Only the deliberate move is eased. */
await page.evaluate(() => {
  window.__path = [];
  const view = document.querySelector(".chatFeed");
  const tick = () => {
    window.__path.push({ t: Math.round(performance.now()), top: Math.round(view.scrollTop) });
    window.__raf = requestAnimationFrame(tick);
  };
  window.__raf = requestAnimationFrame(tick);
});
await send("How big is the Higgs boson?");
await beat(page, 420);
const path = await page.evaluate(() => {
  cancelAnimationFrame(window.__raf);
  return window.__path;
});
const stops = new Set(path.map((p) => p.top)).size;
/* How long the move took, not how big any one step was.
  
   A per-frame bound measures the machine, not the motion: inside `npm run
   verify` this check runs after several browsers have had their turn, frames
   drop, and two consecutive samples land further apart in time — so a smooth
   scroll reported a 680px "step" once and 43px on the three runs after it. A
   dropped frame is not a jump. Time cannot be dropped. */
const moving = path.filter((p, i) => i && p.top !== path[i - 1].top);
const spanMs = moving.length ? moving[moving.length - 1].t - moving[0].t : 0;
check(
  stops >= 4 && spanMs >= 120,
  `a sent message travels to the top rather than cutting to it: ` +
    `${stops} distinct positions over ${spanMs}ms`
);
await beat(page, 9000);

await browser.close();
site.close();
console.log(bad ? `\n  ${bad} wrong\n` : "\n  keeps up, and still takes a sent message to the top\n");
process.exit(bad ? 1 : 0);
