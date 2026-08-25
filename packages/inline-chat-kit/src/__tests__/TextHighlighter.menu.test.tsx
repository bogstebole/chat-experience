import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

const TEXT = "Particle physics studies matter.";

/** See TextHighlighter.highlights.test.tsx — a highlight needs a measurement. */
beforeEach(() => {
  vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
    { left: 10, top: 20, width: 120, height: 16 },
  ] as unknown as DOMRectList);
});
afterEach(() => vi.restoreAllMocks());

const setup = () => {
  const utils = render(<TextHighlighter text={TEXT} onReplyInThread={vi.fn()} />);
  const surface = utils.container.querySelector("[tabindex]") as HTMLElement;
  const press = (key: string, shiftKey = false) => fireEvent.keyDown(surface, { key, shiftKey });

  /** A highlight made the way a keyboard user makes one: the menu opens with it. */
  const highlightByKeyboard = () => {
    surface.focus();
    press("ArrowRight");
    press("Enter");
  };

  const menu = () => screen.queryByRole("menu");
  const items = () => screen.queryAllByRole("menuitem");
  const reply = () => screen.getByRole("menuitem", { name: /reply in thread/i });
  const remove = () => screen.getByRole("menuitem", { name: /remove highlight/i });

  return { ...utils, surface, press, highlightByKeyboard, menu, items, reply, remove };
};

describe("the highlight menu — what it announces itself as", () => {
  it("is a menu, with a name", () => {
    const { highlightByKeyboard, menu } = setup();
    highlightByKeyboard();
    expect(menu()).toHaveAccessibleName("Highlight actions");
  });

  it("holds its actions as menu items", () => {
    const { highlightByKeyboard, items } = setup();
    highlightByKeyboard();
    expect(items()).toHaveLength(2);
  });

  /** One stop for the whole menu, not one per action — arrows move inside it. */
  it("is a single stop in the tab order", () => {
    const { highlightByKeyboard, items } = setup();
    highlightByKeyboard();
    const tabbable = items().filter((i) => i.getAttribute("tabindex") === "0");
    expect(tabbable).toHaveLength(1);
  });
});

describe("the highlight menu — moving through it", () => {
  it("takes focus when there was no other way in", async () => {
    const { highlightByKeyboard, reply } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));
  });

  it("moves to the next action on arrow right", async () => {
    const { highlightByKeyboard, reply, remove } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.keyDown(reply(), { key: "ArrowRight" });

    await waitFor(() => expect(document.activeElement).toBe(remove()));
  });

  it("wraps around rather than stopping dead", async () => {
    const { highlightByKeyboard, reply, remove } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.keyDown(reply(), { key: "ArrowLeft" });

    await waitFor(() => expect(document.activeElement).toBe(remove()));
  });

  it("takes home and end", async () => {
    const { highlightByKeyboard, reply, remove } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.keyDown(reply(), { key: "End" });
    await waitFor(() => expect(document.activeElement).toBe(remove()));

    fireEvent.keyDown(remove(), { key: "Home" });
    await waitFor(() => expect(document.activeElement).toBe(reply()));
  });

  /**
   * The paragraph listens for the same arrows. Without stopping the event, one
   * press would move both the menu selection and the word cursor behind it.
   */
  it("does not move the word cursor behind itself", async () => {
    const { highlightByKeyboard, reply, container } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.keyDown(reply(), { key: "ArrowRight" });

    expect(container.querySelector("span[data-kbd-cursor]")).toBeNull();
  });
});

describe("the highlight menu — leaving it", () => {
  it("closes on escape and hands focus back", async () => {
    const { highlightByKeyboard, reply, menu, surface } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.keyDown(reply(), { key: "Escape" });

    await waitFor(() => expect(menu()).not.toBeInTheDocument());
    expect(document.activeElement).toBe(surface);
  });

  it("hands focus back to the highlight's own control when that is what opened it", async () => {
    const { highlightByKeyboard, reply, press, menu } = setup();
    highlightByKeyboard();
    fireEvent.keyDown(reply(), { key: "Escape" });
    await waitFor(() => expect(menu()).not.toBeInTheDocument());
    press("Escape"); // drop the word cursor too

    const control = screen.getByRole("button", { name: /^Highlight:/ });
    control.focus();
    fireEvent.click(control);
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.keyDown(reply(), { key: "Escape" });

    await waitFor(() => expect(menu()).not.toBeInTheDocument());
    expect(document.activeElement).toBe(control);
  });

  it("goes away when focus leaves it altogether", async () => {
    const { highlightByKeyboard, reply, menu, surface } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.blur(reply(), { relatedTarget: surface });

    await waitFor(() => expect(menu()).not.toBeInTheDocument());
  });

  it("stays put while focus moves between its own actions", async () => {
    const { highlightByKeyboard, reply, remove, menu } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.blur(reply(), { relatedTarget: remove() });

    expect(menu()).toBeInTheDocument();
  });

  /** The control focus would go back to is the one being deleted. */
  it("falls back to the paragraph when the highlight itself is removed", async () => {
    const { highlightByKeyboard, remove, reply, menu, surface } = setup();
    highlightByKeyboard();
    await waitFor(() => expect(document.activeElement).toBe(reply()));

    fireEvent.click(remove());

    await waitFor(() => expect(menu()).not.toBeInTheDocument());
    expect(document.activeElement).toBe(surface);
    expect(screen.queryByRole("button", { name: /^Highlight:/ })).not.toBeInTheDocument();
  });
});

describe("the highlight menu — opened with a pointer", () => {
  /**
   * Focus belongs where the reader left it. Someone who just drew a marker
   * with a mouse did not ask to be moved into a menu.
   */
  it("does not take focus", async () => {
    const { highlightByKeyboard, reply, menu, press, container } = setup();
    highlightByKeyboard();
    fireEvent.keyDown(reply(), { key: "Escape" });
    await waitFor(() => expect(menu()).not.toBeInTheDocument());
    press("Escape");
    (document.activeElement as HTMLElement)?.blur();

    const marker = container.querySelector('path[id^="highlight-"]') as SVGPathElement;
    fireEvent.pointerDown(marker);
    fireEvent.pointerUp(marker);

    await waitFor(() => expect(menu()).toBeInTheDocument());
    expect(document.activeElement).toBe(document.body);
  });
});
