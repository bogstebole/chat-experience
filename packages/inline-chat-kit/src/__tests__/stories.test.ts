import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Storybook is the source of truth for what this package looks like, which is
 * only true if it is complete. A component that is exported but has no story
 * is public API nobody can look at — and the drift starts the day someone is
 * in a hurry.
 *
 * So the rule is enforced rather than remembered: export a component, and this
 * fails until it has somewhere to be seen.
 */
const SRC = join(import.meta.dirname, "..");

/**
 * Exported, but not a component. Each one needs a reason — the list is a way
 * of saying "deliberately", not a way of opting out.
 */
const NOT_COMPONENTS: Record<string, string> = {
  useChatTurns: "a hook; its behaviour is covered by tests, not by looking",
  useVoiceInput:
    "a hook, and the only one here with a face: everything it draws is the ChatInput's microphone, whose states have their own story there",
  announce: "a function that writes to a live region; there is nothing to see",
  defaultInlineAnimConfig: "a configuration object",
  GlassButton: "deprecated wrapper around Button, which has the stories",
  FOLDABLE_FROM: "a number: the length above which a group offers to fold",
  answerChips: "a function that shortens an answer for its summary row",
  mergeParts:
    "a function that folds a part into a turn's list; what it produces is what the ChatTurnRow stories show",
  formatSize: "a function that turns a byte count into `1.2 MB`",
  loadHighlighter:
    "fetches the syntax grammars; what it produces is the colour in the CodeBlock stories",
  canHighlight: "asks whether a language is one of the eleven; answers a boolean",
};

const valueExports = (): string[] => {
  const index = readFileSync(join(SRC, "index.ts"), "utf8");
  const names: string[] = [];
  // `export { A, B } from "…"` but not `export type { … }`.
  for (const match of index.matchAll(/^export\s*\{([^}]*)\}\s*from/gm)) {
    const before = index.slice(0, match.index).split("\n").pop() ?? "";
    if (before.includes("export type")) continue;
    for (const part of match[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.push(name);
    }
  }
  return names;
};

const storySources = (): string => {
  const dir = join(SRC, "stories");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".stories.tsx"))
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
};

describe("Storybook covers the public API", () => {
  it("has a story for every exported component", () => {
    const stories = storySources();
    const missing = valueExports()
      .filter((name) => !(name in NOT_COMPONENTS))
      .filter((name) => !new RegExp(`\\b${name}\\b`).test(stories));

    expect(missing, `exported with nowhere to look at them: ${missing.join(", ")}`).toEqual([]);
  });

  /** The exemption list has to stay honest too — a stale entry hides a gap. */
  it("exempts only things that are still exported", () => {
    const exported = new Set(valueExports());
    const stale = Object.keys(NOT_COMPONENTS).filter((name) => !exported.has(name));
    expect(stale, `no longer exported, so the exemption is dead: ${stale.join(", ")}`).toEqual([]);
  });

  it("finds the exports at all, so a parsing failure cannot pass as coverage", () => {
    expect(valueExports().length).toBeGreaterThan(5);
  });
});
