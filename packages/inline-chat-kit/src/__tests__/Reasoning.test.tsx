import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { Reasoning } from "../Reasoning/Reasoning";

const THINKING = "Two numbers matter here: the mass, and how well it is known.";

const header = () => screen.getByRole("button");

describe("while it thinks", () => {
  it("is open, because thinking is worth watching while it happens", () => {
    render(<Reasoning state="thinking">{THINKING}</Reasoning>);
    expect(header()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(THINKING)).toBeInTheDocument();
  });

  it("says it is thinking, and does not count at anybody", () => {
    render(<Reasoning state="thinking">{THINKING}</Reasoning>);
    expect(header()).toHaveAccessibleName(/Thinking/);
    expect(header().textContent).not.toMatch(/\d+\s*(ms|s)\b/);
  });
});

describe("once it is done", () => {
  it("folds away, since thinking is worth almost nothing afterwards", () => {
    const { rerender } = render(<Reasoning state="thinking">{THINKING}</Reasoning>);
    rerender(<Reasoning state="done">{THINKING}</Reasoning>);
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });

  /* Which is the point of folding rather than removing: the times the thinking
     matters are exactly the times the answer looks wrong. */
  it("is still there to open", () => {
    render(<Reasoning state="done">{THINKING}</Reasoning>);
    fireEvent.click(header());
    expect(screen.getByText(THINKING)).toBeInTheDocument();
  });

  it("keeps how long it took", () => {
    render(
      <Reasoning state="done" duration={12400}>
        {THINKING}
      </Reasoning>
    );
    expect(screen.getByText("Thought for 12s")).toBeInTheDocument();
  });

  it("says only that it thought, when nobody timed it", () => {
    render(<Reasoning state="done">{THINKING}</Reasoning>);
    expect(screen.getByText("Thought")).toBeInTheDocument();
  });

  it("controls an element that is there whether it is open or shut", () => {
    render(<Reasoning state="done">{THINKING}</Reasoning>);
    const id = header().getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)).not.toBeNull();
  });
});

describe("timing itself", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reads its own clock when it was not given one", () => {
    const { rerender } = render(<Reasoning state="thinking">{THINKING}</Reasoning>);
    act(() => {
      vi.advanceTimersByTime(3400);
    });
    rerender(<Reasoning state="done">{THINKING}</Reasoning>);
    expect(screen.getByText("Thought for 3.4s")).toBeInTheDocument();
  });

  /* A replayed transcript: the thinking did not happen just now, so the clock
     in this browser has nothing to say about it. */
  it("prefers the duration it was given over the one it measured", () => {
    const { rerender } = render(<Reasoning state="thinking">{THINKING}</Reasoning>);
    act(() => {
      vi.advanceTimersByTime(3400);
    });
    rerender(
      <Reasoning state="done" duration={12400}>
        {THINKING}
      </Reasoning>
    );
    expect(screen.getByText("Thought for 12s")).toBeInTheDocument();
  });

  it("starts again when it thinks again", () => {
    const { rerender } = render(<Reasoning state="thinking">{THINKING}</Reasoning>);
    act(() => vi.advanceTimersByTime(3400));
    rerender(<Reasoning state="done">{THINKING}</Reasoning>);
    expect(screen.getByText("Thought for 3.4s")).toBeInTheDocument();

    rerender(<Reasoning state="thinking">{THINKING}</Reasoning>);
    act(() => vi.advanceTimersByTime(1100));
    rerender(<Reasoning state="done">{THINKING}</Reasoning>);
    expect(screen.getByText("Thought for 1.1s")).toBeInTheDocument();
  });

  it("times nothing for a block that arrives already finished", () => {
    render(<Reasoning state="done">{THINKING}</Reasoning>);
    expect(screen.getByText("Thought")).toBeInTheDocument();
  });
});

describe("who decides whether it is open", () => {
  /* Folding is the block's preference, not something done to the reader. */
  it("stays open through the answer starting, if somebody opened it", () => {
    const { rerender } = render(<Reasoning state="thinking">{THINKING}</Reasoning>);
    fireEvent.click(header()); // shut
    fireEvent.click(header()); // and open again, deliberately
    rerender(<Reasoning state="done">{THINKING}</Reasoning>);
    expect(header()).toHaveAttribute("aria-expanded", "true");
  });

  it("stays shut through the answer starting, if somebody shut it", () => {
    const { rerender } = render(<Reasoning state="thinking">{THINKING}</Reasoning>);
    fireEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "false");
    rerender(<Reasoning state="thinking">{THINKING}</Reasoning>);
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });

  it("takes defaultOpen for a block that starts open and then looks after itself", () => {
    render(
      <Reasoning state="done" defaultOpen>
        {THINKING}
      </Reasoning>
    );
    expect(header()).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });

  it("reports the toggle and leaves the state to the host when controlled", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Reasoning state="done" open={false} onOpenChange={onOpenChange}>
        {THINKING}
      </Reasoning>
    );
    fireEvent.click(header());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(header()).toHaveAttribute("aria-expanded", "false");

    rerender(
      <Reasoning state="done" open onOpenChange={onOpenChange}>
        {THINKING}
      </Reasoning>
    );
    expect(header()).toHaveAttribute("aria-expanded", "true");
  });
});

describe("what it is given", () => {
  it("takes its labels in another language", () => {
    const { rerender } = render(
      <Reasoning state="thinking" labels={{ thinking: "Razmišljam" }}>
        {THINKING}
      </Reasoning>
    );
    expect(header()).toHaveAccessibleName(/Razmišljam/);

    rerender(
      <Reasoning state="done" duration={12400} labels={{ thoughtFor: "Razmišljao" }}>
        {THINKING}
      </Reasoning>
    );
    expect(screen.getByText("Razmišljao 12s")).toBeInTheDocument();
  });

  it("renders elements as readily as a string", () => {
    render(
      <Reasoning state="thinking">
        <p data-testid="mine">A paragraph somebody built</p>
      </Reasoning>
    );
    expect(screen.getByTestId("mine")).toBeInTheDocument();
  });
});
