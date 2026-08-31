import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import type { ChatTurn } from "../useChatTurns/useChatTurns";

const turn = (over: Partial<ChatTurn> = {}): ChatTurn => ({
  id: "t1",
  user: "What does particle physics study?",
  ai: "",
  parts: [],
  state: "idle",
  ...over,
});

describe("where the composer sits", () => {
  /* It is about to become the reader's own bubble, and those sit right. */
  it("sits at the right edge by default", () => {
    const { container } = render(<ChatTurnRow turn={turn()} isActiveInput />);
    expect(container.querySelector("[data-align]")).toHaveAttribute("data-align", "end");
  });

  /* On an empty conversation it is not a message on its way — it is the box
     under the openers, and a pill adrift at the right of a centred block reads
     as unrelated to it. */
  const composer = (container: HTMLElement) =>
    container.querySelector("[data-align] > *") as HTMLElement;

  it("fills the row when it is the opening composer", () => {
    const { container } = render(<ChatTurnRow turn={turn()} isActiveInput questionAlign="stretch" />);
    expect(container.querySelector("[data-align='stretch']")).not.toBeNull();
    // A flex child sizes to its content, so the input has to be told as well.
    expect(composer(container).style.width).toBe("100%");
  });

  it("leaves the input to its own width otherwise", () => {
    const { container } = render(<ChatTurnRow turn={turn()} isActiveInput />);
    expect(composer(container).style.width).toBe("");
  });
});

describe("what the row renders", () => {
  it("shows a composer for the question, and passes the placeholder through", () => {
    render(<ChatTurnRow turn={turn()} isActiveInput placeholder="Ask me anything" />);
    // Drawn by CSS from the attribute, and doubled as the accessible name —
    // there is no text node to look for.
    const editor = document.querySelector("[contenteditable]") as HTMLElement;
    expect(editor).toHaveAttribute("data-placeholder", "Ask me anything");
    expect(editor).toHaveAttribute("aria-label", "Ask me anything");
  });

  it("shows no answer until there is one", () => {
    const { container } = render(<ChatTurnRow turn={turn()} />);
    expect(container.querySelector('[data-cursor="marker"]')).toBeNull();
  });

  it("shows the answer once it arrives", () => {
    render(<ChatTurnRow turn={turn({ state: "resting", ai: "Matter, and the forces." })} />);
    expect(screen.getByText(/Matter/)).toBeInTheDocument();
  });

  it("carries an id a host can scroll to", () => {
    const { container } = render(<ChatTurnRow turn={turn({ id: "abc" })} />);
    expect(container.querySelector("#turn-abc")).toBeInTheDocument();
  });

  it("takes a className without dropping its own", () => {
    const { container } = render(<ChatTurnRow turn={turn()} className="mine" />);
    const article = container.querySelector("article")!;
    expect(article.className).toContain("mine");
    expect(article.className.split(/\s+/).length).toBeGreaterThan(1);
  });
});

describe("what it says while it works", () => {
  it("is busy while the answer is arriving", () => {
    const { container } = render(<ChatTurnRow turn={turn({ state: "responding", ai: "Ma" })} />);
    expect(container.querySelector("article")).toHaveAttribute("aria-busy", "true");
  });

  /** Stated only while true. A permanent `aria-busy="false"` is noise. */
  it("is not busy once it settles", () => {
    const { container } = render(<ChatTurnRow turn={turn({ state: "resting", ai: "Matter." })} />);
    expect(container.querySelector("article")).not.toHaveAttribute("aria-busy");
  });
});

describe("the callbacks", () => {
  it("reports a draft with the turn's id", () => {
    const onDraft = vi.fn();
    render(<ChatTurnRow turn={turn({ user: "" })} isActiveInput onDraft={onDraft} />);
    const editor = document.querySelector("[contenteditable]") as HTMLElement;
    fireEvent.input(editor, { target: { textContent: "hi" } });
    expect(onDraft).toHaveBeenCalledWith("t1", expect.any(String));
  });

  it("submits with the turn's id", () => {
    const onSubmit = vi.fn();
    render(<ChatTurnRow turn={turn({ state: "typing" })} isActiveInput onSubmit={onSubmit} />);
    const editor = document.querySelector("[contenteditable]") as HTMLElement;
    fireEvent.keyDown(editor, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("t1", expect.any(String), []);
  });

  /**
   * Every handler is optional, and a row with none of them still renders.
   * A component that throws when a consumer leaves a callback off is a
   * component that cannot be tried out.
   */
  it("renders with no handlers at all", () => {
    expect(() =>
      render(<ChatTurnRow turn={turn({ state: "resting", ai: "Matter." })} />)
    ).not.toThrow();
  });
});

describe("editing", () => {
  /**
   * An input with an answer already under it is an edit, not a first draft —
   * the buttons have to say save and cancel rather than send.
   */
  it("is editing when there is already an answer beneath it", () => {
    render(<ChatTurnRow turn={turn({ state: "typing", ai: "Matter." })} />);
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
  });

  it("is not editing when the answer is still empty", () => {
    render(<ChatTurnRow turn={turn({ state: "typing", ai: "" })} isActiveInput />);
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });
});

describe("the memo, which is the reason this component exists", () => {
  /**
   * `useChatTurns` leaves untouched turns referentially identical when it
   * rewrites one of them. That only pays off if the row acts on it — measured
   * before the memo: streaming a second answer produced 366 DOM mutations
   * inside the first, already-finished turn.
   */
  it("skips a re-render when the turn object has not changed", () => {
    const settled = turn({ state: "resting", ai: "Matter, and the forces." });
    const { container, rerender } = render(<ChatTurnRow turn={settled} entranceDelay={0} />);
    const answer = container.querySelector('[data-cursor="marker"]')!;

    const seen: string[] = [];
    const observer = new MutationObserver((records) =>
      records.forEach((r) => seen.push(r.type))
    );
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    // Same object, new element: exactly what a parent flush looks like.
    rerender(<ChatTurnRow turn={settled} entranceDelay={0} />);
    observer.disconnect();

    expect(seen).toEqual([]);
    expect(container.querySelector('[data-cursor="marker"]')).toBe(answer);
  });

  it("does re-render when the turn actually changes", () => {
    const { container, rerender } = render(
      <ChatTurnRow turn={turn({ state: "responding", ai: "Matter" })} />
    );
    rerender(<ChatTurnRow turn={turn({ state: "responding", ai: "Matter, and forces" })} />);
    expect(container.textContent).toContain("and forces");
  });
});

describe("the live composer", () => {
  const turn: ChatTurn = {
    id: "t1",
    user: "",
    ai: "",
    parts: [],
    state: "idle",
  };

  /**
   * Which row is the one you type into is something only this component knows,
   * and its CSS-module class is hashed — a host cannot target it. So it says so
   * in an attribute.
   *
   * The case that needs it: a page fading the conversation off its bottom edge
   * has no way to exempt the composer, and washed out behind a gradient the box
   * reads as one you are not allowed to use.
   */
  it("says which row is the live one", () => {
    const { container, rerender } = render(<ChatTurnRow turn={turn} isActiveInput />);
    expect(container.querySelector("[data-active-input]")).not.toBeNull();

    rerender(<ChatTurnRow turn={turn} />);
    expect(container.querySelector("[data-active-input]")).toBeNull();
  });
});
