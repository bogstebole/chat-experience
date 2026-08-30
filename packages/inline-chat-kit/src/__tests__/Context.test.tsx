import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Context, formatCount } from "../Context/Context";

const meter = () => screen.getByRole("meter");

describe("the gauge", () => {
  it("reports where it is, as a value a screen reader can read without parsing prose", () => {
    render(<Context used={128_000} total={1_000_000} />);
    expect(meter()).toHaveAttribute("aria-valuenow", "13");
    expect(meter()).toHaveAttribute("aria-valuemin", "0");
    expect(meter()).toHaveAttribute("aria-valuemax", "100");
  });

  it("shows the percentage beside the ring, and nothing when told not to", () => {
    const { rerender } = render(<Context used={128_000} total={1_000_000} />);
    expect(screen.getByText("13%")).toBeInTheDocument();
    rerender(<Context used={128_000} total={1_000_000} label={false} />);
    expect(screen.queryByText("13%")).toBeNull();
  });

  it("takes a label of its own", () => {
    render(<Context used={128_000} total={1_000_000} label="128k / 1M" />);
    expect(screen.getByText("128k / 1M")).toBeInTheDocument();
  });

  /* A number climbing tells somebody nothing they can act on. */
  it("says what happens next once it is nearly full, not only that it is", () => {
    const { rerender } = render(<Context used={100_000} total={1_000_000} />);
    expect(meter()).toHaveAccessibleName(expect.stringContaining("10%"));
    expect(meter().getAttribute("aria-label")).not.toContain("dropping");

    rerender(<Context used={850_000} total={1_000_000} />);
    expect(meter().getAttribute("aria-label")).toContain("oldest messages will start dropping");
    expect(meter()).toHaveAttribute("data-warn");
  });

  it("takes the threshold where the host wants it", () => {
    const { rerender } = render(<Context used={600_000} total={1_000_000} />);
    expect(meter()).not.toHaveAttribute("data-warn");
    rerender(<Context used={600_000} total={1_000_000} warnAt={0.5} />);
    expect(meter()).toHaveAttribute("data-warn");
  });

  /* A total of zero is a window nobody has reported yet, not one that is full. */
  it("reads empty rather than full when there is no total", () => {
    render(<Context used={0} total={0} />);
    expect(meter()).toHaveAttribute("aria-valuenow", "0");
    expect(meter()).not.toHaveAttribute("data-warn");
  });

  /* A host summing its own tokens overshoots before it notices. */
  it("stops at full rather than going past it", () => {
    render(<Context used={1_400_000} total={1_000_000} />);
    expect(meter()).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("says the whole thing to a pointer as well, since a ring is a fraction and not advice", () => {
    render(<Context used={850_000} total={1_000_000} />);
    expect(meter().getAttribute("title")).toBe(meter().getAttribute("aria-label"));
  });
});

describe("formatCount", () => {
  it.each([
    [0, "0"],
    [42, "42"],
    [999, "999"],
    [1000, "1k"],
    [1500, "1.5k"],
    [128_000, "128k"],
    [1_000_000, "1M"],
    [1_250_000, "1.3M"],
    [12_000_000, "12M"],
  ])("turns %i into %s", (n, expected) => {
    expect(formatCount(n)).toBe(expected);
  });

  it("says nothing about a number it cannot show", () => {
    expect(formatCount(NaN)).toBe("");
    expect(formatCount(-1)).toBe("");
  });
});
