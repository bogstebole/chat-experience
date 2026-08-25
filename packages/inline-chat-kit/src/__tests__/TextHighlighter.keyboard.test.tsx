import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

/**
 * The marker itself is geometric and cannot be exercised here — jsdom has no
 * layout, so `getClientRects` is empty and no stroke can be drawn. What is
 * testable is the whole of the keyboard model: where the cursor is, what it
 * selects, and that committing reports the right words. The drawing that
 * follows is the same code the pointer path already used.
 */
const TEXT = "Particle physics studies matter.";
const WORDS = ["Particle", "physics", "studies", "matter."];

const setup = (props: Partial<React.ComponentProps<typeof TextHighlighter>> = {}) => {
  const utils = render(<TextHighlighter text={TEXT} {...props} />);
  const surface = utils.container.querySelector("[tabindex]") as HTMLElement;
  const tokens = () => [...utils.container.querySelectorAll("span[data-index]")] as HTMLElement[];
  const cursorWord = () => tokens().find((t) => t.hasAttribute("data-kbd-cursor"))?.textContent;
  const selectedWords = () =>
    tokens()
      .filter((t) => t.hasAttribute("data-kbd-selected"))
      .map((t) => t.textContent)
      .filter((t) => t?.trim());
  return { ...utils, surface, tokens, cursorWord, selectedWords };
};

const press = (el: HTMLElement, key: string, shiftKey = false) =>
  fireEvent.keyDown(el, { key, shiftKey });

describe("TextHighlighter — reachable by keyboard", () => {
  it("puts the paragraph in the tab order", () => {
    const { surface } = setup();
    expect(surface.getAttribute("tabindex")).toBe("0");
  });

  it("says what the keys do, on focus and nowhere else", () => {
    const { surface, container } = setup();
    const hint = container.querySelector(`#${CSS.escape(surface.getAttribute("aria-describedby")!)}`);
    expect(hint?.textContent).toMatch(/arrow keys move by word/i);
    // Hidden from the reading order — a directly referenced node is still used
    // for the description, so it is heard once, on focus.
    expect(hint?.getAttribute("aria-hidden")).toBe("true");
  });

  /**
   * It used to be `user-select: none` permanently in marker mode, which meant
   * the answer could not be selected at all — including to copy it.
   */
  it("leaves the text selectable at rest", () => {
    const { surface } = setup();
    expect(surface.style.userSelect).toBe("text");
  });
});

describe("TextHighlighter — the word cursor", () => {
  it("lands on the first word", () => {
    const { surface, cursorWord } = setup();
    press(surface, "ArrowRight");
    expect(cursorWord()).toBe(WORDS[0]);
  });

  it("steps word by word, stepping over the spaces between them", () => {
    const { surface, cursorWord } = setup();
    press(surface, "ArrowRight");
    press(surface, "ArrowRight");
    expect(cursorWord()).toBe(WORDS[1]);
  });

  it("stops at the end rather than wrapping", () => {
    const { surface, cursorWord } = setup();
    for (let i = 0; i < 10; i++) press(surface, "ArrowRight");
    expect(cursorWord()).toBe(WORDS[WORDS.length - 1]);
  });

  it("jumps to either end", () => {
    const { surface, cursorWord } = setup();
    press(surface, "End");
    expect(cursorWord()).toBe(WORDS[WORDS.length - 1]);
    press(surface, "Home");
    expect(cursorWord()).toBe(WORDS[0]);
  });

  it("extends the selection while shift is held", () => {
    const { surface, selectedWords } = setup();
    press(surface, "ArrowRight");
    press(surface, "ArrowRight", true);
    press(surface, "ArrowRight", true);
    expect(selectedWords()).toEqual([WORDS[0], WORDS[1], WORDS[2]]);
  });

  it("collapses the selection again when shift is let go", () => {
    const { surface, selectedWords } = setup();
    press(surface, "ArrowRight");
    press(surface, "ArrowRight", true);
    press(surface, "ArrowRight");
    expect(selectedWords()).toEqual([WORDS[2]]);
  });

  it("selects backwards just as well", () => {
    const { surface, selectedWords } = setup();
    press(surface, "End");
    press(surface, "ArrowLeft", true);
    expect(selectedWords()).toEqual([WORDS[2], WORDS[3]]);
  });

  it("gives the cursor up when focus leaves", () => {
    const { surface, cursorWord } = setup();
    press(surface, "ArrowRight");
    fireEvent.blur(surface);
    expect(cursorWord()).toBeUndefined();
  });

  it("clears on escape", () => {
    const { surface, cursorWord } = setup();
    press(surface, "ArrowRight");
    press(surface, "Escape");
    expect(cursorWord()).toBeUndefined();
  });
});

describe("TextHighlighter — committing from the keyboard", () => {
  it("reports the selected words, exactly as a drag would", () => {
    const onHighlightComplete = vi.fn();
    const { surface } = setup({ onHighlightComplete });

    press(surface, "ArrowRight");
    press(surface, "ArrowRight", true);
    press(surface, "Enter");

    expect(onHighlightComplete).toHaveBeenCalledWith("Particle physics");
  });

  it("commits a single word too", () => {
    const onHighlightComplete = vi.fn();
    const { surface } = setup({ onHighlightComplete });

    press(surface, "ArrowRight");
    press(surface, "Enter");

    expect(onHighlightComplete).toHaveBeenCalledWith("Particle");
  });

  it("takes space as readily as enter", () => {
    const onHighlightComplete = vi.fn();
    const { surface } = setup({ onHighlightComplete });

    press(surface, "End");
    press(surface, " ");

    expect(onHighlightComplete).toHaveBeenCalledWith("matter.");
  });

  it("does nothing on enter with no selection", () => {
    const onHighlightComplete = vi.fn();
    const { surface } = setup({ onHighlightComplete });

    press(surface, "Enter");

    expect(onHighlightComplete).not.toHaveBeenCalled();
  });

  it("lets go of the cursor once the highlight is made", () => {
    const { surface, cursorWord } = setup();
    press(surface, "ArrowRight");
    press(surface, "Enter");
    expect(cursorWord()).toBeUndefined();
  });

  it("works the same in precise mode", () => {
    const onHighlightComplete = vi.fn();
    const { surface } = setup({ selectionMode: "precise", onHighlightComplete });

    press(surface, "ArrowRight");
    press(surface, "Enter");

    expect(onHighlightComplete).toHaveBeenCalledWith("Particle");
  });
});
