import { describe, it, expect } from "vitest";

/**
 * Two shimmers, one geometry.
 *
 * It was three. `Loader`, `Reasoning` and `ChainOfThought` drew the same
 * effect — a bright band slid across text and clipped to the glyphs — and the
 * same bug was in all of them: the band spent two thirds of every cycle off
 * the words, so most of the time it was a static grey line pretending to be
 * busy. Fixing it meant fixing it three times.
 *
 * Two of the three were the same header, and they are one component now, so
 * the shimmer under a disclosure's label is written once. `Loader`'s is still
 * its own — it shimmers a row of dots rather than a word, and it marks itself
 * `aria-hidden` where the label is a control's name.
 *
 * Which is the risk this still pins. Nothing makes the next person fixing one
 * look at the other, so the numbers are compared here instead.
 */
const sheet = async (path: string) =>
  ((await import(/* @vite-ignore */ path)).default as string).replace(/\/\*[\s\S]*?\*\//g, "");

const geometry = (css: string) => ({
  size: css.match(/background-size:\s*([^;]+);/)?.[1]?.trim(),
  from: css.match(/from\s*\{\s*background-position:\s*([^;]+);/)?.[1]?.trim(),
  to: css.match(/to\s*\{\s*background-position:\s*([^;]+);/)?.[1]?.trim(),
  duration: css.match(/animation:\s*sweep\s+([\d.]+m?s)/)?.[1],
});

describe("the shimmer", () => {
  it("sweeps the same way in every component that draws one", async () => {
    const loader = geometry(await sheet("../Loader/Loader.module.css?raw"));
    expect(loader.size, "no background-size found in Loader").toBeTruthy();

    for (const [name, path] of [
      ["DisclosureHeader", "../disclosure/DisclosureHeader.module.css?raw"],
    ] as const) {
      expect(geometry(await sheet(path)), `${name} drifted from Loader`).toEqual(loader);
    }
  });

  /**
   * The band has to cross the words and little else. With the image twice the
   * element, the bright stop at 50% of it sits one element-width in, so
   * position 100% puts it on the left edge and 0% on the right. Travel much
   * beyond that and the highlight is off the text, which is where the dead
   * two thirds came from.
   */
  it("travels the width of the words and not much further", async () => {
    const css = await sheet("../disclosure/DisclosureHeader.module.css?raw");
    const { size, from, to } = geometry(css);
    const pct = (v?: string) => Number(v?.match(/^(-?[\d.]+)%/)?.[1]);

    expect(pct(size), "the maths below assumes a background twice the element").toBe(200);
    const travel = pct(from) - pct(to);
    // 100 crosses the word exactly; the slack is the overshoot that keeps the
    // highlight from arriving and leaving on the letters themselves.
    expect(travel).toBeGreaterThanOrEqual(100);
    expect(travel).toBeLessThanOrEqual(140);
  });
});
