import { describe, it, expect } from "vitest";

/**
 * Text lines up with text.
 *
 * A section's title sits over the words it names, not over the edges of the
 * cards those words are in — and the control at the other end of that title
 * sits over the icons at the other end of those rows. The group's title
 * started sixteen pixels left of the numbers under it and its chevron four
 * pixels off the pencils, which is the kind of thing that reads as wrong long
 * before anybody can point at it.
 *
 * The columns are the whole subject here, so this does the browser's
 * arithmetic on them rather than checking that particular tokens were spelled
 * a particular way. Two rows can reach the same column through different
 * tokens and both be right; two rows can share a token and still land apart.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const load = async (path: string) =>
  strip((await import(/* @vite-ignore */ path)).default as string);

/** `12px`, `var(--x)`, `calc(var(--a) + var(--b))`, `calc(var(--a) * -1)`. */
const px = (tokens: string, value: string, probes: Record<string, number> = {}): number => {
  const raw = value.trim();
  if (raw === "0") return 0;
  if (/^-?\d+(\.\d+)?px$/.test(raw)) return Number.parseFloat(raw);

  const alias = raw.match(/^var\((--[\w-]+)\)$/)?.[1];
  if (alias) {
    if (alias in probes) return probes[alias];
    const declared = tokens.match(new RegExp(`${alias}:\\s*([^;]+);`))?.[1];
    expect(declared, `${alias} is defined nowhere`).toBeTruthy();
    return px(tokens, declared as string, probes);
  }

  const sum = raw.match(/^calc\((.+)\)$/)?.[1];
  expect(sum, `cannot read ${raw}`).toBeTruthy();
  return (sum as string)
    .split("+")
    .map((term) => {
      const [factor, times] = term.split("*");
      const scale = times === undefined ? 1 : Number(times.trim());
      return px(tokens, factor.trim(), probes) * scale;
    })
    .reduce((a, b) => a + b, 0);
};

/** The shorthand's values, splitting on top-level spaces only — `calc()` has
    spaces of its own and they are not value boundaries. */
const split = (value: string) => {
  const out: string[] = [];
  let depth = 0;
  let at = "";
  for (const ch of value.trim()) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (/\s/.test(ch) && depth === 0) {
      if (at) out.push(at);
      at = "";
      continue;
    }
    at += ch;
  }
  if (at) out.push(at);
  return out;
};

/** A rule's `padding` shorthand, expanded the way the browser expands it. */
const padding = (tokens: string, css: string, selector: string, probes = {}) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} is missing`).toBeGreaterThan(-1);
  const raw = css.slice(at, css.indexOf("}", at)).match(/padding:\s*([^;]+);/)?.[1]?.trim();
  expect(raw, `${selector} has no padding`).toBeTruthy();
  const parts = split(raw as string).map((part) => px(tokens, part, probes));
  const [top, right = top, bottom = top, left = right] = parts;
  return { top, right, bottom, left };
};

/** One declaration out of a rule. */
const decl = (css: string, selector: string, property: string) => {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} is missing`).toBeGreaterThan(-1);
  const found = css
    .slice(at, css.indexOf("}", at))
    .match(new RegExp(`(?:^|[;{]|\\n)\\s*${property}:\\s*([^;]+);`))?.[1];
  expect(found, `${selector} has no ${property}`).toBeTruthy();
  return (found as string).trim();
};

describe("columns", () => {
  /**
   * The header's box is its container's content box widened by its own padding
   * on both sides, so that with no inset the label lands exactly on the left
   * edge and the chevron exactly on the right — and an inset moves the two
   * inward together. It used to be `width: 100%` pulled back on the left
   * alone, which put the chevron six pixels shy of an edge every other row in
   * the kit sits on.
   */
  it("gives a disclosure header the column its container gives its rows", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const css = await load("../disclosure/DisclosureHeader.module.css?raw");

    /* A container 1000 wide and an inset of 40, so a wrong sum cannot land on
       the right answer by sharing a value with something else. */
    const width = 1000;
    const inset = 40;
    const probes = { "--ick-disclosure-inset": inset };

    const own = px(tokens, decl(css, ".header", "width").replace("100%", `${width}px`), probes);
    const margin = px(tokens, decl(css, ".header", "margin-inline"), probes);
    const pad = padding(tokens, css, ".header", probes);

    /* Where the label starts and where the chevron ends, measured from the
       container's own content edges. */
    const left = margin + pad.left;
    const right = width - (margin + own - pad.right);
    expect({ left, right }).toEqual({ left: inset, right: inset });

    /* And with no inset at all, hard against both edges. */
    const bare = { "--ick-disclosure-inset": 0 };
    expect(
      px(tokens, decl(css, ".header", "margin-inline"), bare) +
        padding(tokens, css, ".header", bare).left
    ).toBe(0);
  });

  /**
   * The rows a question folds to *are* the card, so they carry the card's own
   * column — and the same on both sides. The right was 8 against the left's
   * 16: the pencil sat half a column nearer its edge than the badge sat to
   * its own.
   */
  it("pads a question's card rows to the same column on both sides", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const card = await load("../QuestionCard/QuestionCard.module.css?raw");
    const group = await load("../QuestionGroup/QuestionGroup.module.css?raw");

    const column = px(tokens, "var(--ick-question-pad)");
    for (const [sheet, selector] of [
      [card, ".collapsed"],
      [card, ".upcoming"],
      [group, ".summary"],
    ] as const) {
      const pad = padding(tokens, sheet, selector);
      expect({ selector, ...pad }).toMatchObject({ left: column, right: column });
    }
  });

  /** And the title over them takes that same column, from both ends. */
  it("stands the group's title on the column its cards' content starts on", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const group = await load("../QuestionGroup/QuestionGroup.module.css?raw");
    const card = await load("../QuestionCard/QuestionCard.module.css?raw");

    const inset = px(tokens, decl(group, ".group", "--ick-disclosure-inset"));
    expect(inset).toBe(padding(tokens, card, ".collapsed").left);
    expect(inset).toBeGreaterThan(0);
  });

  /**
   * No wash under the title. It is a rounded box the width of the header and
   * there is no box under it for that shape to agree with, so on hover it read
   * as a stray highlight sitting off the card grid. The chevron lighting up is
   * the response instead — which is also why the hover is a token rather than
   * a rule deleted here: five other headers still want theirs.
   */
  it("answers a hover on the section title without painting a box", async () => {
    const group = await load("../QuestionGroup/QuestionGroup.module.css?raw");
    const css = await load("../disclosure/DisclosureHeader.module.css?raw");

    expect(decl(group, ".group", "--ick-disclosure-hover")).toBe("transparent");
    expect(decl(css, ".header:hover", "background")).toBe("var(--ick-disclosure-hover)");
    expect(css).toMatch(/\.header:hover \.chevron\s*\{[^}]*color:\s*var\(--ick-ink\)/);
  });
});
