/**
 * The rules, as source to be injected into a page.
 *
 * Each one returns a list of violations. They are written as a single string
 * because they run inside the browser: the numbers that matter — where a box
 * actually sits, what colour was actually painted — do not exist out here.
 *
 * **Two things every rule in this file obeys**, both learned the hard way:
 *
 * 1. *Only fire where the intent was declared.* A rule that guesses what
 *    should be centred reports a hundred things nobody asked to centre. Every
 *    rule below reads the author's own CSS first and checks whether the
 *    geometry agrees with it. That is why the list is short and why an entry
 *    in it is worth reading.
 *
 * 2. *Name both terms of every measurement.* The readings that wasted the most
 *    time this month were the ones where "the ink" turned out to be the
 *    background. Every violation says what it compared against what, with the
 *    numbers, so it can be argued with.
 */

export const RULES_SOURCE = `
const round = (n) => Math.round(n * 100) / 100;
const named = (el) => {
  const id = el.id ? "#" + el.id : "";
  const cls = String(el.className || "").split(" ").filter(Boolean)[0];
  return el.tagName.toLowerCase() + id + (cls ? "." + cls : "");
};

/** Everything laid out, ignoring what is deliberately not shown. */
const laidOut = () =>
  [...document.querySelectorAll("body *")].filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  });

/**
 * A box that says it centres its content should centre it.
 *
 * Read off the author's own declaration — \`align-items: center\` means the
 * cross axis, \`justify-content: center\` the main one — so this can only fire
 * where somebody already asked for the thing it is checking. The usual cause
 * is a stray margin or an odd number of pixels split between two even gaps.
 */
function centring(tolerance) {
  const out = [];
  for (const el of laidOut()) {
    const cs = getComputedStyle(el);
    if (cs.display !== "flex" && cs.display !== "inline-flex") continue;
    const kids = [...el.children].filter((k) => {
      const r = k.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(k).position !== "absolute";
    });
    if (kids.length !== 1) continue;

    const box = el.getBoundingClientRect();
    const kid = kids[0].getBoundingClientRect();
    const pad = {
      top: parseFloat(cs.paddingTop), bottom: parseFloat(cs.paddingBottom),
      left: parseFloat(cs.paddingLeft), right: parseFloat(cs.paddingRight),
    };
    const row = cs.flexDirection.startsWith("row");

    // The axis each declaration governs depends on the direction.
    const crossCentred = cs.alignItems === "center";
    const mainCentred = cs.justifyContent === "center";
    const checkVertical = row ? crossCentred : mainCentred;
    const checkHorizontal = row ? mainCentred : crossCentred;

    if (checkVertical) {
      const above = kid.top - (box.top + pad.top);
      const below = box.bottom - pad.bottom - kid.bottom;
      if (Math.abs(above - below) > tolerance) {
        out.push({
          rule: "centring",
          element: named(el),
          detail: \`says \${row ? "align-items" : "justify-content"}: center, but its one child sits \${round(above)}px from the top and \${round(below)}px from the bottom of the content box\`,
        });
      }
    }
    if (checkHorizontal) {
      const before = kid.left - (box.left + pad.left);
      const after = box.right - pad.right - kid.right;
      if (Math.abs(before - after) > tolerance) {
        out.push({
          rule: "centring",
          element: named(el),
          detail: \`says \${row ? "justify-content" : "align-items"}: center, but its one child sits \${round(before)}px from the left and \${round(after)}px from the right of the content box\`,
        });
      }
    }
  }
  return out;
}

/**
 * Controls sitting in a row are the same size as each other.
 *
 * This is the one that would have caught a segmented toggle drawing its icons
 * at 15 while the three buttons beside it drew theirs at 16 — a pixel, and
 * visible, because they sit in a line.
 *
 * Only rows of **icon-only** buttons. A row that mixes a labelled button with
 * an icon one legitimately varies — the themes story puts a small, a medium
 * and an icon button side by side on purpose, and the first version of this
 * rule reported that four times. A row of nothing but icons is a toolbar, and
 * a toolbar with two sizes in it is a mistake.
 *
 * Heights and icon sizes only. Widths differ for good reasons even here.
 */
function evenRow(tolerance) {
  const out = [];
  for (const el of laidOut()) {
    const cs = getComputedStyle(el);
    if (cs.display !== "flex" && cs.display !== "inline-flex") continue;
    if (!cs.flexDirection.startsWith("row")) continue;

    const kids = [...el.children].filter((k) => k.tagName === "BUTTON" && k.getBoundingClientRect().height > 0);
    if (kids.length < 2) continue;
    // Icon-only: it draws an svg and has no text of its own.
    const buttons = kids.filter((b) => b.querySelector("svg") && !b.textContent.trim());
    if (buttons.length !== kids.length || buttons.length < 2) continue;

    const heights = buttons.map((b) => b.getBoundingClientRect().height);
    const min = Math.min(...heights), max = Math.max(...heights);
    if (max - min > tolerance) {
      out.push({
        rule: "even-row",
        element: named(el),
        detail: \`\${buttons.length} buttons in a row are \${heights.map(round).join(", ")}px tall\`,
      });
    }

    const icons = buttons.flatMap((b) => [...b.querySelectorAll("svg")]).map((s) => s.getBoundingClientRect());
    if (icons.length >= 2) {
      const sizes = icons.map((r) => round(r.width));
      if (Math.max(...sizes) - Math.min(...sizes) > tolerance) {
        out.push({
          rule: "even-row",
          element: named(el),
          detail: \`icons in the same row measure \${[...new Set(sizes)].join(", ")}px across\`,
        });
      }
    }
  }
  return out;
}

/**
 * Nothing sticks out of the box that clips it.
 *
 * Only boxes that actually clip — \`overflow: hidden\` or \`clip\` — because an
 * element leaving a visible container is often the point (a shadow, a badge on
 * a corner). Leaving a clipping one means it has been cut off.
 */
function overflow(tolerance) {
  const out = [];
  for (const el of laidOut()) {
    const cs = getComputedStyle(el);
    const clipsX = cs.overflowX === "hidden" || cs.overflowX === "clip";
    const clipsY = cs.overflowY === "hidden" || cs.overflowY === "clip";
    if (!clipsX && !clipsY) continue;
    const box = el.getBoundingClientRect();
    for (const kid of el.children) {
      const cks = getComputedStyle(kid);
      if (cks.position === "absolute" || cks.position === "fixed") continue;
      const r = kid.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const over = [];
      if (clipsX && r.right - box.right > tolerance) over.push(\`\${round(r.right - box.right)}px past the right\`);
      if (clipsX && box.left - r.left > tolerance) over.push(\`\${round(box.left - r.left)}px past the left\`);
      if (clipsY && r.bottom - box.bottom > tolerance) over.push(\`\${round(r.bottom - box.bottom)}px past the bottom\`);
      if (over.length) {
        out.push({ rule: "overflow", element: named(el), detail: \`\${named(kid)} runs \${over.join(" and ")} of a box that clips\` });
      }
    }
  }
  return out;
}

/**
 * Nothing is wider than the screen.
 *
 * The one mobile fault a reader cannot work around: a page that scrolls
 * sideways puts half of itself where a thumb has to go looking for it. Reported
 * against the **viewport**, not the parent, because that is what a phone has —
 * and only for boxes that are not themselves scrollers, since a code block or a
 * table that scrolls inside itself is the fix rather than the fault.
 *
 * **Only the outermost one in a subtree.** A box that is too wide makes every
 * one of its descendants too wide, and reporting all of them buries the cause
 * under its own consequences: the first cut found 30 things in one story that
 * were all the same harness laid out at 500px on purpose. The element nearest
 * the root is the one somebody can act on, and one line per cause is short
 * enough that a deliberately wide story reads as a single dismissible note
 * rather than a wall.
 */
function pageOverflow(tolerance) {
  const out = [];
  const wide = document.documentElement.clientWidth;
  const over = (el) => {
    const r = el.getBoundingClientRect();
    return Math.max(r.right - wide, -r.left);
  };
  for (const el of laidOut()) {
    const cs = getComputedStyle(el);
    if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
    // A scroller's children are allowed past its edge; that is the scrolling.
    // And an ancestor already over the edge is the cause of this one.
    let covered = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const px = getComputedStyle(p).overflowX;
      if (px === "auto" || px === "scroll" || px === "hidden" || px === "clip") { covered = true; break; }
      if (over(p) > tolerance) { covered = true; break; }
    }
    if (covered) continue;
    const past = over(el);
    if (past > tolerance) {
      out.push({
        rule: "off-screen",
        element: named(el),
        detail: \`runs \${round(past)}px past a \${wide}px screen — the page scrolls sideways\`,
      });
    }
  }
  return out;
}

/**
 * Anything you press is big enough to press with a thumb.
 *
 * 44px, which is Apple's number and WCAG 2.5.5's AAA. The kit's controls are
 * 22 to 32, which is right for a pointer and wrong for a finger.
 *
 * **Asked of the browser, not of the box.** The first cut compared
 * \`getBoundingClientRect()\` against 44 and would have gone on reporting all
 * 165 controls after they were fixed — because the fix does not change the
 * box. It hangs an invisible \`::after\` off the control, so the thing that
 * grew is the hit area, and the only way to read a hit area is to ask what is
 * under a point. \`elementFromPoint\` at the four edges of the 44px box, and a
 * pseudo-element answers as the element it belongs to.
 *
 * Which also makes it honest in the other direction: a control whose expander
 * is covered by something painted over it fails here, and should.
 */
function tapTarget() {
  const MIN = 44;
  const reach = MIN / 2 - 1;
  const out = [];
  const seen = new Set();
  for (const el of laidOut()) {
    const tag = el.tagName;
    const role = el.getAttribute("role");
    const pressable =
      tag === "BUTTON" || tag === "A" || tag === "SUMMARY" ||
      (tag === "INPUT" && !["hidden", "text", "email", "password", "search"].includes(el.type)) ||
      role === "button" || role === "menuitem" || role === "tab" || role === "switch";
    if (!pressable || el.disabled) continue;
    // A control inside another control is one target, not two.
    if (el.parentElement?.closest("button, a, [role='button']")) continue;

    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const sides = [
      ["left", cx - reach, cy],
      ["right", cx + reach, cy],
      ["top", cx, cy - reach],
      ["bottom", cx, cy + reach],
    ];
    const missed = [];
    for (const [side, x, y] of sides) {
      // Off the screen is the off-screen rule's business, not this one's.
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(hit === el || el.contains(hit))) missed.push(side);
    }
    if (!missed.length) continue;

    const key = named(el) + missed.join();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rule: "tap-target",
      element: named(el),
      detail:
        \`\${round(r.width)}\u00d7\${round(r.height)}px, and a press \${reach}px \` +
        \`to the \${missed.join(" or ")} does not reach it — a thumb needs \${MIN}px\`,
    });
  }
  return out;
}

/**
 * No two hit areas land on top of each other.
 *
 * The other half of the 44px rule, and the half nobody sees. Growing a
 * control's hit area without growing the control makes the target invisible —
 * so two 28px buttons 4px apart, each reaching 8px further on every side, end
 * up with boxes that overlap by 12px, and a press in that strip goes to
 * whichever is painted later. It looks perfect in a screenshot.
 *
 * Measured off the boxes the browser actually hit-tests, \`::after\` included,
 * rather than off the buttons. Only pairs that both grew: two controls whose
 * own boxes touch are the author's decision and none of this rule's business.
 */
function tapOverlap(tolerance) {
  const MIN = 44;
  const out = [];
  const seen = new Set();
  const boxes = [];
  for (const el of laidOut()) {
    const tag = el.tagName;
    const role = el.getAttribute("role");
    const pressable =
      tag === "BUTTON" || tag === "A" || tag === "SUMMARY" ||
      role === "button" || role === "menuitem" || role === "tab" || role === "switch";
    if (!pressable || el.disabled) continue;
    if (el.parentElement?.closest("button, a, [role='button']")) continue;
    const own = el.getBoundingClientRect();
    // What it actually catches: its own box, union the grown one.
    const grown = {
      left: own.left + own.width / 2 - Math.max(own.width, MIN) / 2,
      right: own.left + own.width / 2 + Math.max(own.width, MIN) / 2,
      top: own.top + own.height / 2 - Math.max(own.height, MIN) / 2,
      bottom: own.top + own.height / 2 + Math.max(own.height, MIN) / 2,
    };
    boxes.push({ el, own, grown, grew: own.width < MIN || own.height < MIN });
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (!a.grew && !b.grew) continue;
      const x = Math.min(a.grown.right, b.grown.right) - Math.max(a.grown.left, b.grown.left);
      const y = Math.min(a.grown.bottom, b.grown.bottom) - Math.max(a.grown.top, b.grown.top);
      if (x <= tolerance || y <= tolerance) continue;
      // Already touching before either grew: the author's arrangement.
      const ox = Math.min(a.own.right, b.own.right) - Math.max(a.own.left, b.own.left);
      const oy = Math.min(a.own.bottom, b.own.bottom) - Math.max(a.own.top, b.own.top);
      if (ox > 0 && oy > 0) continue;
      const key = named(a.el) + "|" + named(b.el);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        rule: "tap-overlap",
        element: named(a.el),
        detail:
          \`its hit area overlaps \${named(b.el)}'s by \${round(x)}\u00d7\${round(y)}px — \` +
          \`the two are \${round(Math.max(0, -ox))}px apart and each reaches \` +
          \`\${MIN}px, so a press between them is a coin toss\`,
      });
    }
  }
  return out;
}

window.__visualQa = (tolerance, options) => {
  const phone = options && options.phone;
  return [
    ...centring(tolerance),
    ...evenRow(tolerance),
    ...overflow(tolerance),
    // Only on a phone. A 28px icon button in a desktop toolbar is correct, and
    // a rule that reported it everywhere would be turned off within a week.
    ...(phone ? pageOverflow(tolerance) : []),
    ...(phone ? tapTarget() : []),
    ...(phone ? tapOverlap(tolerance) : []),
  ];
};
`;
