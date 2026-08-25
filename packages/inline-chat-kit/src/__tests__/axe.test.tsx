import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Button } from "../Button/Button";
import GlassButton from "../GlassButton/GlassButton";
import { ChatInput, type ChatInputState } from "../ChatInput/ChatInput";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";
import { ReplyThreadPopup } from "../ReplyThreadPopup/ReplyThreadPopup";
import { MessageCircle } from "lucide-react";

/**
 * axe over every component the package exports.
 *
 * This catches the mechanical half — missing names, broken ARIA relationships,
 * roles without their required children. It cannot catch whether any of it
 * makes sense to listen to; that is what the manual pass is for, and no number
 * of green runs here replaces it.
 *
 * Two groups of rules are off, both because they would be measuring nothing:
 *
 * - **Page-level rules.** These are fragments. A fragment does not own the
 *   page's landmarks, its heading order, or its skip links — the host app
 *   does, and failing a component for the host's structure is noise.
 * - **Colour contrast.** jsdom does not paint. axe would compare colours it
 *   cannot see and pass everything.
 */
const AXE_OPTIONS = {
  rules: {
    "color-contrast": { enabled: false },
    region: { enabled: false },
    "landmark-one-main": { enabled: false },
    "page-has-heading-one": { enabled: false },
    "html-has-lang": { enabled: false },
    bypass: { enabled: false },
  },
};

const check = async (container: HTMLElement) => {
  expect(await axe(container, AXE_OPTIONS)).toHaveNoViolations();
};

describe("axe — buttons", () => {
  it("passes for a button with a visible label", async () => {
    const { container } = render(<Button icon={<MessageCircle size={14} aria-hidden />}>Reply</Button>);
    await check(container);
  });

  it("passes for an icon-only button, which has nothing but its aria-label", async () => {
    const { container } = render(
      <Button icon={<MessageCircle size={14} aria-hidden />} aria-label="Reply in thread" />
    );
    await check(container);
  });

  it("passes for a disabled button", async () => {
    const { container } = render(
      <Button icon={<MessageCircle size={14} aria-hidden />} disabled>
        Reply
      </Button>
    );
    await check(container);
  });

  it("passes for the glass button, loading and not", async () => {
    const { container, rerender } = render(<GlassButton>Continue</GlassButton>);
    await check(container);
    rerender(<GlassButton loading>Continue</GlassButton>);
    await check(container);
  });
});

describe("axe — the input", () => {
  const states: ChatInputState[] = ["idle", "typing", "responding", "resting"];

  it.each(states)("passes in the %s state", async (state) => {
    const { container } = render(
      <ChatInput
        state={state}
        value={state === "idle" ? "" : "a question"}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        placeholder="Ask me anything"
      />
    );
    await check(container);
  });
});

describe("axe — the highlighter", () => {
  const TEXT = "Particle physics studies matter.";

  it("passes with nothing highlighted", async () => {
    const { container } = render(<TextHighlighter text={TEXT} />);
    await check(container);
  });

  it("passes in precise mode", async () => {
    const { container } = render(<TextHighlighter text={TEXT} selectionMode="precise" />);
    await check(container);
  });

  describe("with a highlight, and its menu open", () => {
    beforeEach(() => {
      // See TextHighlighter.highlights.test.tsx — no measurement, no highlight.
      vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
        { left: 10, top: 20, width: 120, height: 16 },
      ] as unknown as DOMRectList);
    });
    afterEach(() => vi.restoreAllMocks());

    it("passes", async () => {
      const { container } = render(<TextHighlighter text={TEXT} onReplyInThread={vi.fn()} />);
      const surface = container.querySelector("[tabindex]") as HTMLElement;
      fireEvent.keyDown(surface, { key: "ArrowRight" });
      fireEvent.keyDown(surface, { key: "ArrowRight", shiftKey: true });
      fireEvent.keyDown(surface, { key: "Enter" });

      expect(container.querySelector('[role="menu"]')).toBeInTheDocument();
      await check(container);
    });
  });
});

describe("axe — the reply thread", () => {
  it("passes as a dialog", async () => {
    const rect = {
      x: 100, y: 200, width: 240, height: 20,
      top: 200, left: 100, right: 340, bottom: 220,
      toJSON: () => ({}),
    } as DOMRect;

    const { container } = render(
      <ReplyThreadPopup
        activeReply={{ text: "the quoted passage", rect }}
        onClose={vi.fn()}
        onSendMessage={() => ""}
      />
    );
    await check(container);
  });
});
