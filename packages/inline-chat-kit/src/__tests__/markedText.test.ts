import { describe, it, expect } from "vitest";

/**
 * What a word may animate, and what it may not.
 *
 * A token declared a 320ms transition on `color` while setting no colour of
 * its own, so it was animating whatever the page had inherited to it. On a
 * theme swap the ink inverts and that travel passes straight through the
 * background: every word of every answer vanished for nine frames. Measured
 * off the showcase recording at 11.96% ink coverage the frame before the swap,
 * 3.56% the frame after, 13.98% ten frames later. The list markers stayed put
 * the whole time, because `::marker` takes no transition from the rule — which
 * is what gave the cause away.
 *
 * The colour is still animated where a token actually sets one, under an open
 * menu. A rule that does not match at rest cannot be fired by a theme swap.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const load = async (path: string) =>
  strip((await import(/* @vite-ignore */ path)).default as string);

const highlighter = () => load("../TextHighlighter/TextHighlighter.module.css?raw");

/** The declaration block of the rule with exactly this selector. */
const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no rule for \`${selector}\``);
  return css.slice(at, css.indexOf("}", at));
};

describe("what a token animates at rest", () => {
  it("never transitions the colour it inherits", async () => {
    const declared = rule(await highlighter(), ".token");
    const transition = declared.slice(declared.indexOf("transition:"));
    // `color` standing alone — not `background-color`, not `border-color`.
    expect(transition).not.toMatch(/(^|[\s,;:])color\s/);
  });

  it("still animates the things it does set", async () => {
    // The other half. Deleting the transition outright would satisfy the test
    // above and take the focus effect with it.
    const transition = rule(await highlighter(), ".token");
    for (const prop of ["filter", "opacity", "transform"]) {
      expect(transition, `${prop} is no longer animated`).toMatch(new RegExp(`${prop}\\s+\\d+ms`));
    }
  });
});

describe("what a token animates under an open menu", () => {
  it("adds the colour back, where the colour is actually set", async () => {
    const focused = rule(await highlighter(), '.tokens[data-focus="true"] .token');
    expect(focused).toMatch(/transition:/);
    expect(focused).toMatch(/(^|[\s,;:])color\s+\d+ms/);
  });

  it("keeps the marker's ink on the words the menu belongs to", async () => {
    // Where that colour comes from. Colouring every marked word at rest was
    // tried instead and reverted: a stroke is drawn by hand and does not stop
    // at word boundaries — it entered "Higgs" three letters in, leaving the
    // first three marker-ink on the page's own background rather than on the
    // stroke. Ink cannot follow a stroke; only the stroke can.
    const active = rule(await highlighter(), '.tokens[data-focus="true"] .token[data-active="true"]');
    expect(active).toMatch(/color:\s*var\(--ick-marker-ink\)/);
  });
});
