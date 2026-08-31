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

/** `12px`, `var(--x)` and `calc(var(--a) + var(--b))`, resolved to a number. */
const px = (tokens: string, name: string, seen = new Set<string>()): number => {
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
        return px(tokens, token as string, new Set(seen));
      })
      .reduce((a, b) => a + b, 0);
  }

  const alias = (raw as string).match(/^var\((--[\w-]+)\)$/)?.[1];
  expect(alias, `${name} is not a length: ${raw}`).toBeTruthy();
  return px(tokens, alias as string, seen);
};

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
    what: "an approval's card on its ground",
    outer: ["Approval/Approval.module.css", ".approval"],
    inner: "--ick-nest-card",
    gap: "--ick-approval-pad",
  },
  {
    what: "a tool call in an approval's card",
    outer: ["Approval/Approval.module.css", ".card"],
    inner: "--ick-nest-row",
    gap: "--ick-nest-pad",
  },
] as const;

describe("corners nest", () => {
  it.each(NESTINGS.map((n) => [n.what, n] as const))("%s", async (_what, nesting) => {
    const tokens = await load("../styles/tokens.css?raw");
    const [file, selector] = nesting.outer;
    const css = await load(`../${file}?raw`);

    /* The rule the selector actually carries, so a raw value cannot slip past
       the arithmetic by agreeing with it once. */
    const at = css.indexOf(`${selector} {`);
    expect(at, `${selector} is missing from ${file}`).toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));
    const outerToken = rule.match(/border-radius:\s*var\((--[\w-]+)\)/)?.[1];
    expect(outerToken, `${selector} does not take its corner from a token`).toBeTruthy();

    const outer = px(tokens, outerToken as string);
    const inner = px(tokens, nesting.inner);
    const gap = px(tokens, nesting.gap);

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
   * A code block standing on its own takes the kit's default corner, which is
   * seeded for nothing in particular. Nested in a tool it has to take the one
   * its container implies, and `Tool` is what repoints it — if that ever goes,
   * the block and the card around it go back to two radii at two insets.
   */
  it("repoints a nested code block at the corner its card implies", async () => {
    const tool = await load("../Tool/Tool.module.css?raw");
    expect(tool).toMatch(/--ick-code-radius:\s*var\(--ick-tool-inner-radius\)/);

    const block = await load("../CodeBlock/CodeBlock.module.css?raw");
    expect(block).toMatch(/border-radius:\s*var\(--ick-code-radius\)/);
  });

  /**
   * One chain, not two.
   *
   * A tool call used to seed its own, one step tighter the whole way down: a
   * 6px block in a 14px card on a 22px ground, beside a question's 8 / 16 / 24
   * / 40. Both were internally concentric and the two were nothing like each
   * other — the same three surfaces at two scales, which reads as two systems
   * rather than one object holding different things.
   *
   * Every step, checked against the question's, because that is the thing the
   * comparison is actually about.
   */
  it.each([
    ["what a card holds", "--ick-question-radius-row", "--ick-tool-inner-radius"],
    ["the card", "--ick-question-radius-card", "--ick-tool-radius"],
    ["the ground it stands on", "--ick-question-radius-group", "--ick-tool-ground-radius"],
  ])("gives a tool call and a question the same corner for %s", async (_step, q, t) => {
    const tokens = await load("../styles/tokens.css?raw");
    expect(px(tokens, t)).toBe(px(tokens, q));
  });

  /** And the same gaps, since the corners are only as equal as those are. */
  it("pads a tool call the way a question is padded", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    expect(px(tokens, "--ick-tool-inner-gap")).toBe(px(tokens, "--ick-nest-pad"));
    expect(px(tokens, "--ick-tool-ground-pad")).toBe(px(tokens, "--ick-nest-ground-pad"));
    /* An approval *is* the ground, so it leaves a ground's gap. */
    expect(px(tokens, "--ick-approval-pad")).toBe(px(tokens, "--ick-nest-ground-pad"));
  });

  /**
   * A folded tool row and a folded question row are the same height, so a
   * stack of them lines up and the glyph sits where the badges sit: a badge,
   * and the card's padding above and below it.
   */
  it("folds a tool call to the height a question folds to", async () => {
    const height = (css: string, selector: string) => {
      const at = css.indexOf(`${selector} {`);
      expect(at, `${selector} is missing`).toBeGreaterThan(-1);
      const pad = css.slice(at, css.indexOf("}", at)).match(/padding:\s*([^;]+);/)?.[1];
      return pad?.trim().split(/\s+/);
    };
    /* The header is shared now, and a tool call's is the `filled` one — the
       variant whose row *is* a card's top edge. */
    const head = await load("../disclosure/DisclosureHeader.module.css?raw");
    const question = await load("../QuestionCard/QuestionCard.module.css?raw");
    expect(height(head, '.header[data-filled]')).toEqual(height(question, ".collapsed"));

    /* And the glyph rides in the badge's box rather than at its own size. */
    expect(head).toMatch(
      /\.header\[data-filled\] \.glyph\s*\{[^}]*width:\s*var\(--ick-badge-size\)/
    );

    /* Trailing element hard right, the way a collapsed question keeps its
       pencil there — even on a row carrying neither summary nor duration. */
    expect(head).toMatch(/\.chevron\s*\{[^}]*margin-left:\s*auto/);
  });

  /**
   * Nothing builds a ground out of two numbers.
   *
   * The stories did — `padding: 16, borderRadius: 24` — which is a ground
   * padded like a ground and cornered like the card standing on it. It is the
   * one place the chain cannot reach, because a style object is not a
   * stylesheet, so it gets checked here instead.
   */
  it("builds every ground in the stories out of the tokens", async () => {
    const files = import.meta.glob("../stories/*.tsx", { query: "?raw", import: "default" });
    for (const [name, read] of Object.entries(files)) {
      const src = (await read()) as string;
      let at = src.indexOf("var(--ick-question-surface)");
      while (at > -1) {
        const around = src.slice(Math.max(0, at - 400), at);
        const corner = [...around.matchAll(/borderRadius:\s*([^,\n]+)/g)].pop()?.[1];
        if (corner) {
          expect(corner.trim(), `${name} corners a ground by hand`).toBe(
            '"var(--ick-question-radius-group)"',
          );
        }
        at = src.indexOf("var(--ick-question-surface)", at + 1);
      }
    }
  });
});

/**
 * A badge sits in the middle of the line it belongs to.
 *
 * The badge is 24 tall; a title line is 16. Top-aligned, that puts the number
 * four pixels below the middle of the question — measured in a browser, and at
 * four pixels it reads as wrong long before anybody can name it. Option rows
 * were two out, for the same reason plus a 2px nudge that was trying to fix it
 * by hand. Field rows were the only ones right, because `.fieldLabel` already
 * took the badge's height.
 *
 * The rule: **the text's line box is the badge's box**, so the two centre
 * together and stay centred when the type changes. Not a margin on the badge —
 * a margin is a number that has to be re-guessed every time either side moves.
 *
 * jsdom has no layout, so what is pinned here is the rule rather than the
 * pixels. The pixels were checked in a browser once, and the browser is where
 * they get checked again.
 */
describe("a badge and its line", () => {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rule = (css: string, selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, `${selector} is missing`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };

  it.each([".title", ".optionTitle"])("gives %s the badge's line box", async (selector) => {
    const css = strip(
      (await import("../QuestionCard/QuestionCard.module.css?raw")).default as string
    );
    expect(rule(css, selector)).toMatch(/line-height:\s*var\(--ick-badge-size\)/);
  });

  /** The field row's older spelling of the same rule, kept. */
  it("gives a field's label the badge's height", async () => {
    const css = strip(
      (await import("../QuestionCard/QuestionCard.module.css?raw")).default as string
    );
    expect(rule(css, ".fieldLabel")).toMatch(/height:\s*var\(--ick-badge-size\)/);
  });

  /** And nothing nudges on top of it. */
  it("leaves no padding compensating for the old misalignment", async () => {
    const css = strip(
      (await import("../QuestionCard/QuestionCard.module.css?raw")).default as string
    );
    expect(rule(css, ".optionBody")).not.toMatch(/padding:/);
  });
});
