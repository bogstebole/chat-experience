import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRANDS } from "../stories/brands";

/**
 * The claim this file exists to keep honest: a brand is a handful of tokens,
 * and it can be applied to a subtree rather than only to the page.
 *
 * The rendering half is in Storybook, where it can be looked at. What is
 * pinned here is the structure that makes it possible, because it is the kind
 * of thing that regresses silently — nothing looks broken until somebody
 * tries to rebrand and finds that half their values do nothing.
 */
const TOKENS = readFileSync(join(import.meta.dirname, "..", "styles", "tokens.css"), "utf8");

describe("a theme can be applied to a subtree", () => {
  /**
   * A derived token is substituted where it is *declared*, and the finished
   * value is what inherits — so overriding a channel further down the tree
   * changes nothing unless the derived tokens are declared there too. That is
   * what `.ick-theme` is for, and why every rule that declares them names it.
   */
  it("declares every token for `.ick-theme` as well as `:root`", () => {
    const rules = TOKENS.match(/(^|\n)\s*:root[^{]*\{/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);

    const missing = rules.filter((rule) => {
      const at = TOKENS.indexOf(rule);
      const selector = TOKENS.slice(at, TOKENS.indexOf("{", at));
      return !selector.includes(".ick-theme");
    });

    expect(
      missing,
      `these declare tokens for :root only, so a subtree cannot override them:\n${missing.join("")}`
    ).toEqual([]);
  });
});

describe("a brand is a handful of tokens", () => {
  it.each(BRANDS.map((b) => [b.name, b] as const))("%s stays under a dozen", (_name, brand) => {
    expect(Object.keys(brand.tokens).length).toBeLessThanOrEqual(12);
  });

  /**
   * A brand sets what a brand cares about — colour, type, shape. The moment
   * one has to reach for a component's own token to look right, the brand
   * tier is missing something and this says so.
   */
  it.each(BRANDS.map((b) => [b.name, b] as const))(
    "%s needs nothing component-specific",
    (_name, brand) => {
      const componentTier = Object.keys(brand.tokens).filter((token) =>
        /^--ick-(input|glass-fill|glass-edge|shadow-glass|marker-ink|cursor)/.test(token)
      );
      expect(componentTier).toEqual([]);
    }
  );

  it("uses only tokens the kit actually defines", () => {
    const unknown = BRANDS.flatMap((brand) =>
      Object.keys(brand.tokens).filter((token) => !TOKENS.includes(`${token}:`))
    );
    expect(unknown, `set by a brand but defined nowhere: ${unknown.join(", ")}`).toEqual([]);
  });
});
