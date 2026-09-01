import { describe, it, expect } from "vitest";

/**
 * One stack of surfaces, used in one order.
 *
 *   ground   the recessed surface a group of things sits on
 *   card     an opaque panel raised on the ground
 *   inset    a row set into the card
 *
 * The question card worked this out first and then it stayed local to it,
 * which is how a tool call inside an approval ended up pale green: the tool's
 * own surface is a translucent grey, and a translucent panel on a tinted
 * ground wears the tint. Anything that nests boxes now names the same three.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

const load = async (path: string) =>
  strip((await import(/* @vite-ignore */ path)).default as string);

describe("the surface stack", () => {
  it("is named once, and the question card takes its three from it", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    for (const name of ["--ick-ground", "--ick-card", "--ick-inset"]) {
      expect(tokens, `${name} is defined nowhere`).toMatch(new RegExp(`${name}:`));
    }
    expect(tokens).toMatch(/--ick-question-surface:\s*var\(--ick-ground\)/);
    expect(tokens).toMatch(/--ick-question-card:\s*var\(--ick-card\)/);
    expect(tokens).toMatch(/--ick-question-row:\s*var\(--ick-inset\)/);
  });

  /**
   * The card is paper, and **opaque**. A translucent one picks up whatever it
   * is sitting on, which is the whole fault this guards: two greys three
   * percent apart are one surface in two shades, and a tinted ground showing
   * through a panel is a panel wearing the ground.
   */
  it("paints the card with paper rather than a mix of the ground", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    expect(tokens).toMatch(/--ick-card:\s*var\(--ick-surface\)/);
    // Inverted in the dark, where `--ick-surface` is the page itself.
    expect(tokens).toMatch(/--ick-dark-card:/);
    expect((tokens.match(/--ick-card:\s*var\(--ick-dark-card\)/g) ?? []).length).toBe(2);
  });

  /**
   * The ground goes **down**, in both themes.
   *
   * `--ick-ground` is a wash of ink, and ink in the dark is white — so the
   * recess a group of cards sits in came out *lighter* than the page, with the
   * card lighter again. Three surfaces stacked on the same side of the page.
   *
   * It did not show up as a number, because the number was fine: ground to
   * card measured 1.11 in the light and 1.115 in the dark, which is as matched
   * as two themes get. What the light has and the dark cannot is the shadow. A
   * dark shadow on a white ground is plainly visible and does half the work of
   * lifting a card off its ground; the same shadow on a near-black ground does
   * almost nothing. So in the dark the tone carries both jobs, and one job's
   * worth of tone is what 1.11 buys.
   *
   * Hence two rules, and the second is the one worth having: the dark's ground
   * is a shade rather than a wash of ink, and its separation from the card is
   * comfortably more than the light's, not equal to it.
   */
  it("cuts the dark ground into the page rather than lifting it off", async () => {
    const tokens = await load("../styles/tokens.css?raw");

    /* Ink in the dark is white; a ground washed with it is a raise. */
    expect(tokens).toMatch(/--ick-dark-ground:\s*rgb\(var\(--ick-glass-shade-rgb\)/);
    expect((tokens.match(/--ick-ground:\s*var\(--ick-dark-ground\)/g) ?? []).length).toBe(2);

    /** A grey token's channel value, 0–255. Every surface here is neutral. */
    const grey = (name: string): number => {
      const raw = tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim() as string;
      expect(raw, `${name} is defined nowhere`).toBeTruthy();
      const triplet = raw.match(/^(\d+) \d+ \d+$/);
      if (triplet) return Number(triplet[1]);
      const alias = raw.match(/^var\((--[\w-]+)\)$/)?.[1];
      if (alias) return grey(alias);
      /* `rgb(var(--x) / 0.45)` — a wash, which needs what it is over. */
      const wash = raw.match(/^rgb\(var\((--[\w-]+)\)\s*\/\s*([\d.]+)\)$/);
      if (wash) return Number.NaN; // resolved by `over` below
      /* `color-mix(in srgb, rgb(var(--a)) 91%, rgb(var(--b)))` */
      const mix = raw.match(
        /^color-mix\(\s*in srgb,\s*rgb\(var\((--[\w-]+)\)\)\s*([\d.]+)%,\s*rgb\(var\((--[\w-]+)\)\)\s*\)$/s
      );
      expect(mix, `cannot read ${name}: ${raw}`).toBeTruthy();
      const [, a, share, b] = mix as RegExpMatchArray;
      const w = Number(share) / 100;
      return grey(a) * w + grey(b) * (1 - w);
    };

    /** A wash composited over what is under it. */
    const over = (name: string, base: number): number => {
      const raw = tokens.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim() as string;
      const wash = raw.match(/^rgb\(var\((--[\w-]+)\)\s*\/\s*([\d.]+)\)$/);
      if (!wash) return grey(name);
      const [, ink, alpha] = wash;
      return base + Number(alpha) * (grey(ink) - base);
    };

    /** WCAG relative luminance of a neutral, and the ratio between two. */
    const lum = (v: number) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const ratio = (a: number, b: number) => {
      const [hi, lo] = [lum(a) + 0.05, lum(b) + 0.05].sort((x, y) => y - x);
      return hi / lo;
    };

    const light = {
      page: grey("--ick-paper-rgb"),
      get ground() {
        return over("--ick-ground", this.page);
      },
      card: grey("--ick-paper-rgb"),
    };
    const dark = {
      page: grey("--ick-dark-paper-rgb"),
      get ground() {
        return over("--ick-dark-ground", this.page);
      },
      card: grey("--ick-dark-card"),
    };

    /* Down from the page in the light, and down from it in the dark too. */
    expect(light.ground).toBeLessThan(light.page);
    expect(dark.ground).toBeLessThan(dark.page);
    /* And the card raised off it, which in the dark means lighter. */
    expect(dark.card).toBeGreaterThan(dark.ground);

    /* The one that matters: more tone in the dark, because there is no shadow
       there to make up the difference. The pair was at parity — 1.11 against
       1.11 — when this read as one surface in two shades.

       A fraction rather than a bare comparison, because "more" is satisfied by
       a hair — and most of the way there is bought by the direction alone.
       Simply not lifting the ground takes the pair from 1.11 to 1.25; the
       shade on top of that takes it to 1.32. So the floor has to sit above
       what the direction gives for free.

       There is not much room past it either: the page is 18 values off black,
       so even a ground of pure black only reaches 1.40. */
    const separation = {
      light: ratio(light.ground, light.card),
      dark: ratio(dark.ground, dark.card),
    };
    expect(separation.dark, JSON.stringify(separation)).toBeGreaterThan(separation.light * 1.15);

    /* And a real shade, not a token one — a quarter off the page at least. */
    expect(dark.ground).toBeLessThanOrEqual(dark.page * 0.75);
  });

  /**
   * And **opaque means opaque**, in both themes.
   *
   * The check above guarded the plumbing — that the card is wired to paper in
   * the light and to its own value in the dark — and never looked at what that
   * value was. It was `rgb(var(--ick-ink-rgb) / 0.09)`: a wash. On the page it
   * is indistinguishable from the mix; on an approval's tinted ground the card
   * and the code block inside it both came out olive. So the rule held in the
   * light, where the card is `#fff`, and was never true in the dark, which is
   * where it is easiest to see.
   *
   * An alpha channel on either of these two is the fault, whatever the number.
   */
  it.each(["--ick-card", "--ick-dark-card", "--ick-inset"])("gives %s no alpha", async (name) => {
    const tokens = await load("../styles/tokens.css?raw");

    const value = (token: string, seen = new Set<string>()): string => {
      expect(seen.has(token), `${token} refers to itself`).toBe(false);
      seen.add(token);
      const raw = tokens.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
      expect(raw, `${token} is defined nowhere`).toBeTruthy();
      const alias = (raw as string).match(/^var\((--[\w-]+)\)$/)?.[1];
      return alias ? value(alias, seen) : (raw as string);
    };

    /* `rgb(r g b / 0.09)` and `rgba(…, 0.09)` are both the fault; a
       `color-mix` of two opaque colours is not, and neither is a bare
       `rgb(var(--x))`. */
    const resolved = value(name).replace(/\s+/g, " ");
    expect(resolved, `${name} is translucent: ${resolved}`).not.toMatch(/\/\s*0?\.\d/);
    expect(resolved, `${name} is translucent: ${resolved}`).not.toMatch(/rgba\(/);
  });

  /**
   * Separation is surface and gap, not a line.
   *
   * The question card underlines nothing — a row is an inset panel with space
   * around it, and that is the whole of it. A tool call drew a rule under its
   * header and a code block drew one under its label, which with two sections
   * open made three stacked rules in a component the size of a paragraph, each
   * saying again what the surface had already said.
   *
   * A rule down the **side** is a different device and stays: `Reasoning` and
   * `ChainOfThought` use one to mark an aside, and `ChainOfThought`'s says
   * each step follows from the one above. Neither is separating stacked boxes.
   */
  it("separates stacked boxes with surface rather than a rule", async () => {
    for (const file of [
      "../Tool/Tool.module.css?raw",
      "../CodeBlock/CodeBlock.module.css?raw",
      "../QuestionCard/QuestionCard.module.css?raw",
      "../Approval/Approval.module.css?raw",
      "../TaskList/TaskList.module.css?raw",
      "../Sources/Sources.module.css?raw",
    ]) {
      const css = await load(file);
      const rules = css.match(/border-(?:top|bottom):\s*[^;]+;/g) ?? [];
      const drawn = rules.filter((r) => !/transparent|none|0/.test(r));
      expect(drawn, `${file} draws a rule between stacked boxes: ${drawn.join(" ")}`).toEqual([]);
    }
  });

  /**
   * A tool call is a card, the same object a question is. It used to be the
   * other way round — a recessed grey strip with white panels inside, which is
   * the same three surfaces stacked in the opposite order — and beside a
   * question card it read as a different system rather than the same one.
   */
  it("makes a tool call a card, like a question", async () => {
    const tokens = await load("../styles/tokens.css?raw");
    expect(tokens).toMatch(/--ick-tool-surface:\s*var\(--ick-card\)/);
    expect(tokens).toMatch(/--ick-tool-code-fill:\s*var\(--ick-inset\)/);

    const css = await load("../Tool/Tool.module.css?raw");
    expect(css, "a card on paper needs the lift, or it is not a card").toMatch(
      /box-shadow:\s*var\(--ick-tool-shadow\)/
    );
    // And a ground for it to be a card *on*, which is the other half.
    expect(tokens).toMatch(/--ick-tool-ground:\s*var\(--ick-ground\)/);
    expect(css).toMatch(/background:\s*var\(--ick-tool-ground\)/);
  });

  /**
   * An approval **is** the ground, so a tool call on it brings neither one of
   * its own nor a shadow. Two grounds is one more than there is depth for.
   */
  it("stops a tool call bringing a second ground into an approval", async () => {
    const css = await load("../Approval/Approval.module.css?raw");
    expect(css).toMatch(/--ick-tool-ground:\s*transparent/);
    expect(css).toMatch(/--ick-tool-ground-pad:\s*0px/);
    /* And none of its own surfaces either: the approval draws the card, the
       tool brings what goes in it. A tool call bringing its own card left two
       papers for one thing; bringing a card but no ground left its header
       stranded beside the title, two headers over one card. */
    expect(css).toMatch(/--ick-tool-surface:\s*transparent/);
    expect(css).toMatch(/--ick-tool-shadow:\s*none/);
  });
});

/**
 * An approval is the same object a question group is: a ground, with what asks
 * above the card and what answers below it.
 *
 * It has been both wrong ways round. First the tint was the ground and only
 * the tool call was on paper, with the title and the buttons loose. Then the
 * card wrapped all three — which put an approval holding a tool call at two
 * papers and two shadows for one thing, a card inside a card.
 *
 * The subject brings the card. The asking and the answering are not part of
 * the thing being approved, so they stand on the ground either side of it.
 */
describe("an approval", () => {
  const load = async (path: string) =>
    ((await import(/* @vite-ignore */ path)).default as string).replace(/\/\*[\s\S]*?\*\//g, "");

  it("is a ground, and paints nothing else", async () => {
    const css = await load("../Approval/Approval.module.css?raw");
    const rule = (selector: string) => {
      const at = css.search(new RegExp(`^\\${selector} \\{`, "m"));
      expect(at, `${selector} is missing`).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf("}", at));
    };
    expect(rule(".approval")).toMatch(/background:\s*var\(--ick-approval-surface\)/);
    /* And that surface is the kit's ground, not a colour of its own. The
       marker means "this one" — a badge, a stroke, a citation, a source's
       number — and a wash across a whole box meaning "this kind of box" is a
       second job for the one accent. */
    const tokens = await load("../styles/tokens.css?raw");
    expect(tokens).toMatch(/--ick-approval-surface:\s*var\(--ick-ground\)/);

    /* Exactly two surfaces: the ground, and the card around the subject. The
       title and the buttons paint nothing, because they are on the ground —
       and there is no third, which is what a card inside a card would be. */
    expect(css, "the approval's old wrapping card is gone").not.toMatch(/^\.card \{/m);
    const surfaces = css.match(/^\.(\w+)[^{]*\{[^}]*background:/gm) ?? [];
    expect(surfaces.map((m) => m.match(/^\.(\w+)/)?.[1])).toEqual(["approval", "subject"]);
    expect(rule(".subject")).toMatch(/background:\s*var\(--ick-card\)/);
    expect(rule(".subject")).toMatch(/box-shadow:\s*var\(--ick-shadow-float\)/);

    /* And no padding on it: whatever is inside is padded to the column
       already, so a gap here would push all of it off the line the title and
       the buttons stand on. */
    expect(rule(".subject"), "the subject pads nothing").not.toMatch(/padding:/);
  });

  /**
   * And what asks and what answers stand on the column the subject's own
   * content stands on — the shield where the tool's glyph is, the buttons
   * ending where its panels end.
   */
  it("puts the asking and the answering on the subject's column", async () => {
    const css = await load("../Approval/Approval.module.css?raw");
    const tokens = await load("../styles/tokens.css?raw");

    /* One column, read by all three, rather than three numbers that match. */
    for (const name of ["--ick-question-pad", "--ick-tool-pad", "--ick-approval-column"]) {
      expect(tokens, name).toMatch(new RegExp(`${name}:\\s*var\\(--ick-nest-column\\)`));
    }
    for (const selector of [".head", ".actions", ".settled"]) {
      const at = css.search(new RegExp(`^\\${selector} \\{`, "m"));
      expect(at, `${selector} is missing`).toBeGreaterThan(-1);
      expect(
        css.slice(at, css.indexOf("}", at)),
        `${selector} is off the column`
      ).toMatch(/padding:[^;]*var\(--ick-approval-column\)/);
    }

    /* And a subject that is not a tool call is pulled onto it too. */
    expect(css).toMatch(/--ick-code-pad:\s*var\(--ick-approval-column\)/);
  });
});

/**
 * One column down a tool call's body.
 *
 * A fenced value is a `CodeBlock` — its own panel, with its own inner padding.
 * A string value was a bare stack: no surface, no padding, so its label and
 * its text sat flush at the body's 8px while the block's sat at 12px inside
 * the block. Two sections of one tool call at two left edges, which is what
 * "the padding ran away at the bottom" looks like when the bottom one happens
 * to be the plain-text one.
 *
 * Both are panels now, both take `--ick-code-pad`, and the tool repoints that
 * to 8 so everything lands 16 from the card's edge — the column the header's
 * glyph is in. Measured in the browser once; pinned here, because jsdom has no
 * layout and the thing that can drift is which token each one reads.
 */
describe("a tool call's body", () => {
  const load = async (path: string) =>
    ((await import(/* @vite-ignore */ path)).default as string).replace(/\/\*[\s\S]*?\*\//g, "");

  const rule = (css: string, selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, `${selector} is missing`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };

  it("gives a text section and a code block the same inner padding", async () => {
    const tool = await load("../Tool/Tool.module.css?raw");
    const block = await load("../CodeBlock/CodeBlock.module.css?raw");

    /* The block reads it for both its bar and its code, so a label and the
       code under it cannot separate either. */
    expect(rule(block, ".bar")).toMatch(/var\(--ick-code-pad\)/);
    expect(rule(block, ".pre")).toMatch(/padding:\s*var\(--ick-code-pad\)/);

    /* And the section takes the same one, rather than a number of its own. */
    expect(rule(tool, ".section")).toMatch(/padding:[^;]*var\(--ick-code-pad\)/);
  });

  it("makes a text section the same panel a code block is", async () => {
    const tool = await load("../Tool/Tool.module.css?raw");
    const section = rule(tool, ".section");
    expect(section).toMatch(/background:\s*var\(--ick-tool-code-fill\)/);
    expect(section).toMatch(/border-radius:\s*var\(--ick-tool-inner-radius\)/);
  });

  /** And a failure is that panel tinted, not a second panel inside it. */
  it("tints the panel for an error rather than nesting one", async () => {
    const tool = await load("../Tool/Tool.module.css?raw");
    expect(tool).toMatch(/\.section\[data-tone="error"\]\s*\{[^}]*background:\s*var\(--ick-tool-error-surface\)/);
    expect(tool, "the nested error box is back").not.toMatch(/\n\.error \{/);
  });
});

/**
 * A shadow is darker than what it falls on. In both themes.
 *
 * The small ones were built on `--ick-ink-rgb`, which is near-black in the
 * light and `245 245 245` in the dark — so in the dark every `primary` and
 * `secondary` button cast a **white glow**. Measured: the outer layer of
 * `shadow-2` lifted the page from 18 to 40, brighter than the card it sat on.
 *
 * `--ick-glass-shade-rgb` is black in both themes, which is what a shadow is
 * made of. Anything ink-based needs a dark counterpart, and this is what says
 * so — the fault is silent otherwise, because in the light it looks perfect.
 */
describe("shadows fall dark", () => {
  it("gives every ink-based shadow a dark counterpart", async () => {
    const tokens = ((await import("../styles/tokens.css?raw")).default as string).replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );

    const declared = [...tokens.matchAll(/--ick-shadow-([\w-]+):\s*([^;]+);/g)];
    expect(declared.length).toBeGreaterThan(3);

    for (const [, name, value] of declared) {
      if (!/--ick-ink-rgb/.test(value)) continue;
      expect(
        tokens,
        `--ick-shadow-${name} is made of ink, so it turns into a glow in the dark ` +
          `unless --ick-dark-shadow-${name} overrides it`
      ).toMatch(new RegExp(`--ick-dark-shadow-${name}:`));
      expect(tokens).toMatch(
        new RegExp(`--ick-shadow-${name}:\\s*var\\(--ick-dark-shadow-${name}\\)`)
      );
    }
  });

  /** And the counterparts are made of the shade, which is black either way. */
  it("makes every dark shadow out of the shade rather than the ink", async () => {
    const tokens = ((await import("../styles/tokens.css?raw")).default as string).replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );
    for (const [, name, value] of tokens.matchAll(/--ick-dark-shadow-([\w-]+):\s*([^;]+);/g)) {
      expect(value, `--ick-dark-shadow-${name} is made of ink`).not.toMatch(/--ick-ink-rgb/);
    }
  });
});
