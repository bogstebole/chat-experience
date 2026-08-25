import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReplyThreadPopup } from "../ReplyThreadPopup/ReplyThreadPopup";

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
