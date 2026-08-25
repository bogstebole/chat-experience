import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

const TEXT = "Particle physics studies matter.";

/**
 * A highlight cannot exist at all without a measurement — a Range with no
 * rects is a highlight with nothing to draw, and the component drops it. jsdom
 * measures nothing, so one plausible rect stands in.
 *
 * Nothing below asserts anything about geometry. These tests are about what
 * exists *once a highlight does*: whether it can be reached, named and
 * reopened without a mouse.
 */
beforeEach(() => {
  vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
    { left: 10, top: 20, width: 120, height: 16 },
  ] as unknown as DOMRectList);
});
afterEach(() => vi.restoreAllMocks());

const setup = () => {
  const utils = render(<TextHighlighter text={TEXT} />);
  const surface = utils.container.querySelector("[tabindex]") as HTMLElement;
  const press = (key: string, shiftKey = false) => fireEvent.keyDown(surface, { key, shiftKey });
  /** One highlight over `words` words, made the way a keyboard user makes it. */
  const highlight = (words = 1) => {
    press("ArrowRight");
    for (let i = 1; i < words; i++) press("ArrowRight", true);
    press("Enter");
  };
  /**
   * Escape, and then wait for the menu to actually go. Its exit is animated,
   * so it outlives the state change that dismissed it — asserting immediately
   * would pass on a menu that is still on screen.
   */
  const closeMenu = async () => {
    press("Escape");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /reply in thread/i })).not.toBeInTheDocument()
    );
  };
  return { ...utils, surface, press, highlight, closeMenu };
};

describe("TextHighlighter — highlights are reachable", () => {
  it("gives each highlight a control, named by the words it covers", () => {
    const { highlight } = setup();
    highlight(2);
    expect(screen.getByRole("button", { name: "Highlight: Particle physics" })).toBeInTheDocument();
  });

  /**
   * A real button, not a focusable SVG path. The platform gives Enter, Space,
   * the role and the focus behaviour for free, and SVG focus differs in every
   * browser.
   */
  it("uses a real button", () => {
    const { highlight } = setup();
    highlight();
    expect(screen.getByRole("button", { name: /^Highlight:/ }).tagName).toBe("BUTTON");
  });

  it("counts them for anyone arriving at the group", async () => {
    const { highlight, closeMenu } = setup();
    highlight();
    await closeMenu(); // the first one opened a menu; a menu blocks the next
    highlight(2);
    expect(screen.getByRole("group", { name: "2 highlights" })).toBeInTheDocument();
  });

  it("says one highlight, not 1 highlights", () => {
    const { highlight } = setup();
    highlight();
    expect(screen.getByRole("group", { name: "1 highlight" })).toBeInTheDocument();
  });

  it("has no group at all before anything is highlighted", () => {
    setup();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("comes after the paragraph in the tab order", async () => {
    const user = userEvent.setup();
    const { highlight, closeMenu, surface } = setup();
    highlight();
    await closeMenu();

    surface.focus();
    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Highlight:/ }));
  });
});

describe("TextHighlighter — reopening a highlight", () => {
  it("opens the menu when the control is activated", async () => {
    const user = userEvent.setup();
    const { highlight, closeMenu } = setup();
    highlight();
    await closeMenu();

    await user.click(screen.getByRole("button", { name: /^Highlight:/ }));

    expect(screen.getByRole("button", { name: /reply in thread/i })).toBeInTheDocument();
  });

  it("opens it from the keyboard too", async () => {
    const user = userEvent.setup();
    const { highlight, closeMenu } = setup();
    highlight();
    await closeMenu();

    screen.getByRole("button", { name: /^Highlight:/ }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: /reply in thread/i })).toBeInTheDocument();
  });

  /** So a sighted keyboard user can see which one they are on. */
  it("lights up the marker the focus is on", async () => {
    const { highlight, closeMenu, container } = setup();
    highlight();
    await closeMenu();
    expect(container.querySelector("path[data-active]")).toBeNull();

    fireEvent.focus(screen.getByRole("button", { name: /^Highlight:/ }));

    expect(container.querySelector("path[data-active]")).toBeInTheDocument();
  });

  it("stops lighting it up once focus moves on", async () => {
    const { highlight, closeMenu, container } = setup();
    highlight();
    await closeMenu();
    const control = screen.getByRole("button", { name: /^Highlight:/ });

    fireEvent.focus(control);
    fireEvent.blur(control);

    expect(container.querySelector("path[data-active]")).toBeNull();
  });

  /**
   * Escape is the exception to the rule below: it belongs to the paragraph
   * wherever focus happens to be, or the menu becomes a place to get stuck.
   */
  it("closes the menu with escape, from the control that opened it", async () => {
    const { highlight } = setup();
    highlight();
    const control = screen.getByRole("button", { name: /^Highlight:/ });
    control.focus();

    fireEvent.keyDown(control, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /reply in thread/i })).not.toBeInTheDocument()
    );
  });

  /** The word cursor must not also act on keys aimed at a control inside it. */
  it("leaves the word cursor alone while a control has focus", async () => {
    const { highlight, closeMenu, container } = setup();
    highlight();
    await closeMenu();
    const control = screen.getByRole("button", { name: /^Highlight:/ });
    control.focus();

    fireEvent.keyDown(control, { key: "ArrowRight" });

    expect(container.querySelector("span[data-kbd-cursor]")).toBeNull();
  });
});
