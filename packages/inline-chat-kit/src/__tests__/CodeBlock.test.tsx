import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CodeBlock } from "../CodeBlock/CodeBlock";
import { canHighlight, loadHighlighter } from "../CodeBlock/highlight";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

const TS = `const higgs: number = 125.25; // GeV`;

describe("highlighting", async () => {
  /* The grammars are behind a dynamic import now, so every case that wants a
     colour has to wait for them. The module keeps the loaded highlighter, so
     this is one fetch for the file. */
  const highlightCode = await loadHighlighter();

  it("knows the languages it registered, and their aliases", () => {
    expect(canHighlight("typescript")).toBe(true);
    expect(canHighlight("ts")).toBe(true);
    expect(canHighlight("TSX")).toBe(true);
    expect(canHighlight("html")).toBe(true);
    expect(canHighlight("sh")).toBe(true);
  });

  /** A missing grammar is a small loss; a chat that throws on it is not. */
  it("hands back one plain run for a language it does not know", () => {
    expect(highlightCode("fn main() {}", "rust")).toEqual([{ value: "fn main() {}", kind: null }]);
    expect(highlightCode("plain", undefined)).toEqual([{ value: "plain", kind: null }]);
  });

  it("marks keywords, numbers and comments", () => {
    const kinds = new Set(highlightCode(TS, "ts").map((t) => t.kind));
    expect(kinds).toContain("keyword");
    expect(kinds).toContain("number");
    expect(kinds).toContain("comment");
  });

  /** Whatever it splits into has to still be the code that went in. */
  it("loses nothing", () => {
    for (const [code, lang] of [
      [TS, "ts"],
      ["SELECT * FROM t WHERE a = 1;", "sql"],
      ["- a: 1\n- b: 2", "yaml"],
      ["#!/bin/bash\necho 'hi' # note", "bash"],
    ] as const) {
      expect(highlightCode(code, lang).map((t) => t.value).join("")).toBe(code);
    }
  });

  it("joins neighbouring runs of the same kind", () => {
    const tokens = highlightCode(TS, "ts");
    expect(tokens.every((t, i) => i === 0 || t.kind !== tokens[i - 1].kind)).toBe(true);
  });
});

describe("the block", () => {
  it("shows the code", () => {
    const { container } = render(<CodeBlock code={TS} lang="ts" />);
    expect(container.querySelector("pre")?.textContent).toBe(TS);
  });

  it("names the language", () => {
    render(<CodeBlock code={TS} lang="ts" />);
    expect(screen.getByText("ts")).toBeInTheDocument();
  });

  it("takes a label of its own, and can have none", () => {
    const { rerender } = render(<CodeBlock code={TS} lang="ts" label="example.ts" />);
    expect(screen.getByText("example.ts")).toBeInTheDocument();
    rerender(<CodeBlock code={TS} lang="ts" label={false} />);
    expect(screen.queryByText("ts")).not.toBeInTheDocument();
  });

  it("can be made uncopyable, and then has no bar at all", () => {
    const { container } = render(<CodeBlock code={TS} label={false} copyable={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector("pre")).toBeInTheDocument();
  });
});

describe("copying", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("hands the code to the callback", () => {
    const onCopy = vi.fn();
    render(<CodeBlock code={TS} lang="ts" onCopy={onCopy} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(onCopy).toHaveBeenCalledWith(TS);
  });

  it("confirms, then goes back", () => {
    render(<CodeBlock code={TS} lang="ts" onCopy={vi.fn()} copiedFor={1000} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(1100));
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });

  /** The tick is a picture. Without this a reader is told nothing happened. */
  it("says so out loud", () => {
    render(<CodeBlock code={TS} lang="ts" onCopy={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
    act(() => void vi.advanceTimersByTime(200));
    expect(document.body.textContent).toContain("Copied to clipboard");
  });

  it("restarts the confirmation rather than stacking timers", () => {
    render(<CodeBlock code={TS} lang="ts" onCopy={vi.fn()} copiedFor={1000} />);
    // Wrapped, because the announcement this fires lands on its own timer and
    // React sees that update arrive from outside the click.
    const click = () =>
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: /Copy code|Copied/ }));
      });
    click();
    act(() => void vi.advanceTimersByTime(800));
    click();
    act(() => void vi.advanceTimersByTime(800));
    // Still confirmed: the second press pushed the reset out, not queued one.
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});

describe("inside an answer", () => {
  it("replaces the bare pre the markdown renderer used to emit", () => {
    const { container } = render(
      <TextHighlighter text={"Use it:\n\n```ts\nconst a = 1;\n```"} />
    );
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
    expect(screen.getByText("ts")).toBeInTheDocument();
    expect(container.querySelector("pre")?.textContent).toBe("const a = 1;");
  });

  /**
   * The block sits on the highlighter's surface, where a pointerdown starts
   * drawing a marker. Pressing the copy button is not a stroke.
   */
  it("does not start a marker when the copy button is pressed", () => {
    const onHighlightComplete = vi.fn();
    render(
      <TextHighlighter
        text={"```ts\nconst a = 1;\n```"}
        onHighlightComplete={onHighlightComplete}
      />
    );
    const button = screen.getByRole("button", { name: "Copy code" });
    const down = new PointerEvent("pointerdown", { bubbles: true, cancelable: true });
    fireEvent(button, down);
    expect(onHighlightComplete).not.toHaveBeenCalled();
  });

  it("still leaves the prose around it markable", () => {
    const { container } = render(
      <TextHighlighter text={"Use it:\n\n```ts\nconst a = 1;\n```\n\nIn GeV."} />
    );
    const words = [...container.querySelectorAll("[data-index]")]
      .filter((el) => el.textContent?.trim())
      .map((el) => el.textContent);
    expect(words).toEqual(["Use", "it:", "In", "GeV."]);
  });
});

describe("the rules that only matter when painted", () => {
  /**
   * Comments stripped first. One of them quotes `pre { font-family: … }` as
   * the thing being defended against, and slicing a rule at the next `}` walked
   * straight into it — the test failed while the stylesheet was correct.
   */
  const sheet = async () =>
    ((await import("../CodeBlock/CodeBlock.module.css?raw")).default as string).replace(
      /\/\*[\s\S]*?\*\//g,
      ""
    );

  /**
   * Geist Mono ligates `--` into a single long dash, so `npm run dev -- --port`
   * renders as `dev —— ——port` while the clipboard still hands over the real
   * characters. A block that shows one thing and copies another is worse than
   * one that is merely ugly. jsdom does not paint, so this reads the rule.
   */
  it("switches ligatures off, so a character is the character", async () => {
    const css = await sheet();
    expect(css).toContain("font-variant-ligatures: none");
    expect(css).toContain('font-feature-settings: "liga" 0, "calt" 0');
  });

  /**
   * An inherited family loses to any direct declaration, and `pre` and `code`
   * are two of the elements host apps and docs tools reliably style. Declared
   * on the parent alone, the kit's mono font never arrived — Storybook's Fira
   * Code stack was what rendered, ligatures and all.
   */
  it("states the font on the elements a host is likely to style itself", async () => {
    const css = await sheet();
    for (const selector of [".pre {", ".pre code {"]) {
      const at = css.indexOf(selector);
      const rule = css.slice(at, css.indexOf("}", at));
      expect(rule, selector).toContain("font-family: var(--ick-font-mono)");
      expect(rule, selector).toContain("font-variant-ligatures: none");
    }
  });

  it("keeps a long line inside the block rather than widening the answer", async () => {
    const css = await sheet();
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain("white-space: pre");
  });
});
