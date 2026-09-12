/**
 * Can a thumb reach what it came for, on a phone?
 *
 *   npm run build-storybook --workspace packages/inline-chat-kit && npm run reach-check
 *
 * A control that only appears on `:hover` does not exist on a phone. It is
 * drawn, it is in the accessibility tree, it passes every test that asks
 * whether it is *there* — and a finger cannot get at it, because there is
 * nothing to hover with. Nothing in a screenshot shows it either: the shot is
 * taken without a pointer, so the control is correctly invisible and the
 * picture looks right.
 *
 * The attachment's remove button was exactly that. It sat under a wash over
 * the whole square, revealed on hover, and on a phone you could attach a
 * picture and not take it back off.
 *
 * ## Why this runs against Storybook
 *
 * Because the demo only ever holds one attachment — its file input is not
 * `multiple` — and the question that needs asking is about two of them side
 * by side: these buttons grow an invisible 44px box under `pointer: coarse`,
 * and two of those 6px apart would have the wrong one answering. The states a
 * component can be in live in its stories; that is what stories are.
 */
import { fileURLToPath } from "node:url";
import { browsers, serveStatic, skip } from "../harness.mjs";

const playwright = await browsers();
if (!playwright) skip("the reach check");
const { webkit, chromium } = playwright;

const DIST = fileURLToPath(new URL("../../packages/inline-chat-kit/storybook-static", import.meta.url));
const site = await serveStatic(DIST, 4691);
const beat = (p, ms) => p.waitForTimeout(ms);

/** What a fingertip covers. Kept with `--ick-touch-target`. */
const TARGET = 44;

let bad = 0;
const check = (ok, line) => {
  if (!ok) bad += 1;
  console.log(`    ${ok ? "ok  " : "FAIL"}  ${line}`);
};

/**
 * Every attachment's remove button: whether it can be seen, and whether a
 * fingertip aimed at it hits it rather than the picture next door.
 */
const reach = (page, target) =>
  page.evaluate((TARGET) => {
    const items = [...document.querySelectorAll("li")].filter((li) => li.hasAttribute("data-picture"));
    return items.map((item, i) => {
      const btn = item.querySelector("button");
      if (!btn) return { i, missing: true };
      const wrap = btn.closest("span");
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const half = TARGET / 2;
      /* The edges of the invisible box, not the button. A button that grows a
         hit area it does not draw is a button whose real size nothing on
         screen shows — which is the whole reason this is measured and not
         looked at. */
      const strays = [
        ["above", cx, cy - half + 1],
        ["below", cx, cy + half - 1],
        ["left", cx - half + 1, cy],
        ["right", cx + half - 1, cy],
      ]
        .map(([where, x, y]) => {
          const owner = document.elementFromPoint(x, y)?.closest("li");
          return owner && owner !== item ? `${where} lands on attachment ${items.indexOf(owner) + 1}` : null;
        })
        .filter(Boolean);
      const hit = document.elementFromPoint(cx, cy);
      return {
        i,
        shown: Number(getComputedStyle(wrap).opacity) > 0.9,
        size: `${Math.round(r.width)}×${Math.round(r.height)}`,
        inside: r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0,
        reachable: hit === btn || btn.contains(hit),
        strays,
      };
    });
  }, target);

for (const [name, engine, touch] of [
  ["webkit touch", webkit, true],
  ["chromium touch", chromium, true],
  ["chromium mouse", chromium, false],
]) {
  const b = await engine.launch();
  const page = await (
    await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: touch, isMobile: touch })
  ).newPage();
  await page.goto(`${site.url}/iframe.html?id=components-attachments--being-assembled&viewMode=story`, {
    waitUntil: "networkidle",
  });
  await beat(page, 800);
  console.log(`  ${name}`);

  /* Without this the run could pass by never applying the rule at all — the
     media query is the thing under test, so the engine has to agree it is in
     the state the query asks about. */
  const hoverless = await page.evaluate(() => matchMedia("(hover: none)").matches);
  check(hoverless === touch, `the engine reports hover is ${hoverless ? "unavailable" : "available"}`);

  const seen = await reach(page, TARGET);
  check(seen.length >= 2, `${seen.length} pictures attached, each with a way to take it back off`);

  if (touch) {
    const hidden = seen.filter((f) => f.missing || !f.shown);
    check(
      hidden.length === 0,
      hidden.length
        ? `but ${hidden.length} of them can only be reached by hovering, which a phone cannot do`
        : `and every remove button is visible without hovering (${seen[0]?.size})`
    );
    const unreachable = seen.filter((f) => !f.missing && !f.reachable);
    check(
      unreachable.length === 0,
      unreachable.length
        ? `and ${unreachable.length} cannot be pressed — something is over them`
        : `and a press at the middle of each one lands on it`
    );
    const crossed = seen.flatMap((f) => (f.strays ?? []).map((s) => `${f.i + 1}: ${s}`));
    check(
      crossed.length === 0,
      crossed.length
        ? `and their 44px areas reach into each other — ${crossed.join("; ")}`
        : `and no 44px area reaches into the attachment next to it`
    );
  } else {
    /* The other direction. On a pointer the button is meant to stay out of
       the way until it is wanted — the wash over the square is a good answer
       there, and this rule is not supposed to have changed the desktop. */
    check(
      seen.every((f) => !f.missing && !f.shown),
      `and on a pointer they stay hidden until the picture is hovered`
    );
  }

  /* ── The reply thread ────────────────────────────────────────────────
     A panel that hangs off a phrase has to hang somewhere, and a phone has
     nowhere: measured in the demo at 390×844 with a passage 556px down, it
     ended at 920 after one reply — 76px past the bottom edge, with every
     message after it pushing more out of reach. It is a sheet here now, up
     from the bottom, and the only assertions that matter are that it stays
     on the screen and that what you came for is on it. */
  const thread = await b.newContext({
    viewport: { width: touch ? 390 : 1280, height: 844 },
    hasTouch: touch,
    isMobile: touch,
  });
  const panel = await thread.newPage();
  await panel.goto(`${site.url}/iframe.html?id=components-replythreadpopup--open&viewMode=story`, {
    waitUntil: "networkidle",
  });
  await beat(panel, 900);

  const laid = await panel.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const r = dialog.getBoundingClientRect();
    const on = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom) };
    };
    return {
      sheet: dialog.hasAttribute("data-sheet"),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      screen: window.innerHeight,
      below: Math.round(r.bottom - window.innerHeight),
      close: on(dialog.querySelector('[aria-label="Close thread"]')),
      editor: on(dialog.querySelector("[contenteditable]")),
    };
  });

  if (!laid) {
    console.log("    ??    the thread story drew no dialog — nothing measured");
  } else if (touch) {
    check(laid.sheet, `the thread comes up from the bottom rather than hanging off the phrase`);
    check(
      laid.below <= 0 && laid.bottom >= laid.screen - 1,
      `and it rests on the bottom edge: ${laid.bottom}px in a ${laid.screen}px screen`
    );
    const reachable = (box) => box && box.top >= 0 && box.bottom <= laid.screen;
    check(
      reachable(laid.close),
      `the way out is on the screen — ${laid.close ? `${laid.close.top}–${laid.close.bottom}px` : "no close button found"}`
    );
    check(
      reachable(laid.editor),
      `and so is the place to type — ${laid.editor ? `${laid.editor.top}–${laid.editor.bottom}px` : "no input found"}`
    );
  } else {
    /* The other direction: beside the phrase is the right answer where there
       is room, and this rule is not supposed to have taken that away. */
    check(!laid.sheet, `and on a wide screen it still hangs off the phrase rather than the bottom`);
    check(laid.below <= 0, `with nothing below the fold: ${laid.below}px past the bottom edge`);
  }
  await thread.close();

  await b.close();
}
site.close();
console.log(bad ? `\n  ${bad} wrong\n` : "\n  everything can be reached\n");
process.exit(bad ? 1 : 0);
