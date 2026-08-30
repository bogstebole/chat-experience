/**
 * Syntax highlighting, loaded only once something needs it.
 *
 * `lowlight` and eleven grammars are **22.4 kB gzipped** — more than a third
 * of this package, for a thing most conversations never show. Imported at the
 * top of the module they were in everybody's bundle whether or not an answer
 * ever contained a fence.
 *
 * So the grammars sit behind a dynamic `import()` and the module itself keeps
 * only the names. A block renders its code unhighlighted on the first paint
 * and colours in when the chunk lands; every block after that is highlighted
 * from the first paint, because the loaded highlighter is kept.
 *
 * What is *not* deferred is knowing whether a language can be highlighted at
 * all — `canHighlight` answers off the list below, so a caller can decide what
 * to draw without pulling 22 kB to find out.
 */

/**
 * Eleven languages, chosen and measured rather than taken wholesale.
 *
 * `lowlight/common` is 37 languages and 51.6 kB gzipped — nearly the size of
 * everything else in this package put together, for grammars a chat will
 * almost never show. These cost a quarter of that and cover what actually
 * turns up in an answer. A language outside the list renders unhighlighted
 * rather than throwing; nobody loses their code over a missing grammar.
 *
 * Written out rather than read off the registry, because reading the registry
 * means loading it. A test holds this list against what `load()` registers.
 */
const LANGUAGES = [
  "bash",
  "css",
  "diff",
  "javascript",
  "json",
  "markdown",
  "python",
  "sql",
  "typescript",
  "xml",
  "yaml",
] as const;

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

const KNOWN = new Set<string>(LANGUAGES);

/** A run of code with one highlight class, or none. */
export interface CodeToken {
  value: string;
  /** The `hljs-` class, without the prefix. `null` for plain text. */
  kind: string | null;
}

/** The whole block, one run, no colour. What a block shows before the chunk
    arrives and what it keeps for a language nothing here can read. */
export const plain = (code: string): CodeToken[] => [{ value: code, kind: null }];

const resolve = (lang?: string): string | null => {
  if (!lang) return null;
  const name = ALIASES[lang.toLowerCase()] ?? lang.toLowerCase();
  return KNOWN.has(name) ? name : null;
};

/** Whether the fence's language is one we can actually colour. */
export const canHighlight = (lang?: string): boolean => resolve(lang) !== null;

export type Highlighter = (code: string, lang?: string) => CodeToken[];

/**
 * Flatten highlight.js's tree into a list of runs.
 *
 * The tree nests — a string inside a template inside a function — and only the
 * innermost class is worth drawing, so the walk carries the nearest one down
 * and emits a flat list. Flat is also what renders without a recursive
 * component, and a code block is the one place in an answer where the DOM is
 * worth keeping shallow: a long file is thousands of nodes either way.
 */
type Node = {
  type: string;
  value?: string;
  children?: Node[];
  properties?: { className?: string[] };
};

function flatten(tree: Node): CodeToken[] {
  const tokens: CodeToken[] = [];
  const push = (value: string, kind: string | null) => {
    if (!value) return;
    const last = tokens[tokens.length - 1];
    // Runs of the same kind are joined, which is most of them.
    if (last && last.kind === kind) last.value += value;
    else tokens.push({ value, kind });
  };

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

  walk(tree.children ?? [], null);
  return tokens;
}

/** Set once the chunk has landed, so every block after the first is coloured
    on its first paint rather than flashing plain and correcting itself. */
let ready: Highlighter | null = null;
let loading: Promise<Highlighter> | null = null;

/** The highlighter, if some block has already paid for it. */
export const loaded = (): Highlighter | null => ready;

/**
 * Fetch the grammars, once.
 *
 * Concurrent callers share the one promise: three code blocks in an answer
 * arrive together, and three requests for the same chunk is two too many.
 */
export function loadHighlighter(): Promise<Highlighter> {
  if (ready) return Promise.resolve(ready);
  if (loading) return loading;

  loading = (async () => {
    /* One module, not thirteen `import()`s: `lowlight`'s own entry re-exports
       `all` and `common` beside `createLowlight`, so importing the package
       dynamically pulls 190 grammars that nothing can shake back out. The
       static imports live in `./grammars`, which is the chunk. */
    const { createHighlighter } = await import("./grammars");
    const lowlight = createHighlighter();

    ready = (code, lang) => {
      const name = resolve(lang);
      if (!name) return plain(code);
      try {
        const tokens = flatten(lowlight.highlight(name, code) as unknown as Node);
        return tokens.length > 0 ? tokens : plain(code);
      } catch {
        // A grammar can throw on input it cannot make sense of. Unhighlighted
        // code is a small loss; a chat that crashes on one answer is not.
        return plain(code);
      }
    };
    return ready;
  })();

  return loading;
}
