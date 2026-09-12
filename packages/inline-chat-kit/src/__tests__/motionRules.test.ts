import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Two rules about motion that nothing on screen can show you.
 *
 * Both came out of an audit against Emil Kowalski's standards — see
 * `.claude/skills/`. Neither is visible in a screenshot: one is a property
 * list, the other only appears on a device the screenshot was not taken on.
 * So they are read out of the stylesheets instead.
 *
 * This is a lint, not a test of behaviour, and it is in the test suite for the
 * same reason the disclosure guard is: it is the only place that runs on every
 * change.
 */

/* From the working directory, not from `import.meta.url`. Vitest serves this
   file through Vite, so `import.meta.url` is not a `file:` URL at all and
   `fileURLToPath` refuses it — and `.pathname` would hand back `%20` for the
   space in this repository's own path. The first assertion below is what
   catches a wrong directory: no stylesheets found is a broken check, not a
   clean one. */
const SRC = join(process.cwd(), "src");

/** Every stylesheet in the package, ignoring the story fixtures. */
function stylesheets(dir = SRC, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "stories" || entry.name === "__tests__") continue;
      stylesheets(path, found);
    } else if (entry.name.endsWith(".css")) {
      found.push(path);
    }
  }
  return found;
}

const sheets = stylesheets().map((path) => ({
  name: path.slice(SRC.length),
  css: readFileSync(path, "utf8"),
}));

describe("motion rules the eye cannot check", () => {
  it("has stylesheets to check at all", () => {
    expect(sheets.length).toBeGreaterThan(20);
  });

  /**
   * `transition: all` animates whatever happens to change — including the
   * properties nobody meant, off the GPU.
   *
   * Found on the glass button, at 400ms, which is what the composer's mic,
   * plus and send are made of, and the X on an attachment. Among the
   * properties it was animating: `backdrop-filter`, a blur re-composited every
   * frame for four hundred milliseconds, and the same blur before and after.
   */
  it("never says `transition: all`", () => {
    const guilty = sheets
      .filter(({ css }) => /transition:\s*all\b/.test(css))
      .map(({ name }) => name);
    expect(guilty, `name the properties instead — ${guilty.join(", ")}`).toEqual([]);
  });

  /**
   * A `:hover` that **moves** something has to be gated on there being
   * something to hover with.
   *
   * A touchscreen fires a hover on tap and leaves it there until the next tap
   * somewhere else, so an ungated lift leaves the element standing a pixel or
   * two high for as long as the reader does not touch anything — a state the
   * design has no name for and no screenshot will ever show, because a
   * screenshot is taken with no pointer at all.
   *
   * Colour, shadow and opacity on hover are fine and deliberately not checked:
   * on touch they read as "this is the one under your finger", which is true.
   * Only movement is a claim about the physical world.
   */
  it("only moves on hover where there is a pointer to hover with", () => {
    const ungated: string[] = [];

    for (const { name, css } of sheets) {
      /* A rough block walk rather than a CSS parser: the question is only
         whether a `transform` sits inside a `:hover` block, and whether that
         block sits inside a media query that asks for a real pointer. Depth
         counting is enough for that, and a dependency is not. */
      let depth = 0;
      const gated: boolean[] = [];
      let selector = "";

      for (const part of css.split(/([{}])/)) {
        if (part === "{") {
          depth += 1;
          const isMedia = /@media/.test(selector);
          const asksForPointer = /hover:\s*hover|pointer:\s*fine/.test(selector);
          gated[depth] = (gated[depth - 1] ?? false) || (isMedia && asksForPointer);
          continue;
        }
        if (part === "}") {
          depth = Math.max(0, depth - 1);
          continue;
        }
        /* The text before a `{` is the selector; the text before a `}` is the
           declarations of the block just closed. Only the former matters for
           what we are inside, so the selector is remembered and the body is
           checked against the selector that opened it. */
        const body = part;
        if (/:hover\b/.test(selector) && !gated[depth]) {
          const moves = /transform:\s*(?!none)[^;]*(translate|scale|rotate|matrix|perspective|skew)/.test(
            body
          );
          if (moves) ungated.push(`${name}  ${selector.trim().split("\n").pop()}`);
        }
        selector = body;
      }
    }

    expect(
      ungated,
      `wrap these in @media (hover: hover) and (pointer: fine) — ${ungated.join(" | ")}`
    ).toEqual([]);
  });
});
