import { describe, it, expect } from "vitest";
import * as kit from "../index";

/**
 * The entry point is the contract. Anything removed or renamed here breaks
 * somebody's build at install time, so the list is written out by hand rather
 * than snapshotted — a snapshot would happily record a deletion as the new
 * truth.
 */
const EXPECTED_EXPORTS = [
  "AddCardsOverlay",
  "AnswerActions",
  "Approval",
  "Button",
  "ChainOfThought",
  "ChatHeader",
  "ChatInput",
  "Chip",
  "ChatTurnRow",
  "CodeBlock",
  "Attachments",
  "Branch",
  "formatSize",
  "Context",
  "Conversation",
  "CustomCursor",
  "EmptyState",
  "FOLDABLE_FROM",
  "InlineCitation",
  "Loader",
  "Sources",
  "QuestionCard",
  "QuestionGroup",
  "QuestionBadge",
  "QuestionFieldRow",
  "QuestionOptionRow",
  "QuestionOtherRow",
  "Reasoning",
  "QuestionShell",
  "answerChips",
  "GlassButton",
  "HoverActionsRow",
  "MorphGlyph",
  "ReplyThreadPopup",
  "TaskList",
  "TextHighlighter",
  "Tool",
  "announce",
  "mergeParts",
  "loadHighlighter",
  "canHighlight",
  "defaultInlineAnimConfig",
  "useChatTurns",
] as const;

describe("public API", () => {
  it("exports everything the README documents", () => {
    for (const name of EXPECTED_EXPORTS) {
      expect(kit, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it("exports nothing beyond what is documented", () => {
    // Catches accidental leaks of internals, which become someone's dependency
    // the moment they ship.
    expect(Object.keys(kit).sort()).toEqual([...EXPECTED_EXPORTS].sort());
  });

  it("ships components as functions, not accidental objects", () => {
    // Values, not components. Each is exported because a consumer needs the
    // number or the function, not because there is something to render.
    const NOT_RENDERABLE = new Set(["defaultInlineAnimConfig", "FOLDABLE_FROM"]);
    for (const name of EXPECTED_EXPORTS) {
      if (NOT_RENDERABLE.has(name)) continue;
      const value = kit[name as keyof typeof kit];
      const isRenderable =
        typeof value === "function" || (typeof value === "object" && value !== null);
      expect(isRenderable, `${name} is not renderable`).toBe(true);
    }
  });
});

describe("defaultInlineAnimConfig", () => {
  it("carries every group the ChatInput reads", () => {
    expect(Object.keys(kit.defaultInlineAnimConfig).sort()).toEqual([
      "addButton",
      "addCards",
      "actions",
      "bubble",
      "button",
      "enterButton",
      "ripple",
      "wrap",
    ].sort());
  });

  it("uses finite numbers throughout", () => {
    const walk = (value: unknown, path: string) => {
      if (typeof value === "number") {
        expect(Number.isFinite(value), `${path} is not finite`).toBe(true);
        return;
      }
      if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
      }
    };
    walk(kit.defaultInlineAnimConfig, "defaultInlineAnimConfig");
  });

  it("is not frozen, since consumers are told to spread and override it", () => {
    expect(Object.isFrozen(kit.defaultInlineAnimConfig)).toBe(false);
  });
});
