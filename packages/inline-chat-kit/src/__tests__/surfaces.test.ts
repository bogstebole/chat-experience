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
    expect(css).toMatch(/--ick-tool-shadow:\s*none/);
  });
});

/**
 * An approval is the same object a question is: a ground holding a card
 * holding rows.
 *
 * It was not. The tint was the ground and the *only* thing on paper was the
 * tool call — so the title and the buttons sat directly on the ground, which
 * is a card in a box rather than a box with a card in it. Beside a question
 * card, where the header and the Next button are both on the card, it read as
 * a different arrangement of the same three surfaces.
 */
describe("an approval", () => {
  const load = async (path: string) =>
    ((await import(/* @vite-ignore */ path)).default as string).replace(/\/\*[\s\S]*?\*\//g, "");

  it("is a ground with a card on it", async () => {
    const css = await load("../Approval/Approval.module.css?raw");
    const rule = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
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
    expect(rule(".card")).toMatch(/background:\s*var\(--ick-card\)/);
    expect(rule(".card")).toMatch(/box-shadow:\s*var\(--ick-shadow-float\)/);
  });

  /**
   * And the tool call on that card is a **row**, not a second card. Two cards
   * stacked is one surface more than there is depth for — the same fault as
   * two grounds, from the other end.
   */
  it("makes the tool call a row on it rather than a card", async () => {
    const css = await load("../Approval/Approval.module.css?raw");
    expect(css).toMatch(/--ick-tool-surface:\s*var\(--ick-inset\)/);
    expect(css).toMatch(/--ick-tool-radius:\s*var\(--ick-nest-row\)/);
    expect(css).toMatch(/--ick-tool-shadow:\s*none/);
    expect(css).toMatch(/--ick-tool-ground:\s*transparent/);
  });
});
