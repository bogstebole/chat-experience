import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { parseBlocks, type Phrasing } from "../markdown/parse";
import { parseMarkdown } from "../markdown/parseMarkdown";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";
import type { Source } from "../Sources/Sources";

/**
 * `[^1]` in a streamed answer.
 *
 * The kit's one extension to the markdown grammar, and it exists for a reason
 * worth stating: a citation is a component, a stream sends text, so before
 * this `InlineCitation` could only be written by hand in JSX. It was in
 * Storybook and unreachable from an actual conversation.
 */
/** The inline children of the first block, which every case here is. */
const phrasing = (src: string): Phrasing[] => {
  const [block] = parseBlocks(src);
  if (!block || !("children" in block)) throw new Error(`not a paragraph: ${src}`);
  return block.children as Phrasing[];
};

const SOURCES: Source[] = [
  { id: "a", title: "ATLAS and CMS combined measurement", origin: "cern.ch" },
  { id: "b", title: "Particle Data Group", origin: "pdg.lbl.gov" },
];

describe("a citation in the text", () => {
  it("reads the marker as its own node", () => {
    expect(parseBlocks("about 125 GeV[^1], measured")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", value: "about 125 GeV" },
          { type: "citation", index: 1 },
          { type: "text", value: ", measured" },
        ],
      },
    ]);
  });

  /** Two digits, because a long answer can cite more than nine things. */
  it("takes a number of any length up to three digits", () => {
    const cites = (src: string) => phrasing(src).filter((n) => n.type === "citation");
    expect(cites("a[^12]b")).toEqual([{ type: "citation", index: 12 }]);
    expect(cites("a[^1234]b")).toEqual([]);
  });

  /** Anything that is not a plain number stays what it was. */
  it.each(["[^]", "[^a]", "[^1", "[^ 1]", "[]"])("leaves %s alone", (src) => {
    expect(phrasing(`x ${src} y`).some((n) => n.type === "citation")).toBe(false);
  });

  /**
   * A link is `[label](url)` and a footnote definition is `[^1]: …`. Neither
   * may be eaten by the marker; the first is the branch it sits in front of.
   */
  it("does not take a link with it", () => {
    expect(phrasing("see [the paper](https://example.com)")).toEqual([
      { type: "text", value: "see " },
      {
        type: "link",
        url: "https://example.com",
        children: [{ type: "text", value: "the paper" }],
      },
    ]);
  });

  /**
   * The marker is not a word of the answer.
   *
   * Tokenising it would put `[1]` inside a highlight somebody drew and inside
   * the text a thread quotes back — which is not what they marked.
   */
  it("keeps the marker out of the tokens", () => {
    const { tokens } = parseMarkdown("about 125 GeV[^1], measured");
    expect(tokens.join("")).toBe("about 125 GeV, measured");
  });

  it("renders it as a citation, pointing at the nth source", () => {
    render(<TextHighlighter text="about 125 GeV[^2]." sources={SOURCES} />);
    /* A note rather than a button: nothing was handed a way to act on it, and
       a control that does nothing is worse than no control. */
    const cite = screen.getByRole("note", { name: "Source 2: Particle Data Group" });
    expect(cite).toHaveTextContent("2");
  });

  it("makes it a control when there is somewhere for it to go", () => {
    render(<TextHighlighter text="a[^1]" sources={SOURCES} onSelectSource={() => {}} />);
    expect(
      screen.getByRole("button", { name: /ATLAS and CMS combined measurement/ })
    ).toBeInTheDocument();
  });

  /**
   * The sources may not have arrived yet — a model streams the prose and the
   * list in whatever order it likes. A marker with nothing behind it is still
   * a marker, and starts working the moment the list lands.
   */
  it("draws a marker for a source that is not there yet", () => {
    render(<TextHighlighter text="about 125 GeV[^1]." />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});

/**
 * The same number in two places, sized for the two places.
 *
 * In the source list the numbers sit in a column and have to line up, so that
 * one is a square. In a sentence it is not: a single digit is about five
 * pixels wide inside a sixteen-pixel square, so five and a half pixels of empty
 * badge sat either side of it and the comma after it read as detached from the
 * number it belongs to.
 */
describe("the marker's fit", () => {
  const sheet = async (path: string) =>
    ((await import(/* @vite-ignore */ path)).default as string).replace(/\/\*[\s\S]*?\*\//g, "");

  const rule = (css: string, selector: string) => {
    const at = css.indexOf(`${selector} {`);
    expect(at, `${selector} is missing`).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf("}", at));
  };

  it("lets the one in a sentence take the width of its number", async () => {
    const css = await sheet("../InlineCitation/InlineCitation.module.css?raw");
    const marker = rule(css, ".marker");
    expect(marker, "the inline marker is back to a fixed square").not.toMatch(/min-width:/);
    /* Padding that tracks the number rather than a fixed square. */
    expect(marker).toMatch(/padding:\s*0\s+[\d.]+em/);
    /* Still a badge: a fill, a corner, and the row's height. */
    expect(marker).toMatch(/height:\s*var\(--ick-cite-size-marker\)/);
    expect(marker).toMatch(/background:\s*var\(--ick-cite-fill\)/);
  });

  it("keeps the one in the list a square, because a column has to line up", async () => {
    const css = await sheet("../Sources/Sources.module.css?raw");
    const number = rule(css, ".number");
    expect(number).toMatch(/min-width:\s*var\(--ick-cite-size-marker\)/);
    expect(number).toMatch(/height:\s*var\(--ick-cite-size-marker\)/);
  });
});
