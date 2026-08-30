import { describe, it, expect } from "vitest";

/**
 * What a third party gets when they install this.
 *
 * The playground exists to build the kit and carries the tooling that job
 * needs — a DialKit panel for tuning motion, a perf HUD, canned demo answers.
 * None of it is the kit's. A dev tool that quietly becomes a runtime
 * dependency is the kind of thing nobody notices until somebody else runs
 * `npm install` and finds a debug panel in their bundle.
 *
 * So the list is pinned here rather than described in a README. Adding to it
 * is a decision, and this is where you make it.
 */
const pkg = async () =>
  JSON.parse((await import("../../package.json?raw")).default as string) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

/** Everything the kit ships as its own, and why it is worth the weight. */
const RUNTIME = {
  lowlight: "syntax highlighting in a code block",
  /* Its grammars, imported one at a time rather than as the 200-language
     bundle. `lowlight` depends on it too, and for a while that was the only
     reason it resolved — an undeclared import that worked because npm
     happened to hoist somebody else's dependency into reach. Under a strict
     resolver, or the day `lowlight` picks a different highlighter, that is a
     consumer's build breaking on an import this package wrote. This test is
     what found it. */
  "highlight.js": "the grammars themselves",
};

/** Everything it expects the host to already have. */
const PEERS = ["lucide-react", "motion", "react", "react-dom"];

describe("what installing this costs", () => {
  it("ships one runtime dependency", async () => {
    const { dependencies } = await pkg();
    expect(Object.keys(dependencies ?? {}).sort()).toEqual(Object.keys(RUNTIME).sort());
  });

  it("asks the host for what the host already has", async () => {
    const { peerDependencies } = await pkg();
    expect(Object.keys(peerDependencies ?? {}).sort()).toEqual([...PEERS].sort());
  });

  /**
   * Named rather than covered by the counts above, because this is the one
   * somebody would reach for while working *in* the playground and not notice
   * they had reached across.
   */
  it("keeps the playground's tooling out of the package", async () => {
    const { dependencies, peerDependencies } = await pkg();
    const declared = Object.keys({ ...dependencies, ...peerDependencies });
    for (const tool of ["dialkit"]) {
      expect(declared, `${tool} is the playground's`).not.toContain(tool);
    }
  });

  /**
   * The grammars are 25 kB gzip, and most conversations never show a fence.
   *
   * They live in `CodeBlock/grammars.ts` and nothing may import that module
   * statically — one `import` from anywhere the entry can reach folds the
   * chunk straight back into everybody's bundle, with nothing failing. Which
   * is why this is checked rather than remembered.
   *
   * `grammars.ts` is the one file allowed to import `lowlight` and
   * `highlight.js` directly, and it has to: `lowlight`'s entry re-exports
   * `all` (190 grammars) beside `createLowlight`, so importing the *package*
   * dynamically materialises the whole namespace — 301 kB gzip, thirteen
   * times what deferring it saves. Static named imports inside a deferred
   * module shake normally; that is the entire trick.
   */
  it("keeps the syntax grammars in a chunk nothing pulls in", async () => {
    const files = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default" });
    for (const [name, read] of Object.entries(files)) {
      if (name.startsWith("./") || name.startsWith("../stories/")) continue;
      const src = (await read()) as string;
      const statics = [...src.matchAll(/(?:^|\n)\s*import[^;]*?from\s+"([^"]+)"/g)].map(
        (m) => m[1] as string
      );

      expect(
        statics.some((spec) => /(^|\/)grammars$/.test(spec)),
        `${name} imports the grammars statically; it has to be an import()`
      ).toBe(false);

      if (name.endsWith("/grammars.ts")) continue;
      for (const spec of statics) {
        expect(
          /^(lowlight|highlight\.js)/.test(spec),
          `${name} imports ${spec}; only grammars.ts may, and only statically`
        ).toBe(false);
      }
    }
  });

  /**
   * The list of languages is written out in `highlight.ts` so that
   * `canHighlight` can answer without loading anything. Written out means it
   * can disagree with what `grammars.ts` actually registers — a language the
   * list claims and the chunk does not would answer `true` and render plain.
   */
  it("registers exactly the languages it claims", async () => {
    const { canHighlight, loadHighlighter } = await import("../CodeBlock/highlight");
    const highlight = await loadHighlighter();

    const grammars = (await import("../CodeBlock/grammars.ts?raw")).default as string;
    const registered = [
      ...grammars.matchAll(/from "highlight\.js\/lib\/languages\/([\w-]+)"/g),
    ].map((m) => m[1] as string);
    expect(registered.length).toBeGreaterThan(0);

    const src = (await import("../CodeBlock/highlight.ts?raw")).default as string;

    for (const lang of registered) {
      expect(canHighlight(lang), `${lang} is loaded but not claimed`).toBe(true);
      /* And actually colours something, rather than being registered under a
         name the grammar does not answer to. */
      expect(highlight("x", lang).length).toBeGreaterThan(0);
    }

    const claimed = [...src.matchAll(/^ {2}"([\w-]+)",$/gm)].map((m) => m[1] as string);
    expect(claimed.sort()).toEqual([...registered].sort());
  });

  it("imports nothing the package does not declare", async () => {
    const files = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default" });
    const allowed = new Set([...Object.keys(RUNTIME), ...PEERS]);

    for (const [name, read] of Object.entries(files)) {
      const src = (await read()) as string;
      /* Static and dynamic both. A deferred import is still an import: the
         grammars moved behind an `import()` and would otherwise have stopped
         being checked at the moment they stopped being static. */
      const specs = [
        ...[...src.matchAll(/(?:^|\n)\s*import[^;]*?from\s+"([^"]+)"/g)].map((m) => m[1]),
        ...[...src.matchAll(/\bimport\("([^"]+)"\)/g)].map((m) => m[1]),
      ];
      for (const spec of specs) {
        /* Relative, a Node builtin, or a stylesheet — none of them a package. */
        if (spec.startsWith(".") || spec.startsWith("node:") || spec.endsWith(".css")) continue;
        /* `motion/react`, `lucide-react/icons/x` — the package is the head. */
        const owner = spec.startsWith("@")
          ? spec.split("/").slice(0, 2).join("/")
          : (spec.split("/")[0] as string);
        /* Tests, their harness, and stories reach for things that ship with
           none of it. The glob runs from this file, so a `./…` key is a
           sibling here in `__tests__` — there is no `__tests__` left in the
           path to match on. */
        if (name.startsWith("./") || name.startsWith("../stories/")) continue;
        expect(allowed.has(owner), `${name} imports ${owner}, which is not declared`).toBe(true);
      }
    }
  });
});
