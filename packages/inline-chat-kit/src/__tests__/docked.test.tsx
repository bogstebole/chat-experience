import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatExperience } from "../ChatExperience/ChatExperience";
import { ChatInput } from "../ChatInput/ChatInput";
import { Conversation } from "../Conversation/Conversation";
import { useChatTurns, type SendHandler } from "../useChatTurns/useChatTurns";

/* A highlight needs a measurement; jsdom has no layout. See
   TextHighlighter.highlights.test.tsx. */
let rects: { mockRestore: () => void };
beforeEach(() => {
  rects = vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
    { left: 10, top: 20, width: 120, height: 16 },
  ] as unknown as DOMRectList);
});
afterEach(() => rects.mockRestore());

/**
 * The composer at the bottom.
 *
 * The kit's argument is that the input is the message. A docked composer
 * keeps that — the box at the bottom still becomes the bubble — and changes
 * where the box waits: at the bottom edge, always there, so the next question
 * can be typed while this one is being answered.
 */

/* An answer that does not finish until told to, so "while it is arriving" is
   a state a test can stand in. */
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const send: SendHandler = async function* () {
    yield "Odgovor ";
    await gate;
    yield "stiže.";
  };
  return { send, release };
};

describe("useChatTurns with nextTurn: at-send", () => {
  const setup = (send: SendHandler, nextTurn: "after-answer" | "at-send") =>
    renderHook(() => useChatTurns({ onSend: send, nextTurn, announcements: false }));

  it("opens the next input the moment a message is sent", async () => {
    const { send, release } = held();
    const { result } = setup(send, "at-send");
    const first = result.current.turns[0].id;
    act(() => result.current.submit(first, "Pitanje"));

    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[1]).toMatchObject({ state: "idle", user: "", ai: "" });

    release();
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    // Settling does not add a second one.
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[0].state).toBe("resting");
  });

  it("does not add a second input under one already being typed into", async () => {
    const { send, release } = held();
    const { result } = setup(send, "at-send");
    act(() => result.current.submit(result.current.turns[0].id, "Prvo"));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    act(() => result.current.setDraft(result.current.turns[1].id, "Drugo, još kucam"));

    release();
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[1]).toMatchObject({ user: "Drugo, još kucam", state: "typing" });
  });

  it("waits for the answer by default, as before", async () => {
    const { send, release } = held();
    const { result } = setup(send, "after-answer");
    act(() => result.current.submit(result.current.turns[0].id, "Pitanje"));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));
    expect(result.current.turns).toHaveLength(1);
    release();
    await waitFor(() => expect(result.current.turns).toHaveLength(2));
  });

  it("refuses a second send while an answer is in flight", async () => {
    const { send, release } = held();
    const onSend = vi.fn(send);
    const { result } = setup(onSend, "at-send");
    act(() => result.current.submit(result.current.turns[0].id, "Prvo"));
    await waitFor(() => expect(result.current.isStreaming).toBe(true));

    const next = result.current.turns[1].id;
    act(() => result.current.setDraft(next, "Drugo"));
    act(() => result.current.submit(next));
    expect(onSend).toHaveBeenCalledTimes(1);
    // What was typed is still there, waiting.
    expect(result.current.turns[1]).toMatchObject({ user: "Drugo", state: "typing" });

    release();
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    act(() => result.current.submit(next));
    await waitFor(() => expect(onSend).toHaveBeenCalledTimes(2));
  });
});

describe("a busy composer", () => {
  const setup = (over: Partial<React.ComponentProps<typeof ChatInput>> = {}) => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    const utils = render(
      <ChatInput state="typing" value="Sledeće pitanje" onChange={() => {}} onSubmit={onSubmit} {...over} />
    );
    const editor = utils.container.querySelector("[contenteditable]") as HTMLElement;
    return { ...utils, editor, onSubmit, onStop };
  };

  it("does not send on Enter, and keeps what was typed", async () => {
    const user = userEvent.setup();
    const { editor, onSubmit } = setup({ busy: true });
    editor.focus();
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(editor.textContent).toBe("Sledeće pitanje");
  });

  it("offers a stop where the send was, when there is one", () => {
    const onStop = vi.fn();
    const { onSubmit } = setup({ busy: true, onStop });
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop response" }));
    expect(onStop).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("holds the send, inert, when there is nothing to stop with", () => {
    setup({ busy: true });
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toBeDisabled();
  });

  it("sends again once it is no longer busy", () => {
    const { rerender, onSubmit } = setup({ busy: true, onStop: vi.fn() });
    rerender(
      <ChatInput state="typing" value="Sledeće pitanje" onChange={() => {}} onSubmit={onSubmit} busy={false} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).toHaveBeenCalledWith("Sledeće pitanje", []);
  });

  /* A stop that stops nothing was drawn on every responding bubble whose host
     had not wired one. */
  it("draws no stop on a responding bubble that has nothing to report to", () => {
    render(<ChatInput state="responding" value="Pitanje" onChange={() => {}} onSubmit={() => {}} />);
    expect(screen.queryByRole("button", { name: "Stop response" })).toBeNull();
  });
});

describe("a docked conversation", () => {
  it("marks its last child as the dock", () => {
    const { container } = render(
      <Conversation dock>
        <div>jedan</div>
        <div>dva</div>
      </Conversation>
    );
    const docks = container.querySelectorAll("[data-dock]");
    // On the root, for the way-back button, and on the content, for the child.
    expect(docks).toHaveLength(2);
    expect(docks[1].lastElementChild).toHaveTextContent("dva");
  });

  it("is not a dock unless asked", () => {
    const { container } = render(
      <Conversation>
        <div>jedan</div>
      </Conversation>
    );
    expect(container.querySelector("[data-dock]")).toBeNull();
  });
});

describe("ChatExperience with a docked composer", () => {
  const setup = (send: SendHandler = () => "Odgovor.") =>
    render(
      <ChatExperience
        onSend={send}
        composer="docked"
        headerActions={false}
        empty={{ title: "Zdravo", suggestions: ["Pitanje"] }}
      />
    );

  it("says so on the page, and docks the conversation", () => {
    const { container } = setup();
    expect(container.querySelector('[data-composer="docked"]')).not.toBeNull();
    // The content wrapper, inside the root that carries the same mark.
    const dock = container.querySelector("[data-dock] [data-dock]");
    expect(dock).not.toBeNull();
    // The composer is the last thing in the conversation, stretched to it.
    const composer = dock!.lastElementChild!;
    expect(composer).toHaveAttribute("data-active-input");
    expect(composer.querySelector("[data-align]")).toHaveAttribute("data-align", "stretch");
  });

  it("keeps a composer at the bottom while the answer arrives, busy, with a stop", async () => {
    const { send, release } = held();
    const { container } = setup(send);
    fireEvent.click(screen.getByRole("button", { name: "Pitanje" }));

    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(2));
    const rows = container.querySelectorAll("article");
    expect(rows[0]).toHaveAttribute("aria-busy", "true");
    expect(rows[1]).toHaveAttribute("data-active-input");
    // One stop, on the composer — not a second on the bubble being answered.
    expect(screen.getAllByRole("button", { name: "Stop response" })).toHaveLength(1);
    expect(rows[1].contains(screen.getByRole("button", { name: "Stop response" }))).toBe(true);

    release();
    await waitFor(() => expect(rows[0]).not.toHaveAttribute("aria-busy"));
    // The glyph leaves through an exit animation, so it is gone a beat later.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Stop response" })).toBeNull());
  });

  /* The same promise as inline: press send and your question goes to the top,
     with its answer written underneath. Only the composer stays put. */
  it("anchors the message it sent, and keeps the composer out of the anchor", async () => {
    const { send, release } = held();
    const { container } = setup(send);
    fireEvent.click(screen.getByRole("button", { name: "Pitanje" }));

    await waitFor(() => expect(container.querySelectorAll("article")).toHaveLength(2));
    const feed = container.querySelector("[data-dock] [data-dock]")!.parentElement!;
    const sent = container.querySelectorAll("article")[0];
    // `Conversation` is told to hold it, by the id the row carries.
    expect(feed.closest("[class]")).toBeTruthy();
    expect(sent.id).toMatch(/^turn-/);

    release();
    await waitFor(() => expect(sent).not.toHaveAttribute("aria-busy"));
  });

  it("is off by default", () => {
    const { container } = render(<ChatExperience onSend={() => ""} headerActions={false} />);
    expect(container.querySelector("[data-composer]")).toBeNull();
    expect(container.querySelector("[data-dock]")).toBeNull();
  });
});
