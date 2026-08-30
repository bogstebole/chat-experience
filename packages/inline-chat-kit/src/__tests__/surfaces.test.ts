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
  });

  /** A card that already has a ground under it does not float off it as well. */
  it("stops a tool call floating once an approval gives it a ground", async () => {
    const css = await load("../Approval/Approval.module.css?raw");
    expect(css).toMatch(/--ick-tool-shadow:\s*none/);
  });
});
