import { describe, it, expect } from "vitest";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import { parseBlocks } from "../markdown/parse";

/**
 * The kit's own markdown parser, checked against the one it replaced.
 *
 * `unified` + `remark` was 31.6 KB gzip — a third of the package — and the
 * slowest thing in it. Replacing it with three hundred lines is only safe if
 * the replacement is held to the original, so `remark` stays a **dev**
 * dependency and this parses the same corpus through both.
 *
 * What is compared is the parse projected onto the shape the renderer actually
 * reads. `remark` carries source positions and a handful of fields nothing
 * downstream touches; comparing those would fail on differences that cannot
 * reach a pixel.
 */
const reference = unified().use(remarkParse).use(remarkGfm);

/** The fields the renderer reads, and nothing else. */
const KEEP: Record<string, string[]> = {
  heading: ["depth"],
  list: ["ordered", "start"],
  code: ["lang", "value"],
  text: ["value"],
  inlineCode: ["value"],
  link: ["url", "title"],
  image: ["url", "alt"],
};

type Node = { type: string; children?: Node[]; [k: string]: unknown };

/** Adjacent text nodes tokenise identically however they were split. */
function mergeText(nodes: Node[]): Node[] {
  const out: Node[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === "text" && last?.type === "text") {
      last.value = String(last.value) + String(node.value);
      continue;
    }
    out.push(node);
  }
  return out;
}

/**
 * A short table row, padded to the header.
 *
 * The one place the two deliberately differ. GFM pads a short row with empty
 * cells when it renders, and `remark` leaves that to the renderer while this
 * does it in the parse — which during streaming means the table's last column
 * stays put instead of popping in and out as each row is typed. Padding both
 * sides here compares what actually reaches the screen.
 */
function padRows(table: Node): Node {
  const rows = table.children ?? [];
  const width = rows[0]?.children?.length ?? 0;
  return {
    ...table,
    children: rows.map((row) => ({
      ...row,
      children: Array.from({ length: width }, (_, at) => row.children?.[at] ?? { type: "tableCell", children: [] }),
    })),
  };
}

function normalise(node: Node): Node {
  // Raw html is dropped by the renderer, so only its presence is comparable.
  if (node.type === "html") return { type: "html" };

  const out: Node = { type: node.type };
  for (const field of KEEP[node.type] ?? []) {
    const value = node[field];
    // `remark` writes `title: null` and `start: null`; this writes neither.
    if (value !== null && value !== undefined) out[field] = value;
  }
  if (Array.isArray(node.children)) {
    out.children = mergeText(node.children.map(normalise));
  }
  return node.type === "table" ? padRows(out) : out;
}

const both = (md: string) => ({
  ours: mergeText((parseBlocks(md) as unknown as Node[]).map(normalise)),
  remark: mergeText((reference.parse(md).children as unknown as Node[]).map(normalise)),
});

/** What a model actually writes, plus the shapes that have caught this out. */
const CORPUS: [name: string, md: string][] = [
  ["a plain paragraph", "Particle physics studies the fundamental constituents of matter."],
  ["two paragraphs", "The first one.\n\nThe second one."],
  ["a wrapped paragraph", "One line\nand its continuation\nand another."],
  ["emphasis", "The **Standard Model** organises *twelve* fermions."],
  ["underscore emphasis", "The __Standard Model__ organises _twelve_ fermions."],
  ["no emphasis inside a word", "A file called snake_case_name.py and another_one_here."],
  ["nested emphasis", "**bold with *italic* inside**"],
  ["strikethrough", "It was ~~ten~~ twelve."],
  ["inline code", "So `how big is it` has one answer, with `mass`."],
  ["a backtick inside code", "Use `` ` `` for a code span."],
  ["a link", "Found at [CERN](https://home.cern) in 2012."],
  ["a link with a title", 'See [the paper](https://x.dev "The paper").'],
  ["a bare bracket", "An array like [1, 2, 3] is not a link."],
  ["an image", "![a chart](https://x.dev/c.png)"],
  ["headings", "# One\n\n## Two\n\n### Three"],
  ["a bullet list", "- twelve fermions\n- the bosons\n- the Higgs"],
  ["an ordered list", "1. first\n2. second\n3. third"],
  ["an ordered list starting elsewhere", "3. third\n4. fourth"],
  ["a list with emphasis", "- **six** quarks\n- six *leptons*"],
  ["a fenced block", "```js\nconst a = 1;\nconst b = 2;\n```"],
  ["a fenced block with no language", "```\nplain\n```"],
  ["a tilde fence", "~~~py\nx = 1\n~~~"],
  ["a table", "| property | value |\n| --- | --- |\n| mass | 125 GeV |\n| spin | 0 |"],
  ["an aligned table", "| a | b |\n|:--|--:|\n| 1 | 2 |"],
  ["a table with emphasis", "| a | b |\n| --- | --- |\n| **x** | `y` |"],
  ["a blockquote", "> Something somebody said.\n> On two lines."],
  ["a thematic break", "before\n\n---\n\nafter"],
  ["an escape", "Not \\*emphasis\\* at all."],
  ["raw html", "before <img src=x onerror=alert(1)> after"],
  ["a hard break", "first line  \nsecond line"],
  [
    "a whole answer",
    [
      "Particle physics studies the most fundamental constituents of matter.",
      "The **Standard Model** organises them into three families:",
      "- twelve fermions — six quarks and six leptons\n- the force-carrying bosons\n- the Higgs, which gives the rest their mass",
      "| property | value |\n| --- | --- |\n| mass | ~125 GeV/c² |\n| charge | 0 |",
      "So 'how big is it' has only one honest answer: it has no size, only `mass`.",
    ].join("\n\n"),
  ],
];

describe("the parser agrees with the one it replaced", () => {
  it.each(CORPUS)("%s", (_name, md) => {
    const { ours, remark } = both(md);
    expect(ours).toEqual(remark);
  });

  /**
   * Streaming parses every prefix of an answer, one per frame. A parser that
   * agrees on whole documents and disagrees halfway through one would show it
   * as flicker rather than as a failure, so the prefixes are checked too.
   */
  it("agrees on every prefix of an answer, which is what streaming parses", () => {
    const [, whole] = CORPUS[CORPUS.length - 1];
    const disagreed: number[] = [];
    for (let at = 1; at <= whole.length; at += 7) {
      const { ours, remark } = both(whole.slice(0, at));
      if (JSON.stringify(ours) !== JSON.stringify(remark)) disagreed.push(at);
    }
    expect(disagreed, `prefixes that parsed differently: ${disagreed.join(", ")}`).toEqual([]);
  });
});
