import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReplyThreadPopup } from "../ReplyThreadPopup/ReplyThreadPopup";
import { placePanel } from "../ReplyThreadPopup/placePanel";

const anchorRect = () =>
  ({
    x: 100,
    y: 200,
    width: 240,
    height: 20,
    top: 200,
    left: 100,
    right: 340,
    bottom: 220,
    toJSON: () => ({}),
  }) as DOMRect;

const activeReply = { text: "the quoted passage", rect: anchorRect() };

describe("ReplyThreadPopup", () => {
  it("shows the passage the thread hangs off", () => {
    render(<ReplyThreadPopup activeReply={activeReply} onClose={vi.fn()} onSendMessage={() => ""} />);
    expect(screen.getByText("the quoted passage")).toBeInTheDocument();
  });

  it("closes when asked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ReplyThreadPopup activeReply={activeReply} onClose={onClose} onSendMessage={() => ""} />);

    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(onClose).toHaveBeenCalled();
  });

  it("offers an input for the reply", () => {
    const { container } = render(
      <ReplyThreadPopup activeReply={activeReply} onClose={vi.fn()} onSendMessage={() => ""} />
    );
    expect(container.querySelector("[contenteditable]")).toBeInTheDocument();
  });
});

describe("ReplyThreadPopup — onSendMessage", () => {
  /**
   * Without this prop the popup streams canned placeholder copy. That is demo
   * behaviour, and a consumer wiring it to a real backend needs the hook to be
   * used in preference — otherwise their answers are silently replaced by text
   * about particle physics.
   */
  it("asks the consumer for the reply, and quotes the passage back to them", async () => {
    const onSendMessage = vi.fn().mockResolvedValue("an answer from the host app");
    const { container } = render(
      <ReplyThreadPopup activeReply={activeReply} onClose={vi.fn()} onSendMessage={onSendMessage} />
    );

    const editor = container.querySelector("[contenteditable]") as HTMLElement;
    editor.textContent = "a question in the thread";
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() => expect(onSendMessage).toHaveBeenCalled());
    expect(onSendMessage).toHaveBeenCalledWith(
      "a question in the thread",
      "the quoted passage",
      expect.objectContaining({ signal: expect.any(AbortSignal), turnId: expect.any(String) })
    );
  });

  it("accepts a synchronous reply as readily as a promise", async () => {
    const onSendMessage = vi.fn().mockReturnValue("answered synchronously");
    const { container } = render(
      <ReplyThreadPopup activeReply={activeReply} onClose={vi.fn()} onSendMessage={onSendMessage} />
    );

    const editor = container.querySelector("[contenteditable]") as HTMLElement;
    editor.textContent = "sync please";
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() =>
      expect(onSendMessage).toHaveBeenCalledWith(
        "sync please",
        "the quoted passage",
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    );
  });

  it("does not fall back to canned copy once the hook is supplied", async () => {
    const onSendMessage = vi.fn().mockResolvedValue("host answer");
    const { container } = render(
      <ReplyThreadPopup activeReply={activeReply} onClose={vi.fn()} onSendMessage={onSendMessage} />
    );

    const editor = container.querySelector("[contenteditable]") as HTMLElement;
    editor.textContent = "question";
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: "Enter" });

    await waitFor(() => expect(onSendMessage).toHaveBeenCalled());
    expect(screen.queryByText(/simulated response/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Standard Model/i)).not.toBeInTheDocument();
  });
});

/**
 * The placement, on its own.
 *
 * Not through the rendered panel: its geometry reaches the DOM through
 * Motion's `animate`, and Motion never finishes an animation under jsdom, so
 * `panel.style.left` holds the `initial` value — the anchor — for ever. The
 * first version of this guard read exactly that and passed against the broken
 * arithmetic it was written to catch.
 */
describe("placePanel", () => {
  const anchor = { left: 100, top: 200, width: 240 };

  it.each([320, 390, 414, 520, 768, 1280])("keeps both edges on a %ipx screen", (screen) => {
    const { x, width } = placePanel(anchor, screen);
    expect(x, `left edge on ${screen}px`).toBeGreaterThanOrEqual(0);
    expect(x + width, `right edge on ${screen}px`).toBeLessThanOrEqual(screen);
  });

  /* The exact case that shipped broken. */
  it("does not put the panel at a negative x on a phone", () => {
    expect(placePanel(anchor, 390).x).toBe(24);
  });

  it("narrows only when it has to", () => {
    /* Room for its ideal width, so it takes it. */
    expect(placePanel(anchor, 1280).width).toBe(480);
    /* 390 - 48 of padding. */
    expect(placePanel(anchor, 390).width).toBe(342);
  });

  it("centres on the passage where there is room to", () => {
    const { x, width } = placePanel({ left: 500, top: 200, width: 240 }, 1280);
    expect(x + width / 2).toBe(500 + 120);
  });

  /* A phrase marked in the first line of an answer. */
  it("does not open above the top of the screen", () => {
    expect(placePanel({ left: 100, top: 8, width: 240 }, 390, 844).y).toBe(24);
  });
});
