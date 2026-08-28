import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { parseMarkdown } from "../markdown/parseMarkdown";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

/** Everything the highlighter rebuilds is `tokens.join("")`, so this is it. */
const rebuilt = (md: string) => parseMarkdown(md).tokens.join("").replace(/\s+/g, " ").trim();

describe("the flat token array, which everything else depends on", () => {
  it("round-trips a plain paragraph", () => {
    expect(rebuilt("Particle physics studies matter.")).toBe("Particle physics studies matter.");
  });

  /** The words inside `**` are ordinary tokens; only their parent differs. */
  it("round-trips across emphasis", () => {
    expect(rebuilt("The **Standard Model** organises them.")).toBe(
      "The Standard Model organises them."
    );
  });

  it("round-trips across a link", () => {
    expect(rebuilt("Found at [CERN](https://cern.ch) in 2012.")).toBe("Found at CERN in 2012.");
  });

  /**
   * Two blocks have no whitespace of their own between them. Without a
   * separator the last word of one and the first of the next were rebuilt as a
   * single word — which is how "one" and "two" first came back as "onetwo".
   */
  it("separates paragraphs", () => {
    expect(rebuilt("First para.\n\nSecond para.")).toBe("First para. Second para.");
  });

  it("separates list items", () => {
    expect(rebuilt("- one\n- two")).toBe("one two");
  });

  it("separates table cells, including across the header seam", () => {
    expect(rebuilt("| a | b |\n| --- | --- |\n| 1 | 2 |")).toBe("a b 1 2");
  });

  it("indexes in reading order", () => {
    const { tokens } = parseMarkdown("one **two** three");
    expect(tokens.filter((t) => t.trim())).toEqual(["one", "two", "three"]);
  });
});

describe("the tree", () => {
  const tags = (md: string): string[] => {
    const out: string[] = [];
    const walk = (nodes: ReturnType<typeof parseMarkdown>["nodes"]) => {
      for (const n of nodes) {
        if (n.type === "el") {
          out.push(n.tag);
          walk(n.children);
        } else if (n.type === "code") out.push("pre");
      }
    };
    walk(parseMarkdown(md).nodes);
    return out;
  };

  it("builds paragraphs, headings and lists", () => {
    expect(tags("## Title\n\n- one\n- two")).toEqual(["h2", "ul", "li", "p", "li", "p"]);
  });

  it("builds emphasis, code and links", () => {
    expect(tags("**b** *i* `c` [l](https://x.dev)")).toEqual(["p", "strong", "em", "code", "a"]);
  });

  it("builds a fenced block, which is not tokenised", () => {
    const doc = parseMarkdown("```js\nconst a = 1;\n```");
    expect(doc.nodes[0]).toEqual({ type: "code", lang: "js", value: "const a = 1;" });
    expect(doc.tokens).toEqual([]);
  });

  it("builds gfm tables and strikethrough", () => {
    expect(tags("| a |\n| --- |\n| 1 |")).toEqual(["table", "thead", "tr", "th", "tbody", "tr", "td"]);
    expect(tags("~~gone~~")).toEqual(["p", "del"]);
  });

  /**
   * Raw HTML in model output is arbitrary markup in the host's page. There is
   * no version of rendering it that is worth the surface it opens.
   */
  it("drops raw html rather than rendering it", () => {
    const doc = parseMarkdown("before <img src=x onerror=alert(1)> after");
    expect(JSON.stringify(doc)).not.toContain("onerror");
    expect(rebuilt("before <script>bad()</script> after")).not.toContain("script");
  });

  it("opens links away from the conversation", () => {
    const doc = parseMarkdown("[l](https://x.dev)");
    const p = doc.nodes[0];
    const a = p.type === "el" ? p.children[0] : null;
    expect(a && a.type === "el" && a.props).toMatchObject({
      href: "https://x.dev",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });
});

describe("the highlighter over markdown", () => {
  const MD = "The **Standard Model** organises them.\n\n- twelve fermions\n- the bosons";

  it("renders real elements, not escaped characters", () => {
    const { container } = render(<TextHighlighter text={MD} />);
    expect(container.querySelector("strong")).toBeInTheDocument();
    expect(container.querySelector("ul")).toBeInTheDocument();
    expect(container.textContent).not.toContain("**");
  });

  /** A span may not contain a `<p>`; the container has to be a block element. */
  it("puts the blocks in a div rather than a span", () => {
    const { container } = render(<TextHighlighter text={MD} />);
    const list = container.querySelector("ul")!;
    expect(list.closest("span")).toBeNull();
  });

  it("keeps every word addressable, whatever element it sits in", () => {
    const { container } = render(<TextHighlighter text={MD} />);
    const inBold = container.querySelector("strong [data-index]");
    const inList = container.querySelector("li [data-index]");
    expect(inBold).toBeInTheDocument();
    expect(inList).toBeInTheDocument();
  });

  it("numbers the spans in reading order across elements", () => {
    const { container } = render(<TextHighlighter text="one **two** three" />);
    const words = [...container.querySelectorAll("[data-index]")]
      .filter((el) => el.textContent?.trim())
      .map((el) => el.textContent);
    expect(words).toEqual(["one", "two", "three"]);
  });

  it("does not tokenise a fenced block", () => {
    // Braces, not quotes: a JSX string attribute does not process escapes, so
    // `text="a\nb"` passes a literal backslash-n and the fence never closes.
    const { container } = render(<TextHighlighter text={"```js\nconst a = 1;\n```"} />);
    expect(container.querySelector("pre code")?.textContent).toBe("const a = 1;");
    expect(container.querySelectorAll("[data-index]")).toHaveLength(0);
  });
});

describe("selecting across an element boundary", () => {
  beforeEach(() => {
    // See TextHighlighter.highlights.test.tsx — no measurement, no highlight.
    vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
      { left: 10, top: 20, width: 120, height: 16 },
    ] as unknown as DOMRectList);
  });
  afterEach(() => vi.restoreAllMocks());

  /**
   * The point of the whole exercise: a run that starts in plain text and ends
   * inside `**bold**` is one run of indices like any other.
   */
  it("carries the emphasised words out with the rest", () => {
    const onHighlightComplete = vi.fn();
    const { container } = render(
      <TextHighlighter text="The **Standard Model** organises" onHighlightComplete={onHighlightComplete} />
    );
    const surface = container.querySelector("[tabindex]") as HTMLElement;

    // Word cursor onto "The", then extend across the bold run.
    fireEvent.keyDown(surface, { key: "ArrowRight" });
    fireEvent.keyDown(surface, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(surface, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(surface, { key: "Enter" });

    expect(onHighlightComplete).toHaveBeenCalledWith("The Standard Model");
  });
});
