import { describe, it, expect } from "vitest";

/**
 * The four things that made the question group's fold flicker.
 *
 * Every one of them was found by sampling the transition frame by frame in a
 * real browser, and none of them is visible in a still. They are written down
 * here because each is a single prop or declaration away from coming back, and
 * because the next person to read the component will not guess why a `<div>`
 * had to become a `motion.div` that animates nothing.
 *
 * jsdom runs no layout and Motion's projection needs one, so this reads the
 * source rather than the rendered result. That is weaker than the stylesheet
 * guards elsewhere, which do the browser's arithmetic — but "this element
 * carries this prop" is a fact the source states exactly, and it is the fact
 * that was wrong.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const load = async (path: string) => (await import(/* @vite-ignore */ path)).default as string;

const rule = (css: string, selector: string) => {
  const at = strip(css).indexOf(`${selector} {`);
  expect(at, `${selector} is missing`).toBeGreaterThan(-1);
  return strip(css).slice(at, strip(css).indexOf("}", at));
};

describe("the fold", () => {
  /**
   * Motion animates a size the only way it can: it puts the new one in the DOM
   * and scales the box back to the old one. Everything inside that is not
   * itself a layout child rides that scale.
   *
   * Measured over one open, before this: the header was squashed from 23px to
   * 11.67 in a single frame and stretched back over the next 450ms, the title
   * with it. The cards did the same. `layout="position"` is the right half of
   * it — neither the header nor the body moves, so all they need is the scale
   * taken back off.
   */
  it("counter-scales everything the ground scales", async () => {
    const source = await load("../QuestionGroup/QuestionGroup.tsx?raw");

    /* The ground is what scales. */
    expect(source).toMatch(/ref=\{groundRef\}[\s\S]{0,120}layout=\{!still\}/);

    /* And its two children take the correction. A `motion.div` that animates
       nothing else is exactly what this is for. */
    const children = source.match(/layout=\{still \? false : "position"\}/g) ?? [];
    expect(children.length, "the header wrapper and the body both need it").toBe(2);

    /* One clock for all three, or a header counter-scaling on a different
       spring to the box scaling it is a header that visibly lags. */
    expect((source.match(/transition=\{resize\}/g) ?? []).length).toBe(3);
  });

  /**
   * `mode="popLayout"` takes the leaving body out of flow so the arriving one
   * can have its place immediately. Absolute against what, though: without a
   * positioned parent the summary resolved 67px down the page and faded out
   * somewhere it had never been.
   */
  it("anchors the body a leaving child pops out of", async () => {
    const css = await load("../QuestionGroup/QuestionGroup.module.css?raw");
    const source = await load("../QuestionGroup/QuestionGroup.tsx?raw");
    expect(source).toMatch(/mode="popLayout"/);
    expect(rule(css, ".body")).toMatch(/position:\s*relative/);
  });

  /**
   * And the ground clips, because while it shrinks the popped-out list stays
   * pinned at its full height and hangs three rows out of the bottom over
   * whatever is underneath.
   */
  it("keeps what is leaving inside the ground", async () => {
    const css = await load("../QuestionGroup/QuestionGroup.module.css?raw");
    expect(rule(css, ".group")).toMatch(/overflow:\s*hidden/);
  });

  /**
   * Neither body carries `layout`. With it, the leaving one animates toward
   * wherever it resolves to once absolute — which is the 67px trip above,
   * caused by the fix rather than cured by it. They inherit the scale
   * correction from the body above them.
   */
  it("leaves the two bodies out of the layout tree", async () => {
    const source = await load("../QuestionGroup/QuestionGroup.tsx?raw");
    for (const key of ["summary", "list"]) {
      const at = source.indexOf(`key="${key}"`);
      expect(at, `no ${key} body`).toBeGreaterThan(-1);
      const element = source.slice(at, source.indexOf(">", at));
      expect(element, `${key} must not carry layout`).not.toMatch(/layout/);
    }
  });

  /**
   * A crossfade, not a relay. The arriving body used to wait 100ms for the
   * leaving one, which is a tenth of a second of grown, empty box — most of
   * what read as the flicker. Sampled at the midpoint the two now sum to about
   * 0.9 of an opaque body; they summed to 0.4.
   */
  it("starts the arriving body while the leaving one is still there", async () => {
    const { defaultFoldMotion } = await import("../QuestionGroup/QuestionGroup");
    expect(defaultFoldMotion.fadeInDelay).toBeLessThan(defaultFoldMotion.fadeOut / 2);
  });
});
