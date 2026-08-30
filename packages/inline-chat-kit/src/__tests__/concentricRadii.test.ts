import { describe, it, expect } from "vitest";

/**
 * Concentric corners.
 *
 * A box's corner is the corner of the thing inside it plus the gap between
 * them. Get it wrong and a rounded row inside a rounded card leaves a crescent
 * of card between the two curves — which is the thing that reads as "not quite
 * fitting" without anybody being able to name it.
 *
 * The chain is four boxes deep and spans two stylesheets, so it is arithmetic
 * nobody is going to redo by eye when a padding changes. jsdom lays nothing
 * out; this does the same sum the browser does.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const load = async (path: string) =>
  strip((await import(/* @vite-ignore */ path)).default as string);

describe("the question card's corners nest", () => {
  it("gives every box the corner of what it holds plus the gap", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const card = await load("../QuestionCard/QuestionCard.module.css?raw");
    const group = await load("../QuestionGroup/QuestionGroup.module.css?raw");

    /** `12px`, `var(--x)` and `calc(var(--a) + var(--b))`, in px. */
    const value = (name: string, seen = new Set<string>()): number => {
      expect(seen.has(name), `${name} refers to itself`).toBe(false);
      seen.add(name);

      const raw = tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();
      expect(raw, `${name} is defined nowhere`).toBeTruthy();

      const literal = (raw as string).match(/^(\d+(?:\.\d+)?)px$/);
      if (literal) return Number(literal[1]);

      const sum = (raw as string).match(/^calc\((.+)\)$/)?.[1];
      if (sum) {
        return sum
          .split("+")
          .map((part) => {
            const token = part.trim().match(/^var\((--[\w-]+)\)$/)?.[1];
            expect(token, `not a token: ${part.trim()}`).toBeTruthy();
            return value(token as string, new Set(seen));
          })
          .reduce((a, b) => a + b, 0);
      }

      const alias = (raw as string).match(/^var\((--[\w-]+)\)$/)?.[1];
      expect(alias, `${name} is not a length: ${raw}`).toBeTruthy();
      return value(alias as string, seen);
    };

    /** The rule a selector actually carries, so a raw value cannot slip past. */
    const radiusOf = (css: string, selector: string) => {
      const at = css.indexOf(`${selector} {`);
      expect(at, `${selector} is missing`).toBeGreaterThan(-1);
      const rule = css.slice(at, css.indexOf("}", at));
      const token = rule.match(/border-radius:\s*var\((--[\w-]+)\)/)?.[1];
      expect(token, `${selector} does not take its corner from a token`).toBeTruthy();
      return value(token as string);
    };

    const radius = {
      badge: radiusOf(card, ".badge"),
      row: radiusOf(card, ".option"),
      card: radiusOf(card, ".item"),
      group: radiusOf(group, ".group"),
    };

    // The gaps: a row's own padding, the card's padding around its rows, and
    // the group's around its cards.
    const gap = {
      row: value("--ick-space-4"),
      card: value("--ick-space-4"),
      group: value("--ick-space-6"),
    };

    expect({ ...radius, ...gap }).toMatchObject({ badge: expect.any(Number) });
    expect(radius.row - radius.badge, JSON.stringify(radius)).toBe(gap.row);
    expect(radius.card - radius.row, JSON.stringify(radius)).toBe(gap.card);
    expect(radius.group - radius.card, JSON.stringify(radius)).toBe(gap.group);
  });

  /** A field row is a row, and the two kinds have to agree. */
  it("gives both kinds of row the same corner", async () => {
    const css = await load("../QuestionCard/QuestionCard.module.css?raw");
    const corner = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      return css.slice(at, css.indexOf("}", at)).match(/border-radius:\s*([^;]+);/)?.[1];
    };
    expect(corner(".field")).toBe(corner(".option"));
  });

  /** And a shell standing on its own is a card like any other. */
  it("gives the standalone shell a card's corner", async () => {
    const css = await load("../QuestionCard/QuestionCard.module.css?raw");
    const corner = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      return css.slice(at, css.indexOf("}", at)).match(/border-radius:\s*([^;]+);/)?.[1];
    };
    expect(corner(".shellCard")).toBe(corner(".item"));
  });
});
