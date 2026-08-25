import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

/**
 * The marker interaction is geometric — it hit-tests with elementFromPoint and
 * measures with getBoundingClientRect, neither of which jsdom implements. So
 * drawing is not tested here; that belongs in the playground with a real
 * pointer.
 *
 * What is testable, and worth pinning, is the structure the interaction relies
 * on: the per-word elements and their indices, the container the CSS focus
 * effect keys off, and the fact that the component renders the text faithfully.
 */
const TEXT = "Particle physics studies the most fundamental constituents of matter.";

describe("TextHighlighter — rendering", () => {
  it("renders the text it is given, character for character", () => {
    const { container } = render(<TextHighlighter text={TEXT} />);
    const tokens = container.querySelectorAll("span[data-index]");
    expect([...tokens].map((t) => t.textContent).join("")).toBe(TEXT);
  });

  it("splits into words and keeps the whitespace between them", () => {
    const { container } = render(<TextHighlighter text="two words" />);
    const tokens = [...container.querySelectorAll("span[data-index]")];
    expect(tokens.map((t) => t.textContent)).toEqual(["two", " ", "words"]);
  });

  it("indexes tokens consecutively from zero, since hit-testing reads the index", () => {
    const { container } = render(<TextHighlighter text={TEXT} />);
    const indices = [...container.querySelectorAll("span[data-index]")].map((t) =>
      Number(t.getAttribute("data-index"))
    );
    expect(indices).toEqual(indices.map((_, i) => i));
  });

  it("re-renders cleanly when the text grows, as it does while streaming", () => {
    const { container, rerender } = render(<TextHighlighter text="Particle" />);
    expect(container.querySelectorAll("span[data-index]")).toHaveLength(1);

    rerender(<TextHighlighter text="Particle physics" />);
    const tokens = [...container.querySelectorAll("span[data-index]")];
    expect(tokens.map((t) => t.textContent).join("")).toBe("Particle physics");
  });

  it("renders empty text without crashing", () => {
    expect(() => render(<TextHighlighter text="" />)).not.toThrow();
  });
});

describe("TextHighlighter — focus effect", () => {
  it("leaves the paragraph unfocused until a menu opens", () => {
    const { container } = render(<TextHighlighter text={TEXT} />);
    const tokenHost = container.querySelector("[data-focus]");
    // The attribute is omitted rather than set to "false", so the CSS rule
    // simply does not match.
    expect(tokenHost).toBeNull();
  });

  it("marks no token active while nothing is selected", () => {
    const { container } = render(<TextHighlighter text={TEXT} />);
    expect(container.querySelectorAll("span[data-active]")).toHaveLength(0);
    expect(container.querySelectorAll("span[data-pressed]")).toHaveLength(0);
  });
});

describe("TextHighlighter — modes", () => {
  it("defaults to the freeform marker", () => {
    const { container } = render(<TextHighlighter text={TEXT} />);
    expect(container.querySelector('[data-cursor="marker"]')).toBeInTheDocument();
  });

  it("switches the affordance in precise mode", () => {
    const { container } = render(<TextHighlighter text={TEXT} selectionMode="precise" />);
    expect(container.querySelector('[data-cursor="text"]')).toBeInTheDocument();
  });

  it("does not begin drawing in precise mode, where native selection owns the pointer", () => {
    const onHighlightComplete = vi.fn();
    const { container } = render(
      <TextHighlighter text={TEXT} selectionMode="precise" onHighlightComplete={onHighlightComplete} />
    );
    const surface = container.querySelector('[data-cursor="text"]') as HTMLElement;

    fireEvent.pointerDown(surface, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(surface, { clientX: 60, clientY: 10 });
    fireEvent.pointerUp(surface, { clientX: 60, clientY: 10 });

    expect(onHighlightComplete).not.toHaveBeenCalled();
  });
});

describe("TextHighlighter — callbacks", () => {
  it("does not fire onHighlightComplete without an actual highlight", () => {
    const onHighlightComplete = vi.fn();
    render(<TextHighlighter text={TEXT} onHighlightComplete={onHighlightComplete} />);
    expect(onHighlightComplete).not.toHaveBeenCalled();
  });

  it("survives being given no callbacks at all", () => {
    const { container } = render(<TextHighlighter text={TEXT} />);
    const surface = container.querySelector('[data-cursor="marker"]') as HTMLElement;
    expect(() => {
      fireEvent.pointerDown(surface, { button: 0, clientX: 10, clientY: 10 });
      fireEvent.pointerUp(surface, { clientX: 10, clientY: 10 });
    }).not.toThrow();
  });
});

describe("TextHighlighter — no per-element animation", () => {
  /**
   * A regression guard, not a style preference. Every word used to carry its
   * own animation engine, which cost 350 inline style writes each time a menu
   * opened. Motion writes a `transform` style onto elements it drives, so a
   * paragraph at rest having inline styles on its words means that has crept
   * back in.
   */
  it("leaves token spans free of inline styles at rest", () => {
    const { container } = render(<TextHighlighter text={TEXT} />);
    const styled = [...container.querySelectorAll("span[data-index]")].filter(
      (t) => (t as HTMLElement).style.length > 0
    );
    expect(styled).toHaveLength(0);
  });
});
