import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemMessage } from "../SystemMessage/SystemMessage";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import type { ChatTurn } from "../useChatTurns/useChatTurns";

const turn = (over: Partial<ChatTurn> = {}): ChatTurn => ({
  id: "t1",
  user: "",
  ai: "",
  state: "idle",
  ...over,
});

describe("SystemMessage", () => {
  it("says the thing", () => {
    render(<SystemMessage>The oldest messages are dropping out of the window.</SystemMessage>);
    expect(screen.getByText(/oldest messages/)).toBeInTheDocument();
  });

  it("has two tones and defaults to the quiet one", () => {
    const { container, rerender } = render(<SystemMessage>Something</SystemMessage>);
    expect(container.firstElementChild).toHaveAttribute("data-tone", "notice");
    rerender(<SystemMessage tone="danger">Something</SystemMessage>);
    expect(container.firstElementChild).toHaveAttribute("data-tone", "danger");
  });

  /**
   * The reason the component exists in the shape it does. Every picture in this
   * kit carries a state the words beside it also carry, so a reader the picture
   * does not reach loses nothing. An icon here would carry "something is being
   * announced" beside a sentence announcing it — which is what the approval's
   * shield was doing before it came off.
   */
  it("draws no picture of its own", () => {
    const { container } = render(<SystemMessage tone="danger">Lost the connection.</SystemMessage>);
    expect(container.querySelectorAll("svg")).toHaveLength(0);
  });

  /**
   * The kit has one live region, shared and written to on a later tick. A
   * second one says everything twice, which is the fault that region exists to
   * have fixed — so this is transcript content and nothing more.
   */
  it("does not open a second live region", () => {
    const { container } = render(<SystemMessage>Something happened.</SystemMessage>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("aria-live")).toBeNull();
    expect(el.getAttribute("role")).toBeNull();
  });
});

describe("a notice in a turn", () => {
  it("reaches a conversation as a part", () => {
    render(
      <ChatTurnRow
        turn={turn({
          parts: [
            { kind: "notice", id: "n1", text: "The model changed partway through this answer." },
          ],
        })}
      />
    );
    expect(screen.getByText(/model changed/)).toBeInTheDocument();
  });

  it("carries its tone through", () => {
    const { container } = render(
      <ChatTurnRow
        turn={turn({
          parts: [{ kind: "notice", id: "n1", text: "Lost the connection.", tone: "danger" }],
        })}
      />
    );
    expect(container.querySelector('[data-tone="danger"]')).toBeInTheDocument();
  });
});
