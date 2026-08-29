import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../EmptyState/EmptyState";
import { Loader } from "../Loader/Loader";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import type { ChatTurn } from "../useChatTurns/useChatTurns";

describe("the empty state", () => {
  it("shows what it is given", () => {
    render(<EmptyState title="Ask me anything" description="I know about particle physics." />);
    expect(screen.getByText("Ask me anything")).toBeInTheDocument();
    expect(screen.getByText("I know about particle physics.")).toBeInTheDocument();
  });

  it("renders nothing it was not given", () => {
    const { container } = render(<EmptyState />);
    expect(container.textContent).toBe("");
  });

  it("offers the openers, and reports which was taken", () => {
    const onSuggestion = vi.fn();
    render(<EmptyState suggestions={["What is a boson?", "Explain spin"]} onSuggestion={onSuggestion} />);
    fireEvent.click(screen.getByRole("button", { name: "Explain spin" }));
    expect(onSuggestion).toHaveBeenCalledWith("Explain spin");
  });

  /** A suggestion that goes nowhere is a button that does nothing. */
  it("draws no openers when there is nothing to do with them", () => {
    render(<EmptyState suggestions={["What is a boson?"]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("groups the openers under a name", () => {
    render(<EmptyState suggestions={["a"]} onSuggestion={vi.fn()} suggestionsLabel="Try one" />);
    expect(screen.getByRole("group", { name: "Try one" })).toBeInTheDocument();
  });

  /**
   * It sits inside a conversation the host already owns. Claiming a heading
   * level in somebody else's document is not ours to do.
   */
  it("is not a heading unless the host makes it one", () => {
    const { rerender } = render(<EmptyState title="Ask me anything" />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();

    rerender(<EmptyState title={<h2>Ask me anything</h2>} />);
    expect(screen.getByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});

describe("the loader", () => {
  /**
   * Decorative by default. `useChatTurns` already announces that a response is
   * coming, and a second live region means hearing it twice.
   */
  it("says nothing unless it is given something to say", () => {
    const { container, rerender } = render(<Loader />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    rerender(<Loader label="Thinking" />);
    expect(screen.getByRole("status")).toHaveTextContent("Thinking");
    expect(container.firstElementChild).not.toHaveAttribute("aria-hidden");
  });

  it("draws three dots", () => {
    const { container } = render(<Loader />);
    expect(container.querySelectorAll("span")).toHaveLength(3);
  });

  it("runs the shimmer through the words it is given", () => {
    render(<Loader variant="shimmer" label="Searching">Searching the archive</Loader>);
    expect(screen.getByText("Searching the archive")).toBeInTheDocument();
  });
});

describe("waiting for the first word", () => {
  const turn = (over: Partial<ChatTurn> = {}): ChatTurn => ({
    id: "t1",
    user: "What does particle physics study?",
    ai: "",
    state: "responding",
    ...over,
  });

  /** A question with a blank space under it reads as nothing having happened. */
  it("shows the loader once the question is sent", () => {
    const { container } = render(<ChatTurnRow turn={turn()} />);
    expect(container.querySelector("[aria-hidden='true']")).toBeInTheDocument();
  });

  it("drops it the moment the first word lands", () => {
    const { container, rerender } = render(<ChatTurnRow turn={turn()} />);
    const dots = () => container.querySelectorAll("span[class*='dot']").length;
    expect(dots()).toBe(3);

    rerender(<ChatTurnRow turn={turn({ ai: "Particle" })} />);
    expect(dots()).toBe(0);
  });

  it("is absent before anything is sent", () => {
    const { container } = render(<ChatTurnRow turn={turn({ state: "idle" })} isActiveInput />);
    expect(container.querySelectorAll("span[class*='dot']")).toHaveLength(0);
  });
});
