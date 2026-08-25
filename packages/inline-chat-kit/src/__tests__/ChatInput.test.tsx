import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatInput, type ChatInputHandle, type ChatInputProps } from "../ChatInput/ChatInput";

/**
 * ChatInput is fully controlled, so almost everything worth guaranteeing is
 * about the contract with the parent: what it calls, when, and with what.
 * Those hold in jsdom. Anything that depends on measurement — the wrap
 * thresholds, the overflow fade — does not, and is left to the playground
 * rather than faked into a green tick here.
 */
const setup = (props: Partial<ChatInputProps> = {}) => {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const onStop = vi.fn();
  const utils = render(
    <ChatInput
      state="idle"
      value=""
      onChange={onChange}
      onSubmit={onSubmit}
      onStop={onStop}
      placeholder="Ask me anything"
      {...props}
    />
  );
  const editor = utils.container.querySelector("[contenteditable]") as HTMLElement;
  return { ...utils, editor, onChange, onSubmit, onStop };
};

describe("ChatInput — editing", () => {
  // jsdom does not implement contenteditable editing — typing into one inserts
  // nothing — so the keystroke itself cannot be simulated. What can be checked
  // is the half the component owns: given an input event, does it read the
  // editor and tell the parent? Driving it through fireEvent keeps the
  // assertion about the component rather than about jsdom.
  it("reports the editor's content to the parent on input", () => {
    const { editor, onChange } = setup();

    editor.textContent = "hi";
    fireEvent.input(editor);

    expect(onChange).toHaveBeenCalledWith("hi");
  });

  it("reports an emptied editor as an empty string, not undefined", () => {
    const { editor, onChange } = setup({ value: "something", state: "typing" });

    editor.textContent = "";
    fireEvent.input(editor);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("renders the value it is given rather than its own", () => {
    const { editor } = setup({ value: "from the parent", state: "typing" });
    expect(editor).toHaveTextContent("from the parent");
  });

  it("shows the placeholder as an accessible label", () => {
    const { editor } = setup();
    expect(editor).toHaveAttribute("aria-label", "Ask me anything");
    expect(editor).toHaveAttribute("data-placeholder", "Ask me anything");
  });
});

describe("ChatInput — submitting", () => {
  it("submits on Enter", async () => {
    const user = userEvent.setup();
    const { editor, onSubmit } = setup({ value: "a question", state: "typing" });

    await user.click(editor);
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledWith("a question");
  });

  it("does not submit an empty input", async () => {
    const user = userEvent.setup();
    const { editor, onSubmit } = setup({ value: "   ", state: "idle" });

    await user.click(editor);
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("treats Shift+Enter as a newline, not a send", async () => {
    const user = userEvent.setup();
    const { editor, onSubmit } = setup({ value: "first line", state: "typing" });

    await user.click(editor);
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when the send button is pressed", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({ value: "a question", state: "typing" });

    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(onSubmit).toHaveBeenCalledWith("a question");
  });
});

describe("ChatInput — states", () => {
  it("offers no send affordance while idle and empty", () => {
    setup();
    expect(screen.queryByRole("button", { name: /send message/i })).not.toBeInTheDocument();
  });

  it("offers send once there is something to send", () => {
    setup({ value: "hi", state: "typing" });
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("offers stop instead of send while responding", () => {
    setup({ value: "hi", state: "responding" });
    expect(screen.getByRole("button", { name: /stop response/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send message/i })).not.toBeInTheDocument();
  });

  it("calls onStop when the stop button is pressed", async () => {
    const user = userEvent.setup();
    const { onStop } = setup({ value: "hi", state: "responding" });

    await user.click(screen.getByRole("button", { name: /stop response/i }));

    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe("ChatInput — imperative handle", () => {
  it("exposes focus, getValue and setValue", () => {
    const ref = createRef<ChatInputHandle>();
    render(
      <ChatInput ref={ref} state="typing" value="seeded" onChange={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(typeof ref.current?.focus).toBe("function");
    expect(typeof ref.current?.getValue).toBe("function");
    expect(typeof ref.current?.setValue).toBe("function");
  });

  it("focus() moves focus into the editor", () => {
    const ref = createRef<ChatInputHandle>();
    const { container } = render(
      <ChatInput ref={ref} state="idle" value="" onChange={vi.fn()} onSubmit={vi.fn()} />
    );

    ref.current?.focus();

    expect(container.querySelector("[contenteditable]")).toHaveFocus();
  });

  it("getValue() reads what is actually in the editor", () => {
    const ref = createRef<ChatInputHandle>();
    render(
      <ChatInput ref={ref} state="typing" value="seeded" onChange={vi.fn()} onSubmit={vi.fn()} />
    );

    expect(ref.current?.getValue()).toBe("seeded");
  });

  it("setValue() notifies the parent, keeping the parent authoritative", () => {
    const onChange = vi.fn();
    const ref = createRef<ChatInputHandle>();
    render(
      <ChatInput ref={ref} state="idle" value="" onChange={onChange} onSubmit={vi.fn()} />
    );

    ref.current?.setValue("written imperatively");

    expect(onChange).toHaveBeenCalledWith("written imperatively");
  });
});
