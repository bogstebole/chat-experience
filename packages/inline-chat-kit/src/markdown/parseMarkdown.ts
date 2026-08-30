import { parseBlocks, type Block, type Phrasing } from "./parse";

/**
 * Markdown, in the one shape the highlighter can work with.
 *
 * The highlighter's whole model is a **flat array of word and space tokens**,
 * addressed by index. Hit-testing reads `data-index` off whatever is under the
 * pointer; the keyboard cursor walks the indices; the text of a highlight is
 * rebuilt by joining a run of them. Markdown is a tree, and the obvious move —
 * render markdown and highlight the result — breaks every one of those.
 *
 * So the tree and the indices are separated. Parsing produces both:
 *
 *   - `tokens`, still flat, still in reading order, exactly as before
 *   - `nodes`, a small tree that says where each token sits
 *
 * Nothing downstream changes. A stroke across `**bold**` is a run of indices
 * like any other, even though the words live in different elements.
 */
export type MdNode =
  /** One entry of `tokens`, by index. */
  | { type: "token"; index: number }
  | { type: "el"; tag: string; props?: Record<string, string>; children: MdNode[] }
  /** A fenced block. Preformatted, so it is not tokenised — see below. */
  | { type: "code"; lang?: string; value: string };

export interface MarkdownDoc {
  /** Flat, in reading order. The bridge to every existing mechanism. */
  tokens: string[];
  nodes: MdNode[];
}

/**
 * Separates two blocks in `tokens` without appearing in `nodes`.
 *
 * An index does not have to be rendered. Nothing requires every token to exist
 * in the DOM — the cursor only walks words, and hit-testing only finds what is
 * drawn. What this buys is a sane rebuild: without it, the last word of one
 * paragraph and the first of the next would be joined into one word.
 */
const BLOCK_BREAK = "\n\n";

const HEADINGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

class Builder {
  tokens: string[] = [];

  /** Split a run of text into words and spaces, and record where they went. */
  text(value: string): MdNode[] {
    const out: MdNode[] = [];
    for (const piece of value.split(/(\s+)/)) {
      if (piece === "") continue;
      out.push({ type: "token", index: this.tokens.length });
      this.tokens.push(piece);
    }
    return out;
  }

  /** A token nobody draws. Keeps the rebuilt text readable across blocks. */
  break(): void {
    this.tokens.push(BLOCK_BREAK);
  }
}

const el = (tag: string, children: MdNode[], props?: Record<string, string>): MdNode => ({
  type: "el",
  tag,
  children,
  ...(props ? { props } : {}),
});

/**
 * Map siblings, dropping a separator between each pair.
 *
 * Every place two pieces of text sit side by side with no whitespace of their
 * own needs this — list items, table cells, table rows. Without it the last
 * word of one and the first of the next are rebuilt as a single word, which is
 * how "one" and "two" first came back as "onetwo".
 */
function siblings<T>(items: T[], b: Builder, each: (item: T) => MdNode): MdNode[] {
  return items.map((item, i) => {
    if (i > 0) b.break();
    return each(item);
  });
}

function inline(nodes: Phrasing[], b: Builder): MdNode[] {
  const out: MdNode[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out.push(...b.text(node.value));
        break;
      case "strong":
        out.push(el("strong", inline(node.children, b)));
        break;
      case "emphasis":
        out.push(el("em", inline(node.children, b)));
        break;
      case "delete":
        out.push(el("del", inline(node.children, b)));
        break;
      case "inlineCode":
        // Tokenised, unlike a fenced block: this is a run of words inside a
        // sentence, and a stroke has to be able to cross it.
        out.push(el("code", b.text(node.value)));
        break;
      case "link":
        out.push(
          el("a", inline(node.children, b), {
            href: node.url,
            // Model output is untrusted text. A link in it goes to somebody
            // else's page, so it opens away from the conversation and cannot
            // reach back through `window.opener`.
            target: "_blank",
            rel: "noopener noreferrer",
            ...(node.title ? { title: node.title } : {}),
          })
        );
        break;
      case "image":
        out.push(el("img", [], { src: node.url, alt: node.alt ?? "" }));
        break;
      case "citation":
        /* Untokenised, like a fenced block and for the same reason: a marker
           is not a word of the answer. Tokenising it would put `[1]` inside a
           highlight and inside the text a thread quotes back, which is not
           what anybody drew a line under. */
        out.push(el("cite", [], { index: String(node.index) }));
        break;
      case "break":
        out.push(el("br", []));
        break;
      // `html` is deliberately dropped. Raw HTML from a model is arbitrary
      // markup in the host's page; there is no version of rendering it that is
      // worth the surface it opens.
      default:
        if ("children" in node && Array.isArray(node.children)) {
          out.push(...inline(node.children as Phrasing[], b));
        }
    }
  }
  return out;
}

function block(nodes: Block[], b: Builder): MdNode[] {
  const out: MdNode[] = [];
  nodes.forEach((node, i) => {
    if (i > 0) b.break();
    switch (node.type) {
      case "paragraph":
        out.push(el("p", inline(node.children, b)));
        break;
      case "heading":
        out.push(el(HEADINGS[node.depth - 1] ?? "h6", inline(node.children, b)));
        break;
      case "list":
        out.push(
          el(
            node.ordered ? "ol" : "ul",
            siblings(node.children, b, (item) => el("li", block(item.children, b))),
            node.ordered && node.start != null && node.start !== 1
              ? { start: String(node.start) }
              : undefined
          )
        );
        break;
      case "blockquote":
        out.push(el("blockquote", block(node.children, b)));
        break;
      case "code":
        out.push({ type: "code", value: node.value, ...(node.lang ? { lang: node.lang } : {}) });
        break;
      case "thematicBreak":
        out.push(el("hr", []));
        break;
      case "table": {
        const [head, ...body] = node.children;
        const cells = (row: typeof head, tag: "th" | "td") =>
          siblings(row.children, b, (cell) => el(tag, inline(cell.children, b)));
        // Built head-first so the indices run in reading order; `siblings`
        // only separates within a run, so the seam between the two needs one
        // of its own.
        const thead = head ? el("thead", [el("tr", cells(head, "th"))]) : null;
        if (thead && body.length) b.break();
        const tbody = body.length
          ? el("tbody", siblings(body, b, (row) => el("tr", cells(row, "td"))))
          : null;
        out.push(el("table", [thead, tbody].filter((n): n is MdNode => n !== null)));
        break;
      }
      default:
        if ("children" in node && Array.isArray(node.children)) {
          out.push(...inline(node.children as Phrasing[], b));
        }
    }
  });
  return out;
}

/**
 * Parse once per distinct string.
 *
 * Called from a `useMemo` keyed on the text, which during streaming still
 * means once per frame — the text is different every frame. That is measured
 * rather than assumed; see the note in `TextHighlighter`.
 */
export function parseMarkdown(text: string): MarkdownDoc {
  const b = new Builder();
  const nodes = block(parseBlocks(text), b);
  return { tokens: b.tokens, nodes };
}
