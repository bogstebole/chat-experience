import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
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

    expect(onSubmit).toHaveBeenCalledWith("a question", []);
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

    expect(onSubmit).toHaveBeenCalledWith("a question", []);
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

/**
 * Attaching, which used to stop at the composer.
 *
 * A file could be picked and shown and then quietly dropped on send — the
 * message went and the picture did not. Offering an attach button and then
 * losing what it attached is worse than not offering one.
 */
describe("ChatInput — attaching", () => {
  const png = () => new File(["x"], "kitchen.png", { type: "image/png" });

  /**
   * jsdom has no object URLs at all, and this is what leaked before — so they
   * are stubbed for the whole block rather than per test. Per test is not
   * enough: Testing Library unmounts *after* a test finishes, so the cleanup
   * that revokes them would run against the real `URL` and throw.
   */
  let made: string[] = [];
  let revoked: string[] = [];

  beforeEach(() => {
    made = [];
    revoked = [];
    let n = 0;
    vi.stubGlobal("URL", {
      createObjectURL: () => {
        const url = `blob:${(n += 1)}`;
        made.push(url);
        return url;
      },
      revokeObjectURL: (url: string) => revoked.push(url),
    });
  });

  /* `afterAll`, not `afterEach`. Testing Library's automatic cleanup is
     registered when the setup file loads, so it runs *after* a hook declared
     here — unstubbing per test puts the real `URL` back before the unmount
     that revokes, and jsdom's has no `revokeObjectURL` at all. */
  afterAll(() => vi.unstubAllGlobals());

  /* `fireEvent`, not `userEvent.upload`: the picker is `display: none` — it is
     opened by the composer's own button — and userEvent refuses to touch an
     element nobody can see. Which is correct of it, and not the thing under
     test here. */
  const pick = (container: HTMLElement, files: File[]) => {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files } });
    return input;
  };

  it("sends what was attached along with what was typed", async () => {
    const { onSubmit, container } = setup({ value: "look at this" });
    pick(container, [png()]);

    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).toHaveBeenCalledWith("look at this", [
      expect.objectContaining({ name: "kitchen.png", type: "image/png" }),
    ]);
  });

  /** A picture on its own is a message. */
  it("can send with nothing typed", async () => {
    const { onSubmit, container } = setup({ value: "" });
    expect(screen.queryByRole("button", { name: "Send message" })).toBeNull();

    pick(container, [png()]);
    await userEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).toHaveBeenCalledWith("", [expect.objectContaining({ name: "kitchen.png" })]);
  });

  it("takes one at a time unless asked for more", () => {
    const { container } = setup({ value: "hi" });
    pick(container, [png()]);
    pick(container, [new File(["y"], "hallway.jpg", { type: "image/jpeg" })]);
    expect(screen.getByRole("img", { name: "hallway.jpg" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "kitchen.png" })).toBeNull();
    /* And the one it dropped went with it. Picking six in a row leaked five. */
    expect(revoked).toEqual([made[0]]);
  });

  it("takes several when asked", () => {
    const { container } = setup({ value: "hi", multiple: true });
    pick(container, [png()]);
    pick(container, [new File(["y"], "hallway.jpg", { type: "image/jpeg" })]);
    expect(screen.getByRole("img", { name: "hallway.jpg" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "kitchen.png" })).toBeInTheDocument();
  });

  /**
   * `createObjectURL` pins the file in memory until it is revoked, and nothing
   * was revoking. Attaching and removing ten times leaked ten of them, and so
   * did navigating away with one attached.
   */
  it("hands back the object URLs it made", async () => {
    const { container, unmount } = setup({ value: "hi" });
    pick(container, [png()]);
    expect(made).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: /Remove kitchen.png/ }));
    expect(revoked).toEqual(made);

    pick(container, [png()]);
    unmount();
    expect(revoked).toEqual(made);
  });

  /** Given a handler, the composer hands the files over rather than keeping them. */
  it("lets the host take the files instead", () => {
    const onAttach = vi.fn();
    const { container } = setup({ value: "hi", onAttach });
    pick(container, [png()]);
    expect(onAttach).toHaveBeenCalledWith([expect.objectContaining({ name: "kitchen.png" })]);
    expect(screen.queryByRole("img")).toBeNull();
    expect(made).toEqual([]);
  });

  /** Picking the same file twice in a row has to fire twice. */
  it("clears the picker after a pick", () => {
    const onAttach = vi.fn();
    const { container } = setup({ value: "hi", onAttach });
    pick(container, [png()]);
    pick(container, [png()]);
    expect(onAttach).toHaveBeenCalledTimes(2);
  });
});
