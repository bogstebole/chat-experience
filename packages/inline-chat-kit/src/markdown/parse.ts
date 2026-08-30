/**
 * Markdown, parsed here rather than by `unified` + `remark`.
 *
 * That pipeline was 31.6 KB gzip — a third of the whole package — and the
 * slowest thing in it: 0.9ms per thousand characters, 8.9ms at ten thousand,
 * which is half a frame spent re-parsing an answer that grew by one word.
 *
 * The kit uses a thin slice of it. `parseMarkdown` walks the tree straight
 * into a flat token list and a handful of elements, and it touches nine block
 * types and nine inline ones. This produces exactly those, in the same shape,
 * so nothing downstream changed.
 *
 * **It is not a CommonMark implementation and does not try to be.** It handles
 * what a model actually writes. Where it diverges from `remark` the difference
 * is caught rather than assumed: `remark` stays a dev dependency and a test
 * parses a corpus through both and compares the finished documents.
 */

export type Phrasing =
  | { type: "text"; value: string }
  | { type: "strong"; children: Phrasing[] }
  | { type: "emphasis"; children: Phrasing[] }
  | { type: "delete"; children: Phrasing[] }
  | { type: "inlineCode"; value: string }
  | { type: "link"; url: string; title?: string; children: Phrasing[] }
  | { type: "image"; url: string; alt: string }
  /**
   * `[^1]` — a citation marker, pointing at the nth source of the turn.
   *
   * The kit's one extension to the grammar, and the only place this parser
   * deliberately reads something `remark` does not. GFM spells footnotes the
   * same way but needs a `[^1]: …` definition somewhere in the document to
   * make one; a model streaming an answer emits the marker and sends the
   * sources beside the text, never below it. Without this an `InlineCitation`
   * can only be written by hand in JSX, which a stream cannot do — so the
   * component existed and nothing in a real conversation could reach it. */
  | { type: "citation"; index: number }
  | { type: "break" }
  /** Recognised so it can be dropped, which is what the renderer does with it. */
  | { type: "html"; value: string };

export interface ListItem {
  type: "listItem";
  children: Block[];
}

export interface TableCell {
  type: "tableCell";
  children: Phrasing[];
}

export interface TableRow {
  type: "tableRow";
  children: TableCell[];
}

export type Block =
  | { type: "paragraph"; children: Phrasing[] }
  | { type: "heading"; depth: number; children: Phrasing[] }
  | { type: "list"; ordered: boolean; start?: number; children: ListItem[] }
  | { type: "blockquote"; children: Block[] }
  | { type: "code"; lang?: string; value: string }
  | { type: "thematicBreak" }
  | { type: "table"; children: TableRow[] }
  | { type: "html"; value: string };

/* ─────────────────────────────────────────────
   Inline
   ───────────────────────────────────────────── */

/** `\*` and friends: the next character is itself, not syntax. */
const ESCAPABLE = "\\`*_{}[]()#+-.!>~|";

const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

/**
 * A run of `*` or `_` that can open or close emphasis.
 *
 * The full CommonMark rule is about flanking runs and unicode punctuation.
 * This is the part of it that matters for prose: a marker opens if what
 * follows is not a space and closes if what precedes is not one, and `_`
 * additionally has to sit at a word boundary — otherwise `snake_case_name`
 * comes back italic, which is the one failure anybody would actually hit.
 */
function canOpen(src: string, at: number, run: number, char: string): boolean {
  const after = src[at + run];
  if (isSpace(after)) return false;
  if (char === "_" && /[\w]/.test(src[at - 1] ?? "")) return false;
  return true;
}

function canClose(src: string, at: number, run: number, char: string): boolean {
  const before = src[at - 1];
  if (isSpace(before)) return false;
  if (char === "_" && /[\w]/.test(src[at + run] ?? "")) return false;
  return true;
}

/** How many of `char` start at `at`. */
function runLength(src: string, at: number, char: string): number {
  let n = 0;
  while (src[at + n] === char) n++;
  return n;
}

/** The index of the `]` matching the `[` at `open`, or -1. */
function closingBracket(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "`") {
      // A bracket inside a code span is not a bracket.
      const run = runLength(src, i, "`");
      const end = src.indexOf("`".repeat(run), i + run);
      i = end === -1 ? src.length : end + run - 1;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * `(url "title")` after a link's `]`.
 *
 * Returns where it ends, so the caller knows how much to consume. Angle
 * brackets around the url are stripped, which is how a url with a space in it
 * is written.
 */
function destination(src: string, open: number): { url: string; title?: string; end: number } | null {
  if (src[open] !== "(") return null;
  let depth = 0;
  let close = -1;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "\\") {
      i++;
      continue;
    }
    if (src[i] === "(") depth++;
    else if (src[i] === ")") {
      depth--;
      if (depth === 0) {
        close = i;
        break;
      }
    }
  }
  if (close === -1) return null;

  const inner = src.slice(open + 1, close).trim();
  const quoted = inner.match(/^(.*?)\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\))$/s);
  const rawUrl = (quoted ? quoted[1] : inner).trim();
  const title = quoted ? (quoted[2] ?? quoted[3] ?? quoted[4]) : undefined;
  const url = rawUrl.startsWith("<") && rawUrl.endsWith(">") ? rawUrl.slice(1, -1) : rawUrl;
  return { url, ...(title ? { title } : {}), end: close + 1 };
}

/** Anything shaped like a tag, so it can be recognised and thrown away. */
const HTML_TAG = /^<\/?[A-Za-z][A-Za-z0-9-]*(\s[^<>]*?)?\/?>|^<!--[\s\S]*?-->/;

export function parseInline(src: string): Phrasing[] {
  const out: Phrasing[] = [];
  let text = "";

  const flush = () => {
    if (text) out.push({ type: "text", value: text });
    text = "";
  };

  let i = 0;
  while (i < src.length) {
    const c = src[i];

    // A backslash before punctuation, or before a newline: an escape or a break.
    if (c === "\\") {
      const next = src[i + 1];
      if (next === "\n") {
        flush();
        out.push({ type: "break" });
        i += 2;
        continue;
      }
      if (next && ESCAPABLE.includes(next)) {
        text += next;
        i += 2;
        continue;
      }
      text += c;
      i++;
      continue;
    }

    // Two spaces at the end of a line is a hard break.
    if (c === " " && src[i + 1] === " " && /^ *\n/.test(src.slice(i))) {
      const nl = src.indexOf("\n", i);
      flush();
      out.push({ type: "break" });
      i = nl + 1;
      continue;
    }

    if (c === "`") {
      const run = runLength(src, i, "`");
      const close = src.indexOf("`".repeat(run), i + run);
      // An unmatched run is literal backticks, not the start of anything.
      if (close !== -1 && !src.slice(i + run, close).startsWith("`")) {
        flush();
        let value = src.slice(i + run, close);
        // One space either side is the fence, not the content — it is how you
        // write a span that itself starts with a backtick.
        if (value.length > 2 && value.startsWith(" ") && value.endsWith(" ") && value.trim()) {
          value = value.slice(1, -1);
        }
        out.push({ type: "inlineCode", value: value.replace(/\n/g, " ") });
        i = close + run;
        continue;
      }
    }

    if (c === "!" && src[i + 1] === "[") {
      const close = closingBracket(src, i + 1);
      const dest = close === -1 ? null : destination(src, close + 1);
      if (dest) {
        flush();
        out.push({ type: "image", url: dest.url, alt: src.slice(i + 2, close) });
        i = dest.end;
        continue;
      }
    }

    /* Before the link branch, which would otherwise take `[^1]` as a label
       and then fail to find a `(url)` after it — leaving the marker as text. */
    if (c === "[" && src[i + 1] === "^") {
      const close = src.indexOf("]", i + 2);
      const digits = close === -1 ? null : src.slice(i + 2, close);
      if (digits && /^\d{1,3}$/.test(digits)) {
        flush();
        out.push({ type: "citation", index: Number(digits) });
        i = close + 1;
        continue;
      }
    }

    if (c === "[") {
      const close = closingBracket(src, i);
      const dest = close === -1 ? null : destination(src, close + 1);
      if (dest) {
        flush();
        out.push({
          type: "link",
          url: dest.url,
          ...(dest.title ? { title: dest.title } : {}),
          children: parseInline(src.slice(i + 1, close)),
        });
        i = dest.end;
        continue;
      }
    }

    if (c === "~" && src[i + 1] === "~") {
      const close = src.indexOf("~~", i + 2);
      if (close !== -1 && close > i + 2) {
        flush();
        out.push({ type: "delete", children: parseInline(src.slice(i + 2, close)) });
        i = close + 2;
        continue;
      }
    }

    if (c === "*" || c === "_") {
      const run = Math.min(runLength(src, i, c), 2);
      if (canOpen(src, i, run, c)) {
        // The first run of the same length that can close it.
        let j = i + run;
        let close = -1;
        while (j < src.length) {
          if (src[j] === "\\") {
            j += 2;
            continue;
          }
          if (src[j] === c) {
            const there = runLength(src, j, c);
            if (there >= run && canClose(src, j, run, c)) {
              close = j;
              break;
            }
            j += there;
            continue;
          }
          j++;
        }
        if (close !== -1 && close > i + run) {
          flush();
          const children = parseInline(src.slice(i + run, close));
          out.push(run === 2 ? { type: "strong", children } : { type: "emphasis", children });
          i = close + run;
          continue;
        }
      }
    }

    if (c === "<") {
      const tag = src.slice(i).match(HTML_TAG);
      if (tag) {
        flush();
        out.push({ type: "html", value: tag[0] });
        i += tag[0].length;
        continue;
      }
    }

    text += c;
    i++;
  }

  flush();
  return out;
}

/* ─────────────────────────────────────────────
   Blocks
   ───────────────────────────────────────────── */

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const RULE = /^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/;
const QUOTE = /^ {0,3}>\s?/;
const BULLET = /^(\s*)([-*+])(\s+)(.*)$/;
const ORDERED = /^(\s*)(\d{1,9})([.)])(\s+)(.*)$/;
const DELIMITER = /^ {0,3}\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;
const DELIMITER_CELL = /^:?-+:?$/;
const BLANK = /^\s*$/;

/** `| a | b |` → `["a", "b"]`, respecting `\|`. */
function cells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const out: string[] = [];
  let cell = "";
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === "\\" && trimmed[i + 1] === "|") {
      cell += "|";
      i++;
      continue;
    }
    if (trimmed[i] === "|") {
      out.push(cell.trim());
      cell = "";
      continue;
    }
    cell += trimmed[i];
  }
  out.push(cell.trim());
  return out;
}

const isBlockStart = (line: string) =>
  FENCE.test(line) ||
  HEADING.test(line) ||
  RULE.test(line) ||
  QUOTE.test(line) ||
  BULLET.test(line) ||
  ORDERED.test(line);

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (BLANK.test(line)) {
      i++;
      continue;
    }

    // ── Fenced code ────────────────────────────────────────────────────────
    const fence = line.match(FENCE);
    if (fence) {
      const marker = fence[1][0];
      const width = fence[1].length;
      const body: string[] = [];
      i++;
      while (i < lines.length) {
        const closing = lines[i].match(new RegExp(`^ {0,3}${marker === "`" ? "`" : "~"}{${width},}\\s*$`));
        if (closing) {
          i++;
          break;
        }
        body.push(lines[i]);
        i++;
      }
      out.push({ type: "code", value: body.join("\n"), ...(fence[2] ? { lang: fence[2] } : {}) });
      continue;
    }

    // ── Heading ────────────────────────────────────────────────────────────
    const heading = line.match(HEADING);
    if (heading) {
      out.push({
        type: "heading",
        depth: heading[1].length,
        children: parseInline(heading[2] ?? ""),
      });
      i++;
      continue;
    }

    // ── Thematic break ─────────────────────────────────────────────────────
    if (RULE.test(line)) {
      out.push({ type: "thematicBreak" });
      i++;
      continue;
    }

    // ── Blockquote ─────────────────────────────────────────────────────────
    if (QUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && !BLANK.test(lines[i])) {
        // Lazy continuation: a line inside a quote need not repeat the marker.
        quoted.push(lines[i].replace(QUOTE, ""));
        i++;
      }
      out.push({ type: "blockquote", children: parseBlocks(quoted.join("\n")) });
      continue;
    }

    // ── Table ──────────────────────────────────────────────────────────────
    /* A table needs a delimiter row with **as many cells as the header**, which
       is the rule that keeps a half-typed one from becoming a table a row
       early. Streaming parses every prefix of an answer, so `| --- ` arrives
       on its own for a frame or two and it is still a paragraph. */
    const delimiter =
      line.includes("|") && i + 1 < lines.length && DELIMITER.test(lines[i + 1])
        ? cells(lines[i + 1])
        : null;
    if (delimiter && delimiter.length === cells(line).length && delimiter.every((c) => DELIMITER_CELL.test(c))) {
      const header = cells(line);
      const rows: TableRow[] = [
        { type: "tableRow", children: header.map((c) => ({ type: "tableCell" as const, children: parseInline(c) })) },
      ];
      i += 2;
      while (i < lines.length && !BLANK.test(lines[i]) && lines[i].includes("|")) {
        const row = cells(lines[i]);
        rows.push({
          type: "tableRow",
          children: header.map((_, at) => ({
            type: "tableCell" as const,
            children: parseInline(row[at] ?? ""),
          })),
        });
        i++;
      }
      out.push({ type: "table", children: rows });
      continue;
    }

    // ── List ───────────────────────────────────────────────────────────────
    const bullet = line.match(BULLET);
    const ordered = line.match(ORDERED);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const start = ordered ? Number(ordered[2]) : undefined;
      const items: ListItem[] = [];

      while (i < lines.length) {
        const b = lines[i].match(BULLET);
        const o = lines[i].match(ORDERED);
        const m = isOrdered ? o : b;
        if (!m || Boolean(o) !== isOrdered) break;

        const indent = (isOrdered ? m[1].length + m[2].length + 1 + m[4].length : m[1].length + 1 + m[3].length);
        const body = [isOrdered ? m[5] : m[4]];
        i++;

        // Everything indented under the marker, and lazy lines that continue
        // the item's paragraph.
        while (i < lines.length) {
          const next = lines[i];
          if (BLANK.test(next)) {
            const after = lines[i + 1];
            if (after !== undefined && new RegExp(`^ {${indent},}\\S`).test(after)) {
              body.push("");
              i++;
              continue;
            }
            break;
          }
          if (new RegExp(`^ {${indent},}`).test(next)) {
            body.push(next.slice(indent));
            i++;
            continue;
          }
          if (BULLET.test(next) || ORDERED.test(next) || isBlockStart(next)) break;
          body.push(next.trim());
          i++;
        }

        items.push({ type: "listItem", children: parseBlocks(body.join("\n")) });
      }

      out.push({
        type: "list",
        ordered: isOrdered,
        ...(isOrdered && start !== undefined ? { start } : {}),
        children: items,
      });
      continue;
    }

    // ── Paragraph ──────────────────────────────────────────────────────────
    const para: string[] = [];
    while (i < lines.length && !BLANK.test(lines[i])) {
      if (para.length && isBlockStart(lines[i])) break;
      if (
        para.length &&
        lines[i].includes("|") &&
        i + 1 < lines.length &&
        DELIMITER.test(lines[i + 1])
      ) {
        break;
      }
      para.push(lines[i]);
      i++;
    }
    /* A paragraph's own indentation is not content: the leading whitespace of
       every line goes, and so does the trailing whitespace of the last one.
       Interior trailing spaces are left alone — two of them before a newline
       is a hard break, which is the one place whitespace means something. */
    const text = para.map((l) => l.replace(/^[ \t]+/, "")).join("\n").replace(/\s+$/, "");
    out.push({ type: "paragraph", children: parseInline(text) });
  }

  return out;
}
