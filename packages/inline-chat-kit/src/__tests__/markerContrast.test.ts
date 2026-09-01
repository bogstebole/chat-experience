import { describe, it, expect } from "vitest";

/**
 * The marker's stroke is the one thing in the kit that composites with live
 * text, and it needs different physics in each theme.
 *
 * `multiply` is what makes a highlighter look like one: the stroke keeps its
 * hue and the words come through darkened. It works by assuming the page's ink
 * is darker than the marker. In the dark theme that is false, and the blend
 * inverts figure and ground — measured in Chrome at rest, the band read
 * `rgb(169 198 19)` and the words on it `rgb(217 245 73)`, the text *brighter*
 * than the stroke it sits on, at **1.59:1**. The same words in light measured
 * 16.91:1. AA wants 4.5.
 *
 * Dark lays a tint down instead and leaves the words in the page's own ink.
 * Measured after the change: **5.26:1** for the text on the stroke, 3.23:1 for
 * the stroke against the bare page.
 *
 * **There is no contrast arithmetic in this file, on purpose.** Composing the
 * value by hand gives `rgb(59 70 14)` where Chrome paints `rgb(97 106 50)`, so
 * a computed assertion here would be a confident number that does not describe
 * the screen — which is the mistake this whole fix was made of. What is
 * pinned instead is the shape of the thing and the window the sweep measured;
 * moving outside it means going back to the browser.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const load = async (path: string) =>
  strip((await import(/* @vite-ignore */ path)).default as string);

const tokens = () => load("../styles/tokens.css?raw");
const highlighter = () => load("../TextHighlighter/TextHighlighter.module.css?raw");

const rule = (css: string, selector: string) => {
  const at = css.indexOf(`${selector} {`);
  if (at < 0) throw new Error(`no rule for \`${selector}\``);
  return css.slice(at, css.indexOf("}", at));
};

describe("the marker's stroke", () => {
  it("takes its paint, its blend and its active ink from tokens", async () => {
    const css = await highlighter();
    expect(rule(css, ".marker")).toMatch(/stroke:\s*var\(--ick-marker-stroke\)/);
    expect(rule(css, ".canvas")).toMatch(/mix-blend-mode:\s*var\(--ick-marker-blend\)/);
    expect(rule(css, '.tokens[data-focus="true"] .token[data-active="true"]')).toMatch(
      /color:\s*var\(--ick-marker-active-ink\)/
    );
  });

  it("is the only marker token the dark theme moves", async () => {
    const css = await tokens();
    for (const name of ["--ick-dark-marker-stroke", "--ick-dark-marker-blend", "--ick-dark-marker-active-ink"]) {
      expect(css, `${name} is not declared`).toMatch(new RegExp(`${name}:`));
    }
    // `--ick-marker` is the background of a badge in five other components,
    // where black-on-green is right in both themes. Overriding it to fix the
    // stroke would take all five with it.
    expect(css).not.toMatch(/--ick-dark-marker:/);
    expect(css).not.toMatch(/--ick-dark-marker-ink:/);
  });

  it("stops multiplying in the dark, which is the whole fault", async () => {
    const css = await tokens();
    expect(css).toMatch(/--ick-marker-blend:\s*multiply/);
    expect(css).toMatch(/--ick-dark-marker-blend:\s*normal/);
  });

  it("leaves a marked word in the page's ink in the dark", async () => {
    // With the stroke now darker than the ink rather than lighter, repainting
    // the word marker-ink under an open menu would undo the fix: black on that
    // tint is a fifth of the contrast the page's own ink already has on it.
    const css = await tokens();
    expect(css).toMatch(/--ick-marker-active-ink:\s*var\(--ick-marker-ink\)/);
    expect(css).toMatch(/--ick-dark-marker-active-ink:\s*var\(--ick-ink\)/);
  });

  it("keeps its alpha inside the window the sweep measured", async () => {
    // Both requirements pull against each other — a fainter stroke reads
    // better and shows less — so this is a range, not a number. Swept in
    // Chrome across 0.10 to 0.34: below 0.14 the mark itself drops under 3:1
    // against the page, and at 0.26 the text is down to 4.68:1 with no room
    // left. Re-measure before moving it.
    const css = await tokens();
    const found = css.match(/--ick-dark-marker-stroke:\s*rgb\(var\(--ick-marker-rgb\)\s*\/\s*([\d.]+)\)/);
    expect(found, "the dark stroke is no longer a plain alpha on the marker").not.toBeNull();
    const alpha = Number(found![1]);
    expect(alpha).toBeGreaterThanOrEqual(0.14);
    expect(alpha).toBeLessThanOrEqual(0.26);
  });
});
