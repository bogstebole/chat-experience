import { describe, it, expect } from "vitest";

/**
 * Concentric corners, everywhere a box holds a box.
 *
 * A box's corner is the corner of the thing inside it plus the gap between
 * them. Get it wrong and the two curves sit at different insets with the same
 * radius, leaving a crescent between them — the thing that reads as "not quite
 * fitting" without anybody being able to name it.
 *
 * This started as the question card's chain and then the same fault turned up
 * in a tool call inside an approval, which is what made it a rule rather than
 * one component's arithmetic. Every nesting in the kit is listed below; adding
 * a box that holds a box means adding a row.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const load = async (path: string) =>
  strip((await import(/* @vite-ignore */ path)).default as string);

/** Every place the kit puts one rounded box inside another. */
const NESTINGS = [
  {
    what: "a badge in an option row",
    outer: ["QuestionCard/QuestionCard.module.css", ".option"],
    inner: "--ick-question-radius-badge",
    gap: "--ick-space-4",
  },
  {
    what: "an option row in a card",
    outer: ["QuestionCard/QuestionCard.module.css", ".item"],
    inner: "--ick-question-radius-row",
    gap: "--ick-space-4",
  },
  {
    what: "a card in a group",
    outer: ["QuestionGroup/QuestionGroup.module.css", ".group"],
    inner: "--ick-question-radius-card",
    gap: "--ick-space-6",
  },
  {
    what: "a code block in a tool call's card",
    outer: ["Tool/Tool.module.css", ".card"],
    inner: "--ick-tool-inner-radius",
    gap: "--ick-tool-inner-gap",
  },
  {
    what: "a tool call's card on its ground",
    outer: ["Tool/Tool.module.css", ".tool"],
    inner: "--ick-tool-radius",
    gap: "--ick-tool-ground-pad",
  },
  {
    what: "a tool call in an approval",
    outer: ["Approval/Approval.module.css", ".approval"],
    inner: "--ick-tool-radius",
    gap: "--ick-approval-pad",
  },
] as const;

describe("corners nest", () => {
  it.each(NESTINGS.map((n) => [n.what, n] as const))("%s", async (_what, nesting) => {
    const tokens = await load("../styles/tokens.css?raw");
    const [file, selector] = nesting.outer;
    const css = await load(`../${file}?raw`);

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

    /* The rule the selector actually carries, so a raw value cannot slip past
       the arithmetic by agreeing with it once. */
    const at = css.indexOf(`${selector} {`);
    expect(at, `${selector} is missing from ${file}`).toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    const outerToken = rule.match(/border-radius:\s*var\((--[\w-]+)\)/)?.[1];
    expect(outerToken, `${selector} does not take its corner from a token`).toBeTruthy();

    const outer = value(outerToken as string);
    const inner = value(nesting.inner);
    const gap = value(nesting.gap);

    expect(outer - inner, JSON.stringify({ outer, inner, gap })).toBe(gap);
  });

  /** A field row is a row, and the two kinds have to agree. */
  it("gives both kinds of question row the same corner", async () => {
    const css = await load("../QuestionCard/QuestionCard.module.css?raw");
    const corner = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      return css.slice(at, css.indexOf("}", at)).match(/border-radius:\s*([^;]+);/)?.[1];
    };
    expect(corner(".field")).toBe(corner(".option"));
    expect(corner(".shellCard")).toBe(corner(".item"));
  });

  /**
   * A code block standing on its own keeps the larger corner; only one nested
   * inside a tool takes the smaller one. If `Tool` ever stops repointing it,
   * the block and its container go back to the same radius at two insets.
   */
  it("hands a nested code block a smaller corner than a standalone one", async () => {
    const tool = await load("../Tool/Tool.module.css?raw");
    expect(tool).toMatch(/--ick-code-radius:\s*var\(--ick-tool-inner-radius\)/);

    const block = await load("../CodeBlock/CodeBlock.module.css?raw");
    expect(block).toMatch(/border-radius:\s*var\(--ick-code-radius\)/);
  });
});
