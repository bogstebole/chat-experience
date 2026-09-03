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

window.__visualQa = (tolerance) => [
  ...centring(tolerance),
  ...evenRow(tolerance),
  ...overflow(tolerance),
];
`;
