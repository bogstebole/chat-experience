import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { Conversation } from "../Conversation/Conversation";

/**
 * jsdom lays nothing out, so every measurement is zero and the component has
 * nothing to reason about. The geometry is faked here — but only the
 * geometry. Every decision still comes from the component.
 */
/**
 * All of them, in registration order.
 *
 * There is more than one now — the tail is measured by an observer registered
 * before the one that keeps up, precisely so it runs first — and a fake that
 * remembered only the last callback silently dropped the first. Which looks
 * exactly like the tail never being measured.
 */
let watchers: (() => void)[] = [];

class FakeResizeObserver {
  private cb: () => void;
  constructor(cb: () => void) {
    this.cb = cb;
    watchers.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {
    watchers = watchers.filter((w) => w !== this.cb);
  }
}

const grow = () => act(() => watchers.forEach((w) => w()));

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
  watchers = [];
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

describe("holding a turn at the top", () => {
  /**
   * The behaviour this kit is built around: sending a message takes you to it,
   * and it stays there while the answer arrives underneath. What is on screen
   * is your question and its answer — not the whole conversation shoved up
   * from below, with the composer ending the run somewhere past the fold.
   */
  const withTurns = (anchorId?: string, anchorOffset = 0) =>
    render(
      <Conversation anchorId={anchorId} anchorOffset={anchorOffset}>
        <div id="turn-a">first</div>
        <div id="turn-b">second</div>
      </Conversation>
    );

  /** Turn `b` starts 900px down; the view has to travel to meet it. */
  const place = (container: HTMLElement) => {
    const { viewport, content } = apply(container, TALL);
    Object.defineProperty(container.querySelector("#turn-a")!, "offsetTop", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(container.querySelector("#turn-b")!, "offsetTop", {
      value: 900,
      configurable: true,
    });
    /* Turns need a height of their own, because "the end of the content" is
       measured from the last turn rather than from the wrapper around them —
       the wrapper carries the tail, the empty room that lets a turn reach the
       top, and counting that as content parks the reader a screen below the
       thing they are reading. jsdom gives every element a height of zero, so
       a fixture that does not say leaves the measurement reading the tail. */
    Object.defineProperty(container.querySelector("#turn-b")!, "offsetHeight", {
      value: 100,
      configurable: true,
    });
    return { viewport, content };
  };

  it("brings the anchored turn to the top", () => {
    const { container } = withTurns("turn-b");
    const { viewport } = place(container);
    grow();
    expect(viewport.scrollTop).toBe(900);
  });

  it("leaves room for whatever is fixed over the top", () => {
    const { container } = withTurns("turn-b", 100);
    const { viewport } = place(container);
    grow();
    expect(viewport.scrollTop).toBe(800);
  });

  /**
   * The difference from following the end, in one assertion. The answer grows
   * underneath and the view does not move — which is the entire point, and the
   * opposite of what `endOfContent` would do.
   */
  it("holds still while the answer grows underneath it", () => {
    const { container } = withTurns("turn-b");
    const { viewport, content } = place(container);
    grow();
    expect(viewport.scrollTop).toBe(900);

    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();
    expect(viewport.scrollTop).toBe(900);
  });

  it("moves to the next turn when the anchor changes", () => {
    const { container, rerender } = withTurns("turn-a");
    const { viewport } = place(container);
    grow();
    expect(viewport.scrollTop).toBe(100);

    rerender(
      <Conversation anchorId="turn-b">
        <div id="turn-a">first</div>
        <div id="turn-b">second</div>
      </Conversation>
    );
    place(container);
    grow();
    expect(viewport.scrollTop).toBe(900);
  });

  /**
   * An element cannot be brought to the top of a container that ends just
   * below it. That is what the padding under a conversation is for — and until
   * there is enough of it, "as far as it goes" is the honest answer.
   */
  it("goes as far as the container allows and no further", () => {
    const { container } = withTurns("turn-b");
    const { viewport } = place(container);
    Object.defineProperty(viewport, "scrollHeight", { value: 1200, configurable: true });
    grow();
    expect(viewport.scrollTop).toBe(600); // 1200 - 600, not 900
  });

  /**
   * The other half of anchoring, and the one it was missing.
   *
   * A turn taller than the viewport cannot have both its top at the top and
   * its end on screen. Its end wins — otherwise every line written after the
   * first screenful goes below the fold and nothing brings it back, which is
   * what an answer longer than a screen did: measured in a real browser, the
   * newest line was under the fold on 852 frames of 1467, by up to 49px.
   *
   * Only the anchored turn's own end counts. The end of the *conversation*
   * would drag the view past an older anchored turn to whatever follows it.
   */
  it("gives the top up once the anchored turn outgrows the view", () => {
    const { container } = withTurns("turn-b");
    const { viewport } = place(container);
    grow();
    expect(viewport.scrollTop, "short turn: held at the top").toBe(900);

    // 900 + 1000 - 600 = 1300, past its own top.
    Object.defineProperty(container.querySelector("#turn-b")!, "offsetHeight", {
      value: 1000,
      configurable: true,
    });
    Object.defineProperty(viewport, "scrollHeight", { value: 3000, configurable: true });
    grow();
    expect(viewport.scrollTop, "grown past a screen: its end is held instead").toBe(1300);
  });

  it("falls back to the end when the anchor is not on the page", () => {
    const { container } = withTurns("turn-missing");
    const { viewport } = place(container);
    grow();
    expect(viewport.scrollTop).toBe(400); // endOfContent
  });

  /**
   * With an anchor above you, scrolling *up* is how you get back to it — so
   * the direction cannot be what decides. Distance can.
   */
  it("does not let go for a wheel that moves towards the anchor", () => {
    const { container } = withTurns("turn-b");
    const { viewport, content } = place(container);
    grow();

    viewport.scrollTop = 890; // still within the threshold of 900
    fireEvent.wheel(viewport, { deltaY: -10 });

    Object.defineProperty(content, "offsetHeight", { value: 1600, configurable: true });
    grow();
    expect(viewport.scrollTop).toBe(900);
  });

  it("lets go once the wheel has taken the reader away from it", () => {
    const { container } = withTurns("turn-b");
    const { viewport } = place(container);
    grow();

    viewport.scrollTop = 300;
    fireEvent.wheel(viewport, { deltaY: -200 });
    expect(container.querySelector("button")).toHaveAttribute("data-shown");
  });

  it("takes the way-back button to the anchor, not to the end", () => {
    const { container } = withTurns("turn-b");
    const { viewport } = place(container);
    grow();
    viewport.scrollTop = 300;
    fireEvent.wheel(viewport, { deltaY: -200 });

    fireEvent.click(container.querySelector("button")!);
    expect(viewport.scrollTop).toBe(900);
  });
});

/**
 * The room under the last turn, and why it is measured rather than declared.
 *
 * An element cannot be scrolled to the top of a container that ends just below
 * it, so `anchorId` needs somewhere to scroll into. The demo used to declare
 * that room in its own stylesheet as `99vh`, and a guess is wrong in both
 * directions at once: measured in the built demo, the reader could scroll
 * 697px past the end of a 680px view — a completely blank screen, with the
 * last turn above the top edge.
 */
describe("the room to move into", () => {
  /** 600 tall, a last turn 100 tall, and the content ending at 1000. */
  const withTail = (props: Record<string, unknown> = {}) => {
    const view = render(
      <Conversation anchorId="turn-b" anchorOffset={100} {...props}>
        <div id="turn-a">first</div>
        <div id="turn-b">second</div>
      </Conversation>
    );
    const { viewport, content } = apply(view.container, TALL);
    /* `turn-a` at 100 and `turn-b` at 900, both 100 tall — so the
       conversation ends at 1000, 900 of it under `turn-a` and 100 under
       `turn-b`. The two anchors want very different amounts of room, which is
       the difference this fixture exists to show. */
    Object.defineProperty(view.container.querySelector("#turn-a")!, "offsetTop", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(view.container.querySelector("#turn-a")!, "offsetHeight", {
      value: 100,
      configurable: true,
    });
    Object.defineProperty(view.container.querySelector("#turn-b")!, "offsetTop", {
      value: 900,
      configurable: true,
    });
    Object.defineProperty(view.container.querySelector("#turn-b")!, "offsetHeight", {
      value: 100,
      configurable: true,
    });
    return { ...view, viewport, content };
  };

  const tailOf = (content: HTMLElement) =>
    content.style.getPropertyValue("--ick-conversation-tail");

  it("is exactly what the anchored turn needs to reach the anchor", () => {
    const { content } = withTail();
    grow();
    // 600 of screen, less 100 held above the anchor, less the 100 from the
    // anchored turn's top to the end of the conversation.
    expect(tailOf(content)).toBe("400px");
  });

  /**
   * The measurement that was wrong the first time, in one assertion.
   *
   * Taking the **last turn's own height** off leaves everything between the
   * anchor and the end unaccounted for. Here the anchored turn is the first
   * one and there is 900px under it, so the room needed is none — but the
   * last turn is only 100 tall, and measuring that gave 400px of room to
   * scroll into with nothing in it. In the demo it was 536px after every
   * answer, because the last turn there is the composer.
   */
  it("counts everything under the anchor, not just the last turn", () => {
    const { content } = withTail({ anchorId: "turn-a" });
    grow();
    expect(tailOf(content)).toBe("0px");
  });

  it("shrinks to nothing once the last turn fills the screen", () => {
    const { container, content } = withTail();
    Object.defineProperty(container.querySelector("#turn-b")!, "offsetHeight", {
      value: 900,
      configurable: true,
    });
    grow();
    expect(tailOf(content)).toBe("0px");
  });

  /**
   * The end gap is where the view comes to rest; the tail is how far it is
   * allowed to go. They look like the same distance and are not, and taking
   * one out of the other costs the anchor exactly `endOffset` of travel —
   * measured in the browser, the second message came to rest 196px down
   * instead of 100 because the scroll ran out 96px short.
   */
  it("is not shortened by the end gap, which is a different distance", () => {
    const { content } = withTail({ endOffset: 120 });
    grow();
    expect(tailOf(content)).toBe("400px");
  });

  /* A transcript that never anchors has nothing to scroll a turn up to, and
     room under it would only be room to scroll into nothing. */
  it("is nothing at all when the conversation does not anchor", () => {
    const { container } = render(
      <Conversation>
        <div id="turn-a">first</div>
      </Conversation>
    );
    const { content } = apply(container, TALL);
    grow();
    expect(tailOf(content)).toBe("0px");
  });

  /* And it stays once an anchor has been used, because the demo lets go of
     the anchor when an answer settles. A tail that collapsed at that moment
     would take the view down with it at the end of every answer. */
  it("stays after the anchor is let go of", () => {
    const { rerender, container, content } = withTail();
    grow();
    expect(tailOf(content)).toBe("400px");
    rerender(
      <Conversation anchorOffset={100}>
        <div id="turn-a">first</div>
        <div id="turn-b">second</div>
      </Conversation>
    );
    Object.defineProperty(container.querySelector("#turn-b")!, "offsetHeight", {
      value: 100,
      configurable: true,
    });
    grow();
    expect(tailOf(content)).toBe("400px");
  });

  /**
   * And once the room has been sized, coming to rest means the end of it.
   *
   * The room is aimed at holding the anchored turn at the top, so resting
   * anywhere above the end of the scroll leaves the difference unspent and
   * the turn somewhere in the middle of the view. That only shows when the
   * answer is shorter than the screen — above that the room falls to its
   * floor and the end of the content and the end of the scroll are the same
   * number, which is why a first version checked only against long answers
   * and found nothing.
   */
  it("comes to rest at the end of the scroll, not the end of the content", () => {
    const { rerender, container, viewport } = withTail();
    grow();
    rerender(
      <Conversation anchorOffset={100}>
        <div id="turn-a">first</div>
        <div id="turn-b">second</div>
      </Conversation>
    );
    Object.defineProperty(container.querySelector("#turn-b")!, "offsetHeight", {
      value: 100,
      configurable: true,
    });
    grow();
    expect(viewport.scrollTop).toBe(1100); // scrollHeight - clientHeight
    expect(viewport.scrollTop).not.toBe(400); // the end of the content
  });

  it("hands over to a number", () => {
    const { content } = withTail({ tail: 64 });
    grow();
    expect(tailOf(content)).toBe("64px");
  });

  /**
   * And the end of the content is measured once, not twice.
   *
   * A turn's `offsetTop` is taken from the nearest positioned ancestor — the
   * root — and so is the wrapper's, so adding the two counts the viewport's
   * padding twice. Measured in the demo: a conversation ending at 729 read as
   * ending at 829, and the composer came to rest 100px above the `endOffset`
   * it was given.
   */
  it("does not count the padding above the conversation as content", () => {
    const { container } = render(
      <Conversation>
        <div id="turn-a">only</div>
      </Conversation>
    );
    const { viewport } = apply(container, { ...TALL, contentTop: 100 });
    Object.defineProperty(container.querySelector("#turn-a")!, "offsetTop", {
      value: 900,
      configurable: true,
    });
    Object.defineProperty(container.querySelector("#turn-a")!, "offsetHeight", {
      value: 100,
      configurable: true,
    });
    grow();
    expect(viewport.scrollTop).toBe(400); // 1000 - 600, not 1100 - 600
  });
});
