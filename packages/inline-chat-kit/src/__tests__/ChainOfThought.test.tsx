import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ChainOfThought, type Thought } from "../ChainOfThought/ChainOfThought";

const STEPS: Thought[] = [
  { id: "a", label: "The question is about size", body: "And a point particle has none." },
  { id: "b", label: "Checked the measured value", body: "125.25 GeV." },
];

const header = () => screen.getAllByRole("button").find((b) => b.hasAttribute("aria-expanded"))!;

describe("what the chain says about itself", () => {
  it("counts its steps once it is done", () => {
    render(<ChainOfThought steps={STEPS} duration={4200} />);
    expect(screen.getByText("Thought through 2 steps")).toBeInTheDocument();
    expect(screen.getByText("4.2s")).toBeInTheDocument();
  });

  it("says one step in the singular", () => {
    render(<ChainOfThought steps={[STEPS[0]]} />);
    expect(screen.getByText("Thought through 1 step")).toBeInTheDocument();
  });

  /* The one question somebody watching is asking, and the reason to look at a
     folded chain at all. */
  it("narrates the step it is on while it thinks", () => {
    render(
      <ChainOfThought
        state="thinking"
        steps={[{ ...STEPS[0] }, { ...STEPS[1], state: "running" }]}
      />
    );
    expect(header()).toHaveAccessibleName(/Checked the measured value/);
  });

  it("falls back to the last step when none is marked running", () => {
    render(<ChainOfThought state="thinking" steps={STEPS} />);
    expect(header()).toHaveAccessibleName(/Checked the measured value/);
  });

  it("says nothing about a duration while it is still thinking", () => {
    render(<ChainOfThought state="thinking" steps={STEPS} duration={4200} />);
    expect(screen.queryByText("4.2s")).toBeNull();
  });
});

describe("the steps", () => {
  it("draws each one with its working", () => {
    render(<ChainOfThought steps={STEPS} defaultOpen />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("And a point particle has none.")).toBeInTheDocument();
  });

  it("draws a step with no working at all", () => {
    render(<ChainOfThought steps={[{ id: "a", label: "Just a step" }]} defaultOpen />);
    expect(screen.getByRole("listitem").textContent).toBe("Just a step");
  });

  it("treats a step with no state as one that happened", () => {
    render(<ChainOfThought steps={STEPS} defaultOpen />);
    expect(screen.getAllByRole("listitem")[0]).toHaveAttribute("data-state", "done");
  });

  it("says which one it is on, in a way that can be jumped to", () => {
    render(
      <ChainOfThought
        state="thinking"
        defaultOpen
        steps={[{ ...STEPS[0] }, { ...STEPS[1], state: "running" }]}
      />
    );
    const current = screen.getAllByRole("listitem").filter(
      (li) => li.getAttribute("aria-current") === "step"
    );
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Checked the measured value");
  });

  it("takes anything as a step's working, not only prose", () => {
    render(
      <ChainOfThought
        defaultOpen
        steps={[{ id: "a", label: "Looked it up", body: <figure data-testid="mine">a tool</figure> }]}
      />
    );
    expect(screen.getByTestId("mine")).toBeInTheDocument();
  });
});

describe("folding", () => {
  it("is open while it thinks and folded once it is done", () => {
    const { rerender } = render(<ChainOfThought state="thinking" steps={STEPS} />);
    expect(header()).toHaveAttribute("aria-expanded", "true");
    rerender(<ChainOfThought state="done" steps={STEPS} />);
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });

  /* The chain's preference, not something done to the reader. */
  it("stays where somebody put it", () => {
    const { rerender } = render(<ChainOfThought state="thinking" steps={STEPS} />);
    fireEvent.click(header());
    rerender(<ChainOfThought state="done" steps={STEPS} />);
    fireEvent.click(header());
    rerender(<ChainOfThought state="thinking" steps={STEPS} />);
    expect(header()).toHaveAttribute("aria-expanded", "true");
  });

  it("controls an element that is there whether it is open or shut", () => {
    render(<ChainOfThought steps={STEPS} />);
    const id = header().getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)).not.toBeNull();
  });

  it("reports the toggle and leaves the state to the host when controlled", () => {
    const onOpenChange = vi.fn();
    render(<ChainOfThought steps={STEPS} open={false} onOpenChange={onOpenChange} />);
    fireEvent.click(header());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });

  it("has nothing to open with no steps", () => {
    render(<ChainOfThought steps={[]} defaultOpen />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.getByText("Thought through 0 steps")).toBeInTheDocument();
  });

  it("takes its labels in another language", () => {
    render(
      <ChainOfThought steps={STEPS} labels={{ through: "Razmišljao kroz", steps: "koraka" }} />
    );
    expect(screen.getByText("Razmišljao kroz 2 koraka")).toBeInTheDocument();
  });
});
