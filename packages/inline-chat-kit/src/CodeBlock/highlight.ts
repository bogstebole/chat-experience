import { createLowlight } from "lowlight";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

/**
 * Ten languages, chosen and measured rather than taken wholesale.
 *
 * `lowlight/common` is 37 languages and 51.6 kB gzipped — nearly the size of
 * everything else in this package put together, for grammars a chat will
 * almost never show. These cost a quarter of that and cover what actually
 * turns up in an answer. A language outside the list renders unhighlighted
 * rather than throwing; nobody loses their code over a missing grammar.
 */
const lowlight = createLowlight({
  bash,
  css,
  diff,
  javascript,
  json,
  markdown,
  python,
  sql,
  typescript,
  xml,
  yaml,
});

/** What the fences people actually write map to. */
const ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  html: "xml",
  svg: "xml",
  vue: "xml",
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  console: "bash",
  py: "python",
  md: "markdown",
  postgres: "sql",
  psql: "sql",
  patch: "diff",
  yml: "yaml",
  yamllint: "yaml",
};

/** A run of code with one highlight class, or none. */
export interface CodeToken {
  value: string;
  /** The `hljs-` class, without the prefix. `null` for plain text. */
  kind: string | null;
}

const resolve = (lang?: string): string | null => {
  if (!lang) return null;
  const name = ALIASES[lang.toLowerCase()] ?? lang.toLowerCase();
  return lowlight.registered(name) ? name : null;
};

/** Whether the fence's language is one we can actually colour. */
export const canHighlight = (lang?: string): boolean => resolve(lang) !== null;

/**
 * Flatten highlight.js's tree into a list of runs.
 *
 * The tree nests — a string inside a template inside a function — and only the
 * innermost class is worth drawing, so the walk carries the nearest one down
 * and emits a flat list. Flat is also what renders without a recursive
 * component, and a code block is the one place in an answer where the DOM is
 * worth keeping shallow: a long file is thousands of nodes either way.
 */
export function highlightCode(code: string, lang?: string): CodeToken[] {
  const name = resolve(lang);
  if (!name) return [{ value: code, kind: null }];

  const tokens: CodeToken[] = [];
  const push = (value: string, kind: string | null) => {
    if (!value) return;
    const last = tokens[tokens.length - 1];
    // Runs of the same kind are joined, which is most of them.
    if (last && last.kind === kind) last.value += value;
    else tokens.push({ value, kind });
  };

  type Node = { type: string; value?: string; children?: Node[]; properties?: { className?: string[] } };

  const walk = (nodes: Node[], inherited: string | null) => {
    for (const node of nodes) {
      if (node.type === "text") {
        push(node.value ?? "", inherited);
        continue;
      }
      const own = node.properties?.className?.find((c) => c.startsWith("hljs-"));
      walk(node.children ?? [], own ? own.slice(5) : inherited);
    }
  };

  try {
    walk((lowlight.highlight(name, code) as unknown as Node).children ?? [], null);
  } catch {
    // A grammar can throw on input it cannot make sense of. Unhighlighted code
    // is a small loss; a chat that crashes on one answer is not.
    return [{ value: code, kind: null }];
  }

  return tokens.length > 0 ? tokens : [{ value: code, kind: null }];
}
