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
 *
 * The same goes for the boxes standing in those columns: a badge on the folded
 * row and a badge on the open one are a fold apart, and one of them was half
 * the size of the other.
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

/**
 * Where a rule for exactly this selector starts.
 *
 * Anchored to the start of a line, because a plain `indexOf` finds `.summary`
 * inside `.group[data-moving] .summary` too — and picked up a `will-change`
 * rule when it wanted the padding one.
 */
const ruleAt = (css: string, selector: string) => {
  const at = css.search(new RegExp(`^${selector.replace(/[.[\]]/g, "\\$&")}\\s*\\{`, "m"));
  expect(at, `${selector} is missing`).toBeGreaterThan(-1);
  return at;
};

/** A rule's `padding` shorthand, expanded the way the browser expands it. */
const padding = (tokens: string, css: string, selector: string, probes = {}) => {
  const at = ruleAt(css, selector);
  const raw = css.slice(at, css.indexOf("}", at)).match(/padding:\s*([^;]+);/)?.[1]?.trim();
  expect(raw, `${selector} has no padding`).toBeTruthy();
  const parts = split(raw as string).map((part) => px(tokens, part, probes));
  const [top, right = top, bottom = top, left = right] = parts;
  return { top, right, bottom, left };
};

/** One declaration out of a rule. */
const decl = (css: string, selector: string, property: string) => {
  const at = ruleAt(css, selector);
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
   * A tool call follows the same rule as a question group, because it is the
   * same rule: the header stands on the ground over the card, and its content
   * sits on the column the card's content sits on.
   *
   * The header used to be the card's own top edge, measured against the card's
   * *edges* — which is what put the chevron hard into the corner with nothing
   * under it to agree with.
   */
  it("stands a tool's header on the column its card's panels start on", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const tool = await load("../Tool/Tool.module.css?raw");

    const inset = px(tokens, decl(tool, ".tool", "--ick-disclosure-inset"));

    /* How the card actually reaches that column: its own padding plus the
       panel's. Computed rather than asserted as a number, so the day one of
       them moves this fails instead of quietly meaning something else. */
    const cardPad = px(tokens, split(decl(tool, ".bodyInner", "padding"))[1]);
    const panelPad = px(tokens, decl(tool, ".bodyInner", "--ick-code-pad"));
    expect(inset).toBe(cardPad + panelPad);

    /* The overview row *is* the card, so it takes the column as a padding. */
    const overview = padding(tokens, tool, ".overview");
    expect({ left: overview.left, right: overview.right }).toEqual({
      left: inset,
      right: inset,
    });

    /* And it is the column a question uses. One rule, not two that agree. */
    expect(inset).toBe(px(tokens, "var(--ick-question-pad)"));
  });

  /**
   * An approval asks above the card and answers below it, both on the column
   * the subject's own content stands on.
   *
   * And Deny is pulled back by its own padding, because a ghost button is
   * *text*: what you see is the word, and the invisible box around it is not
   * what belongs on a column. Measured, the word sat 16px inside the line the
   * shield above it is on. The two that say yes are the other way round —
   * filled, so the box is the visible thing and its edge is what lines up.
   */
  it("puts an approval's asking and answering on its subject's column", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const css = await load("../Approval/Approval.module.css?raw");

    const column = px(tokens, "var(--ick-approval-column)");
    expect(column).toBe(px(tokens, "var(--ick-tool-pad)"));

    for (const selector of [".head", ".actions", ".settled"]) {
      expect(padding(tokens, css, selector).left, selector).toBe(column);
    }

    /* The pull-back, and that it is exactly the button's own padding — not a
       number that happens to look right. `size="m"` is `--ick-space-6`. */
    const pull = px(tokens, decl(css, ".deny", "margin-left"));
    const button = await load("../Button/Button.module.css?raw");
    const buttonPad = split(decl(button, ".hasText.m", "padding"))[1];
    expect(pull).toBe(-px(tokens, buttonPad));
  });

  /**
   * A note between turns stands where a ground stands, so its words need the
   * ground's own padding *plus* the column to land where a card's words land.
   *
   * With only the column it measured 32 against a tool call's 48 — lined up
   * with the cards' edges instead of with the words in them, which is the one
   * alignment rule this kit has, stated backwards.
   */
  it("stands a system message's words on the column a card's words start on", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const css = await load("../SystemMessage/SystemMessage.module.css?raw");

    const pad = padding(tokens, css, ".message");
    const column = px(tokens, "var(--ick-nest-ground-pad)") + px(tokens, "var(--ick-nest-column)");
    expect({ left: pad.left, right: pad.right }).toEqual({ left: column, right: column });

    /* The same breathing a folded row has, so a one-liner sits at about its
       height. Not the same *line box*: the badge's box is for a label standing
       beside a badge, and nothing stands beside this — taking it anyway put
       1.85 of leading on every note that wraps. */
    const card = await load("../QuestionCard/QuestionCard.module.css?raw");
    expect(pad.top).toBe(padding(tokens, card, ".collapsed").top);
    expect(decl(css, ".message", "line-height"), "prose, not a badge's box").not.toMatch(
      /badge-size/
    );
  });

  /**
   * An artifact card stands on the turn's own edge, not on a ground.
   *
   * Every other ground in this kit carries something besides its card — a tool
   * call's carries the header, a question group's the title, an approval's the
   * asking and the answering. This one held a single card and nothing else,
   * which is not a surface, it is an indent. And it read as one: the answer's
   * prose ran along the turn's left edge while the card's words sat 32px
   * inside it, so the two halves of one answer were two columns.
   */
  it("puts nothing under an artifact card", async () => {
    const css = await load("../Artifact/ArtifactCard.module.css?raw");

    /* One surface in the file, and it is the card. */
    const surfaces = (css.match(/^\.(\w+)[^{]*\{[^}]*background:/gm) ?? []).map(
      (rule) => rule.match(/^\.(\w+)/)?.[1]
    );
    expect(surfaces, "the ground is gone").not.toContain("artifact");
    /* The card, and the three panels inset into it. Nothing under the card. */
    expect(new Set(surfaces)).toEqual(new Set(["card", "title", "preview", "text", "waiting"]));

    /* And the card is the root, so nothing insets it. */
    const source = await load("../Artifact/ArtifactCard.tsx?raw");
    expect(source).toMatch(/className: \[styles\.card, className/);
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
    const tool = await load("../Tool/Tool.module.css?raw");
    expect(decl(tool, ".tool", "--ick-disclosure-hover")).toBe("transparent");
    expect(decl(css, ".header:hover", "background")).toBe("var(--ick-disclosure-hover)");
    expect(css).toMatch(/\.header:hover \.chevron\s*\{[^}]*color:\s*var\(--ick-ink\)/);
  });
});

describe("baselines", () => {
  /**
   * Text beside a badge takes the badge's line box.
   *
   * A badge is 24 tall with `line-height: 1`; text beside it inherits whatever
   * line height its type gives it. Two line boxes of different heights, both
   * centred in the same row, land half a pixel apart — measured with a `Range`
   * over the actual text, the summary read 86.5 against the count's 87.
   *
   * The line box takes the badge's height rather than the badge taking a
   * margin: a margin is a guess that has to be re-guessed whenever the type
   * changes, and this way the two boxes are the same box. `.title` and
   * `.optionTitle` had the rule already; three labels had not taken it.
   */
  it.each([
    ["../QuestionCard/QuestionCard.module.css?raw", ".title"],
    ["../QuestionCard/QuestionCard.module.css?raw", ".optionTitle"],
    ["../QuestionCard/QuestionCard.module.css?raw", ".collapsedTitle"],
    ["../QuestionCard/QuestionCard.module.css?raw", ".upcomingLabel"],
    ["../QuestionGroup/QuestionGroup.module.css?raw", ".summaryList"],
  ])("gives %s's %s the badge's line box", async (sheet, selector) => {
    const css = await load(sheet);
    expect(decl(css, selector, "line-height")).toBe("var(--ick-badge-size)");
  });

  /** And the badge itself, and the chip, fill that box with one line. */
  it("centres a badge's own text in it", async () => {
    const card = await load("../QuestionCard/QuestionCard.module.css?raw");
    const chip = await load("../Chip/Chip.module.css?raw");
    const group = await load("../QuestionGroup/QuestionGroup.module.css?raw");
    for (const [css, selector] of [
      [card, ".badge"],
      [chip, ".chip"],
      [group, ".count"],
    ] as const) {
      expect(decl(css, selector, "line-height"), selector).toBe("1");
      expect(decl(css, selector, "align-items"), selector).toBe("center");
    }
  });
});

describe("badges", () => {
  /**
   * The count on a folded group is a badge — it stands in the badge column, on
   * a card, one fold away from the numbered badges it stands in for. It was a
   * pill: 2px of padding, the smallest type in the kit and the ground's fill,
   * which came out about half the height of every badge on the open group.
   */
  it("gives the folded group's count the badge's own box", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const card = await load("../QuestionCard/QuestionCard.module.css?raw");
    const group = await load("../QuestionGroup/QuestionGroup.module.css?raw");

    /* A badge is a square, so its height is the size token itself. */
    expect(decl(card, ".badge", "height")).toBe("var(--ick-badge-size)");
    expect(decl(group, ".count", "height")).toBe("var(--ick-badge-size)");
    expect(px(tokens, decl(group, ".count", "height"))).toBe(
      px(tokens, decl(card, ".badge", "height"))
    );

    for (const property of ["border-radius", "font-size", "line-height"]) {
      expect(decl(group, ".count", property), property).toBe(decl(card, ".badge", property));
    }

    /* And the fill a badge takes when it is on a card, which the summary is. */
    expect(decl(group, ".count", "background")).toBe(
      decl(card, ".badge[data-on-card]", "background")
    );
  });

  /**
   * A chip corners like a badge. They sit in the same row — the numbered badge
   * at one end and the answer at the other — and a fully round pill beside an
   * 8px badge is two shapes for one level of the nesting chain.
   */
  it("builds an answer chip out of the badge beside it", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    const chip = await load("../Chip/Chip.module.css?raw");
    const card = await load("../QuestionCard/QuestionCard.module.css?raw");

    expect(px(tokens, decl(chip, ".chip", "border-radius"))).toBe(
      px(tokens, decl(card, ".badge", "border-radius"))
    );
    /* Through the chain, not by both happening to say 8px. */
    expect(px(tokens, "var(--ick-chip-radius)")).toBe(px(tokens, "var(--ick-nest-inner)"));

    /* And the same height. Measured across every state the card has, the chip
       was the one box in it that was not 24 — two pixels shorter than the
       badge at the other end of its own row. */
    expect(px(tokens, decl(chip, ".chip", "height"))).toBe(
      px(tokens, decl(card, ".badge", "height"))
    );
    /* From the badge's own token, so a host that resizes one resizes both. */
    expect(tokens).toMatch(/--ick-chip-height:\s*var\(--ick-badge-size\)/);
  });
});
