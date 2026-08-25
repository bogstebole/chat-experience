import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReplyThreadPopup } from "../ReplyThreadPopup/ReplyThreadPopup";

const anchorRect = () =>
  ({
    x: 100, y: 200, width: 240, height: 20,
    top: 200, left: 100, right: 340, bottom: 220,
    toJSON: () => ({}),
  }) as DOMRect;

const activeReply = { text: "the quoted passage", rect: anchorRect() };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

const setup = (props: Partial<React.ComponentProps<typeof ReplyThreadPopup>> = {}) => {
  const onClose = vi.fn();
  const utils = render(
    <ReplyThreadPopup
      activeReply={activeReply}
      onClose={onClose}
      onSendMessage={() => ""}
      {...props}
    />
  );
  const dialog = () => screen.getByRole("dialog");
  const focusables = () => [...dialog().querySelectorAll<HTMLElement>(FOCUSABLE)];
  return { ...utils, onClose, dialog, focusables };
};

describe("ReplyThreadPopup — it is a dialog", () => {
  it("says so", () => {
    const { dialog } = setup();
    expect(dialog()).toHaveAttribute("aria-modal", "true");
  });

  /**
   * Named by two nodes: a hidden phrase for meaning, and the visible passage
   * for which thread. Labelling it with the passage alone would announce a
   * sentence fragment with no explanation of what it belongs to.
   */
  it("is named for the passage it hangs off", () => {
    const { dialog } = setup();
    expect(dialog()).toHaveAccessibleName("Thread on the quoted passage");
  });

  it("keeps the close button reachable and named", () => {
    setup();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });
});

describe("ReplyThreadPopup — focus", () => {
  /** The input, not the panel: writing a reply is the only reason to be here. */
  it("lands in the thread's input", async () => {
    const { container } = setup();
    const editor = container.querySelector("[contenteditable]");
    await waitFor(() => expect(document.activeElement).toBe(editor));
  });

  it("gives focus back to whatever had it, when it closes", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = setup();
    await waitFor(() => expect(document.activeElement).not.toBe(trigger));

    unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("does not chase an element that has gone away in the meantime", async () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = setup();
    trigger.remove(); // the highlight it belonged to was deleted

    expect(() => unmount()).not.toThrow();
  });
});

describe("ReplyThreadPopup — the focus trap", () => {
  it("wraps from the last control back to the first", () => {
    const { focusables } = setup();
    const items = focusables();
    const last = items[items.length - 1];
    last.focus();

    fireEvent.keyDown(last, { key: "Tab" });

    expect(document.activeElement).toBe(items[0]);
  });

  it("wraps backwards from the first to the last", () => {
    const { focusables } = setup();
    const items = focusables();
    items[0].focus();

    fireEvent.keyDown(items[0], { key: "Shift", shiftKey: true });
    fireEvent.keyDown(items[0], { key: "Tab", shiftKey: true });

    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it("leaves tabbing between the controls in the middle alone", () => {
    const { focusables } = setup();
    const items = focusables();
    if (items.length < 3) return; // nothing in the middle to test
    items[1].focus();

    fireEvent.keyDown(items[1], { key: "Tab" });

    // The browser moves focus itself; the trap must not have interfered.
    expect(document.activeElement).toBe(items[1]);
  });
});

describe("ReplyThreadPopup — escape", () => {
  it("closes", () => {
    const { onClose, dialog } = setup();
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  /**
   * A highlight menu open on one of the thread's own answers takes Escape
   * first. If the dialog closed anyway, one press would dismiss both and the
   * reader would lose the thread they were reading.
   */
  it("leaves it alone when something inside has already used it", () => {
    const { onClose, container } = setup();
    const editor = container.querySelector("[contenteditable]") as HTMLElement;
    editor.addEventListener("keydown", (e) => e.preventDefault());

    fireEvent.keyDown(editor, { key: "Escape" });

    expect(onClose).not.toHaveBeenCalled();
  });
});
