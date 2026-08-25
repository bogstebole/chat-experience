import { describe, it, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { CustomCursor } from "../CustomCursor/CustomCursor";

/**
 * Which cursor is drawn is decided by two questions asked of the DOM: is the
 * pointer over something that declares a cursor, and is it over a control.
 * When both are true, the nearer one wins — which is the whole of this file,
 * because getting that precedence wrong silently swaps the marker for an
 * arrow and nothing else notices.
 */
const MARKER_WIDTH = "27";
const ARROW_WIDTH = "19";
const CARET_WIDTH = "14";

const drawnCursor = (container: HTMLElement) =>
  container.querySelector("svg")?.getAttribute("width");

const scene = (surface: React.ReactNode) => {
  const utils = render(
    <>
      <CustomCursor />
      {surface}
    </>
  );
  return {
    ...utils,
    moveOver: (testId: string) => {
      fireEvent.pointerMove(utils.getByTestId(testId), { clientX: 40, clientY: 40 });
    },
  };
};

describe("CustomCursor", () => {
  /**
   * The regression this exists for. The highlighter became focusable so it
   * could be driven from the keyboard, and `[tabindex]` in the control
   * selector then matched the paragraph itself — so hovering the text drew an
   * arrow instead of the marker.
   */
  it("keeps the marker over a surface that is focusable in its own right", () => {
    const { container, moveOver } = scene(
      <div data-cursor="marker" tabIndex={0}>
        <span data-testid="word">Particle</span>
      </div>
    );

    moveOver("word");

    expect(drawnCursor(container)).toBe(MARKER_WIDTH);
  });

  it("still gives way to a button inside that surface", () => {
    const { container, moveOver } = scene(
      <div data-cursor="marker" tabIndex={0}>
        <button data-testid="action">Reply in thread</button>
      </div>
    );

    moveOver("action");

    expect(drawnCursor(container)).toBe(ARROW_WIDTH);
  });

  it("draws the caret over a surface that asks for text", () => {
    const { container, moveOver } = scene(
      <div data-cursor="text" tabIndex={0}>
        <span data-testid="word">Particle</span>
      </div>
    );

    moveOver("word");

    expect(drawnCursor(container)).toBe(CARET_WIDTH);
  });

  it("draws the arrow where nothing asks for anything else", () => {
    const { container, moveOver } = scene(<div data-testid="plain">plain text</div>);

    moveOver("plain");

    expect(drawnCursor(container)).toBe(ARROW_WIDTH);
  });

  it("shows nothing until the pointer has been somewhere", () => {
    const { container } = render(<CustomCursor />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
