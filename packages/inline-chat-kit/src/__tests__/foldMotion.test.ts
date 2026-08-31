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

/* Anchored to the start of a line: a plain `indexOf` finds `.body` inside a
   descendant selector that merely ends with it. */
const rule = (css: string, selector: string) => {
  const sheet = strip(css);
  const at = sheet.search(new RegExp(`^${selector.replace(/[.[\]]/g, "\\$&")} \\{`, "m"));
  expect(at, `${selector} is missing`).toBeGreaterThan(-1);
  return sheet.slice(at, sheet.indexOf("}", at));
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
   * Rows arrive; the box follows. It was two blocks dissolving through each
   * other, which is what you reach for when two things are unrelated — and the
   * summary row and the stack of cards are the same answers in two states. It
   * read as the box moving while the content sat there bleeding through
   * itself.
   */
  it("brings the rows in one at a time rather than dissolving one body into another", async () => {
    const source = await load("../QuestionGroup/QuestionGroup.tsx?raw");
    const { defaultFoldMotion } = await import("../QuestionGroup/QuestionGroup");

    /* Both sides of the fold are lists of rows, even the one holding one row,
       so both arrive by the same rule. */
    expect((source.match(/\{\.\.\.bodyMotion\}/g) ?? []).length).toBe(2);
    expect((source.match(/variants=\{rowMotion\}/g) ?? []).length).toBe(2);
    expect(source).toMatch(/staggerChildren: still \? 0 : beat\.stagger/);
    expect(defaultFoldMotion.stagger).toBeGreaterThan(0);
  });

  /**
   * Springs for what travels, a tween for opacity.
   *
   * Not a preference. A spring describes where a thing is going and how it
   * arrives, and opacity has nowhere to go: bounded at 0 and 1, so a spring
   * with any bounce overshoots into a clamp and spends the overshoot sitting
   * still. Position and size have no ceiling, which is what makes them worth
   * springing. Every duration here was a `duration` on everything, which is
   * how the whole fold came to be a dissolve.
   */
  it("springs what moves and tweens only the opacity", async () => {
    const source = await load("../QuestionGroup/QuestionGroup.tsx?raw");

    /* The ground and a row: two springs, both named by how long they look. */
    expect((source.match(/type: "spring" as const/g) ?? []).length).toBe(2);
    expect(source).toMatch(/visualDuration: beat\.visualDuration/);
    expect(source).toMatch(/visualDuration: beat\.rowDuration/);

    /* And the only `duration` left in an arriving transition is the opacity's,
       inside the row's spring. */
    expect(source).toMatch(/opacity: \{ duration: beat\.fadeIn \}/);

    /* A row travels, or the spring has nothing to describe. */
    const { defaultFoldMotion } = await import("../QuestionGroup/QuestionGroup");
    expect(Math.abs(defaultFoldMotion.rowOffset)).toBeGreaterThan(0);
  });

  /**
   * A layer for the length of one fold, and not a moment longer.
   *
   * Motion animates `y` as an independent transform, and an independent
   * transform does not promote the element on its own — sampled through a
   * whole fold, every row read `will-change: auto`. Motion's own guidance is
   * to name the properties being animated and then take the hint away, since a
   * permanent one is a permanent layer.
   *
   * The taking-away is the part that was subtly wrong first time: both bodies
   * carry `onAnimationComplete` and the leaving one finishes first, so the
   * layers went at 165ms with the rows still travelling until 300.
   */
  it("promotes a row only while it is moving", async () => {
    const css = await load("../QuestionGroup/QuestionGroup.module.css?raw");
    const source = await load("../QuestionGroup/QuestionGroup.tsx?raw");

    expect(strip(css)).toMatch(
      /\.group\[data-moving\][^{]*\{[^}]*will-change:\s*transform,\s*opacity/
    );
    /* Nothing carries it unconditionally. */
    expect(strip(css).replace(/\.group\[data-moving\][\s\S]*?\}/g, "")).not.toMatch(
      /will-change/
    );

    /* On when the fold starts, off when the *arriving* body settles. */
    expect(source).toMatch(/setMoving\(true\)/);
    expect(source).toMatch(/definition === "shown"[\s\S]{0,60}setMoving\(false\)/);
    expect(source).toMatch(/data-moving=\{moving \|\| undefined\}/);
  });
});
