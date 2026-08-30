import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { AnswerActions } from "../AnswerActions/AnswerActions";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import type { ChatTurn } from "../useChatTurns/useChatTurns";

const TEXT = "Particle physics studies the most fundamental constituents of matter.";

describe("what is drawn", () => {
  /**
   * A button that reports to nowhere is worse than a missing one: it looks
   * like a feature and behaves like a dead end.
   */
  it("offers only copy when there is nowhere else to report", () => {
    render(<AnswerActions text={TEXT} />);
    expect(screen.getByRole("button", { name: "Copy answer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Good answer" })).not.toBeInTheDocument();
  });

  it("draws regenerate when there is a handler for it", () => {
    render(<AnswerActions text={TEXT} onRegenerate={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
  });

  it("draws both thumbs when there is a handler for them", () => {
    render(<AnswerActions text={TEXT} onFeedback={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Good answer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bad answer" })).toBeInTheDocument();
  });

  it("takes labels of its own", () => {
    render(<AnswerActions text={TEXT} labels={{ copy: "Kopiraj" }} />);
    expect(screen.getByRole("button", { name: "Kopiraj" })).toBeInTheDocument();
  });

  it("takes extra controls after its own", () => {
    render(
      <AnswerActions text={TEXT}>
        <button type="button">Share</button>
      </AnswerActions>
    );
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });
});

describe("copying", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("hands over the answer", () => {
    const onCopy = vi.fn();
    render(<AnswerActions text={TEXT} onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy answer" }));
    expect(onCopy).toHaveBeenCalledWith(TEXT);
  });

  it("confirms, then goes back", () => {
    render(<AnswerActions text={TEXT} onCopy={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy answer" }));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1700));
    expect(screen.getByRole("button", { name: "Copy answer" })).toBeInTheDocument();
  });

  /** The tick is a picture; a reader who cannot see it is told nothing. */
  it("says so out loud", () => {
    render(<AnswerActions text={TEXT} onCopy={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy answer" }));
    act(() => void vi.advanceTimersByTime(200));
    expect(document.body.textContent).toContain("Copied");
  });
});

describe("the verdict", () => {
  it("reports which way", () => {
    const onFeedback = vi.fn();
    render(<AnswerActions text={TEXT} onFeedback={onFeedback} />);
    fireEvent.click(screen.getByRole("button", { name: "Good answer" }));
    expect(onFeedback).toHaveBeenCalledWith("up");

    fireEvent.click(screen.getByRole("button", { name: "Bad answer" }));
    expect(onFeedback).toHaveBeenLastCalledWith("down");
  });

  /** Pressing the one already given is how somebody takes it back. */
  it("reports null when the same one is pressed again", () => {
    const onFeedback = vi.fn();
    render(<AnswerActions text={TEXT} feedback="up" onFeedback={onFeedback} />);
    fireEvent.click(screen.getByRole("button", { name: "Good answer" }));
    expect(onFeedback).toHaveBeenCalledWith(null);
  });

  it("says which one is pressed, and only that one", () => {
    render(<AnswerActions text={TEXT} feedback="down" onFeedback={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Bad answer" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Good answer" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("regenerating", () => {
  it("calls back", () => {
    const onRegenerate = vi.fn();
    render(<AnswerActions text={TEXT} onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  it("refuses a second press while it is already going", () => {
    const onRegenerate = vi.fn();
    render(<AnswerActions text={TEXT} onRegenerate={onRegenerate} busy />);
    const button = screen.getByRole("button", { name: "Regenerate" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onRegenerate).not.toHaveBeenCalled();
  });
});

describe("inside a turn", () => {
  const turn = (over: Partial<ChatTurn> = {}): ChatTurn => ({
    id: "t1",
    user: "What does particle physics study?",
    ai: TEXT,
    parts: [],
    state: "resting",
    ...over,
  });

  it("appears under a settled answer", () => {
    render(<ChatTurnRow turn={turn()} />);
    expect(screen.getByRole("button", { name: "Copy answer" })).toBeInTheDocument();
  });

  /**
   * Offering to copy a half-written answer, or to rate one, is offering the
   * wrong thing. They wait for it to settle.
   */
  it("stays away while the answer is still arriving", () => {
    render(<ChatTurnRow turn={turn({ state: "responding" })} />);
    expect(screen.queryByRole("button", { name: "Copy answer" })).not.toBeInTheDocument();
  });

  it("stays away when there is no answer at all", () => {
    render(<ChatTurnRow turn={turn({ ai: "", state: "idle" })} isActiveInput />);
    expect(screen.queryByRole("button", { name: "Copy answer" })).not.toBeInTheDocument();
  });

  it("can be left out", () => {
    render(<ChatTurnRow turn={turn()} answerActions={false} />);
    expect(screen.queryByRole("button", { name: "Copy answer" })).not.toBeInTheDocument();
  });

  it("passes the turn's id back with the verdict", () => {
    const onFeedback = vi.fn();
    render(<ChatTurnRow turn={turn()} onFeedback={onFeedback} />);
    fireEvent.click(screen.getByRole("button", { name: "Good answer" }));
    expect(onFeedback).toHaveBeenCalledWith("t1", "up");
  });

  it("passes the turn's id back when regenerating", () => {
    const onRegenerate = vi.fn();
    render(<ChatTurnRow turn={turn()} onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRegenerate).toHaveBeenCalledWith("t1");
  });
});
