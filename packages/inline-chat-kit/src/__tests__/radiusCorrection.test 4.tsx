import { describe, it, expect } from "vitest";
import { useRef } from "react";
import { render, screen } from "@testing-library/react";
import { useCorrectedRadius } from "../radiusCorrection/useCorrectedRadius";

/**
 * A `layout` animation does not resize a box — it **scales** one, and a browser
 * scaling a box scales the corner with it.
 *
 * Measured on the question group opening a card: `scaleY` ran 0.932 → 1 while
 * `border-radius` stayed a flat 40px, painting a 40 × 37 ellipse that eased
 * back to a circle. Motion has a corrector for exactly this — it rewrites the
 * radius as `x% y%` against the projected box — but it only runs on values
 * Motion is *managing*, and a radius living in a CSS class is invisible to it.
 *
 * jsdom has no layout, so the correction itself cannot be checked here. What
 * is checked is the two halves that make it possible: the number gets read,
 * and it gets handed to Motion.
 */
/* The longhand, because **jsdom does not expand the shorthand**: given
   `border-radius: 40px` it reports `borderTopLeftRadius: "0"`. A browser
   expands it, which is why the correction itself was verified in one — this
   file checks the reading, not the painting. */
const Probe = ({ radius }: { radius: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const found = useCorrectedRadius(ref);
  return (
    <div ref={ref} style={{ borderTopLeftRadius: radius }} data-testid="box">
      {found === undefined ? "none" : String(found)}
    </div>
  );
};

describe("reading the corner", () => {
  it("reads it off the element, in pixels", () => {
    render(<Probe radius="40px" />);
    expect(screen.getByTestId("box")).toHaveTextContent("40");
  });

  /**
   * Read rather than hard-coded, because the corner is a token and a host may
   * retune it — a fixed 40 would correct somebody else's 12 to the wrong shape.
   */
  it("reads whatever the element actually has", () => {
    render(<Probe radius="12px" />);
    expect(screen.getByTestId("box")).toHaveTextContent("12");
  });

  /** A square corner is a real answer, and handing Motion a zero is harmless. */
  it("reads a square corner as zero rather than as nothing", () => {
    render(<Probe radius="0px" />);
    expect(screen.getByTestId("box")).toHaveTextContent("0");
  });
});

/**
 * The rule, rather than the discipline.
 *
 * Every box in the kit that carries a corner *and* animates its own layout has
 * to hand that corner to Motion. Adding a sixth one and forgetting is silent:
 * it animates perfectly and the corner breathes, which is what happened to
 * both of these for as long as they existed.
 */
describe("every layout-animated corner is handed over", () => {
  it.each([
    ["QuestionGroup", "../QuestionGroup/QuestionGroup.tsx?raw"],
    ["QuestionCard", "../QuestionCard/QuestionCard.tsx?raw"],
  ])("%s corrects its own", async (_name, path) => {
    const src = (await import(/* @vite-ignore */ path)).default as string;
    expect(src).toMatch(/useCorrectedRadius\(/);
    expect(src).toMatch(/style=\{\{\s*borderRadius:/);
  });
});
