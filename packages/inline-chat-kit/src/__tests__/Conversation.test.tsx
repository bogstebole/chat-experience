import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { Conversation } from "../Conversation/Conversation";

/**
 * jsdom lays nothing out, so every measurement is zero and the component has
 * nothing to reason about. The geometry is faked here — but only the
 * geometry. Every decision still comes from the component.
 */
let notify: (() => void) | null = null;

class FakeResizeObserver {
  constructor(cb: () => void) {
    notify = cb;
  }
  observe() {}
  unobserve() {}
  disconnect() {
    notify = null;
  }
}

const grow = () => act(() => notify?.());

interface Layout {
  /** Height of the visible area. */
  clientHeight: number;
  /** Where the content wrapper starts, and how tall it is. */
  contentTop: number;
  contentHeight: number;
  /** Total scrollable height, which includes any padding below the content. */
  scrollHeight: number;
}

const apply = (container: HTMLElement, layout: Layout) => {
  const viewport = container.firstElementChild!.firstElementChild as HTMLElement;
  const content = viewport.firstElementChild as HTMLElement;

  Object.defineProperty(viewport, "clientHeight", { value: layout.clientHeight, configurable: true });
  Object.defineProperty(viewport, "scrollHeight", { value: layout.scrollHeight, configurable: true });
  Object.defineProperty(content, "offsetTop", { value: layout.contentTop, configurable: true });
  Object.defineProperty(content, "offsetHeight", { value: layout.contentHeight, configurable: true });

  // jsdom has no scrollTo; the component uses it for the smooth jump.
  viewport.scrollTo = ((options: ScrollToOptions) => {
    viewport.scrollTop = options.top ?? 0;
  }) as HTMLElement["scrollTo"];

  return { viewport, content };
};

/** 600 tall, 1000 of content, and 700 of padding below it. */
const TALL: Layout = { clientHeight: 600, contentTop: 0, contentHeight: 1000, scrollHeight: 1700 };

beforeEach(() => vi.stubGlobal("ResizeObserver", FakeResizeObserver));
afterEach(() => {
  vi.unstubAllGlobals();
  notify = null;
});

describe("keeping up", () => {
  /**
   * The behaviour the whole component exists for. `scrollHeight` here is 1700
   * because of the padding below the conversation; scrolling to that would put
   * the answer off the top of the screen and show a blank space instead. The
   * end of the *content* is at 400.
   */
  it("follows the end of the content, not the bottom of the container", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport } = apply(container, TALL);
    grow();
    expect(viewport.scrollTop).toBe(400);
    expect(viewport.scrollTop).not.toBe(1100); // scrollHeight - clientHeight
  });

  it("keeps up as the content grows", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport, content } = apply(container, TALL);
    grow();
    expect(viewport.scrollTop).toBe(400);

    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();
    expect(viewport.scrollTop).toBe(1000);
  });

  it("stays at nothing when the content is shorter than the view", () => {
    const { container } = render(<Conversation>short</Conversation>);
    const { viewport } = apply(container, { ...TALL, contentHeight: 100 });
    grow();
    expect(viewport.scrollTop).toBe(0);
  });

  it("does nothing at all when switched off", () => {
    const { container } = render(<Conversation follow={false}>answer</Conversation>);
    const { viewport } = apply(container, TALL);
    grow();
    expect(viewport.scrollTop).toBe(0);
  });
});

describe("letting go", () => {
  /**
   * Read from the input, not inferred from the scroll event. A wheel upwards
   * says where the reader wants to be before the scroll has even happened —
   * and a component that cannot tell its own scrolling from theirs either
   * drags them back down or never follows at all.
   */
  it("stops following the moment the wheel goes up", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport, content } = apply(container, TALL);
    grow();

    fireEvent.wheel(viewport, { deltaY: -50 });
    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();

    expect(viewport.scrollTop).toBe(400); // where it was left
  });

  it("keeps following when the wheel goes down", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport, content } = apply(container, TALL);
    grow();

    fireEvent.wheel(viewport, { deltaY: 50 });
    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();

    expect(viewport.scrollTop).toBe(1000);
  });

  it.each(["ArrowUp", "PageUp", "Home"])("stops following on %s", (key) => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport, content } = apply(container, TALL);
    grow();

    fireEvent.keyDown(viewport, { key });
    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();

    expect(viewport.scrollTop).toBe(400);
  });

  /** A drag on a phone, where there is no wheel to read. */
  it("stops following when a touch drag has moved away from the end", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport, content } = apply(container, TALL);
    grow();

    viewport.scrollTop = 100;
    fireEvent.touchMove(viewport);
    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();

    expect(viewport.scrollTop).toBe(100);
  });
});

describe("coming back", () => {
  it("picks the thread back up once the view is near the end again", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport, content } = apply(container, TALL);
    grow();
    fireEvent.wheel(viewport, { deltaY: -50 });

    viewport.scrollTop = 380; // inside the 64px threshold of 400
    fireEvent.scroll(viewport);

    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();
    expect(viewport.scrollTop).toBe(1000);
  });

  it("stays let go while the view is still well away", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport } = apply(container, TALL);
    grow();
    fireEvent.wheel(viewport, { deltaY: -50 });

    viewport.scrollTop = 100;
    fireEvent.scroll(viewport);
    expect(screen.getByRole("button", { name: "Jump to the latest" })).toHaveAttribute("data-shown");
  });

  it("still calls an onScroll the consumer passed", () => {
    const onScroll = vi.fn();
    const { container } = render(<Conversation onScroll={onScroll}>answer</Conversation>);
    const { viewport } = apply(container, TALL);
    fireEvent.scroll(viewport);
    expect(onScroll).toHaveBeenCalled();
  });
});

describe("the way back", () => {
  /**
   * Queried out of the DOM rather than by role while it is hidden. That is not
   * a workaround: `aria-hidden` takes it out of the accessibility tree, which
   * is exactly what should happen to a control that is not offering anything,
   * and `getByRole` is right to refuse it.
   */
  const button = (container: HTMLElement) => container.querySelector("button")!;

  const detach = (container: HTMLElement) => {
    const { viewport, content } = apply(container, TALL);
    grow();
    fireEvent.wheel(viewport, { deltaY: -50 });
    return { viewport, content };
  };

  it("offers itself only once there is somewhere to go back to", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    apply(container, TALL);
    grow();
    expect(button(container)).not.toHaveAttribute("data-shown");
    // Not reachable by role either, which is the point of hiding it.
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    detach(container);
    expect(button(container)).toHaveAttribute("data-shown");
    expect(screen.getByRole("button", { name: "Jump to the latest" })).toBeInTheDocument();
  });

  /**
   * Hidden but focusable is a dead stop in the middle of a page — the reader
   * tabs onto something they cannot see and cannot use.
   */
  it("is out of the tab order while it is not offering anything", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    apply(container, TALL);
    grow();
    expect(button(container)).toHaveAttribute("tabindex", "-1");
    expect(button(container)).toHaveAttribute("aria-hidden", "true");

    detach(container);
    expect(button(container)).toHaveAttribute("tabindex", "0");
    expect(button(container)).not.toHaveAttribute("aria-hidden");
  });

  it("goes back to the end, and starts following again", () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const { viewport, content } = detach(container);

    fireEvent.click(screen.getByRole("button", { name: "Jump to the latest" }));
    expect(viewport.scrollTop).toBe(400);

    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();
    expect(viewport.scrollTop).toBe(1000);
  });

  it("can be left out", () => {
    const { container } = render(<Conversation scrollButton={false}>answer</Conversation>);
    apply(container, TALL);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("takes a label of its own", () => {
    const { container } = render(
      <Conversation scrollButtonLabel="Back to the newest">answer</Conversation>
    );
    detach(container);
    expect(screen.getByRole("button", { name: "Back to the newest" })).toBeInTheDocument();
  });
});
