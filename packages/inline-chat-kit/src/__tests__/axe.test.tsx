import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Button } from "../Button/Button";
import GlassButton from "../GlassButton/GlassButton";
import { ChatInput, type ChatInputState } from "../ChatInput/ChatInput";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";
import { ReplyThreadPopup } from "../ReplyThreadPopup/ReplyThreadPopup";
import { ChatHeader } from "../ChatHeader/ChatHeader";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import { CodeBlock } from "../CodeBlock/CodeBlock";
import { Conversation } from "../Conversation/Conversation";
import { AnswerActions } from "../AnswerActions/AnswerActions";
import { EmptyState } from "../EmptyState/EmptyState";
import { Loader } from "../Loader/Loader";
import { QuestionCard } from "../QuestionCard/QuestionCard";
import { QuestionGroup } from "../QuestionGroup/QuestionGroup";
import type { Question } from "../QuestionCard/types";
import { MessageCircle, Bookmark, Share2, Settings } from "lucide-react";

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

describe("axe — the header", () => {
  const icon = <Bookmark size={16} aria-hidden />;
  const actions = [
    { id: "bookmarks", label: "Bookmarks", icon, count: 3, pinned: true },
    { id: "share", label: "Share", icon: <Share2 size={16} aria-hidden /> },
    { id: "settings", label: "Settings", icon: <Settings size={16} aria-hidden /> },
  ];

  it("passes with a title, a subtitle and named actions", async () => {
    const { container } = render(
      <ChatHeader
        title="Particle physics"
        subtitle="Claude Opus 5"
        backHref="/"
        actions={actions}
      />
    );
    await check(container);
  });

  it("passes with no title at all", async () => {
    const { container } = render(<ChatHeader actions={actions} />);
    await check(container);
  });

  /** The one arrangement with an open menu, which is where ARIA goes wrong. */
  it("passes with the overflow menu open", async () => {
    class FakeResizeObserver {
      constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
        // Narrow enough to fold, reported the moment it is observed.
        queueMicrotask(() => cb([{ contentRect: { width: 300 } }]));
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);

    const { container, findByRole } = render(
      <ChatHeader
        title="Particle physics"
        actions={[...actions, { id: "t", label: "Dark theme", icon, active: false }]}
        collapseActionsAt={520}
      />
    );

    fireEvent.click(await findByRole("button", { name: "More actions" }));
    expect(container.querySelector('[role="menu"]')).toBeInTheDocument();
    await check(container);

    vi.unstubAllGlobals();
  });
});

describe("axe — a turn", () => {
  const turn = {
    id: "t1",
    user: "What does particle physics study?",
    ai: "",
    state: "idle" as const,
  };

  it("passes as an empty composer", async () => {
    const { container } = render(<ChatTurnRow turn={turn} isActiveInput placeholder="Ask" />);
    await check(container);
  });

  it("passes while the answer is arriving", async () => {
    const { container } = render(
      <ChatTurnRow turn={{ ...turn, state: "responding", ai: "Matter, and the forces." }} />
    );
    await check(container);
  });

  it("passes once it has settled and can be marked", async () => {
    const { container } = render(
      <ChatTurnRow turn={{ ...turn, state: "resting", ai: "Matter, and the forces." }} />
    );
    await check(container);
  });
});

describe("axe — a code block", () => {
  const CODE = "const higgs: number = 125.25; // GeV";

  it("passes with a language and a copy button", async () => {
    const { container } = render(<CodeBlock code={CODE} lang="ts" />);
    await check(container);
  });

  it("passes once copied, when the button's name changes under it", async () => {
    const { container } = render(<CodeBlock code={CODE} lang="ts" onCopy={vi.fn()} />);
    fireEvent.click(container.querySelector("button")!);
    await check(container);
  });

  it("passes stripped of its bar", async () => {
    const { container } = render(<CodeBlock code={CODE} label={false} copyable={false} />);
    await check(container);
  });
});

describe("axe — the conversation", () => {
  it("passes as a scroll container", async () => {
    const { container } = render(
      <Conversation>
        <p>Particle physics studies matter.</p>
      </Conversation>
    );
    await check(container);
  });

  /**
   * The button is `aria-hidden` while it has nothing to offer, and axe is
   * strict about a hidden element that can still take focus — which is the
   * mistake this is here to catch.
   */
  it("passes with the way-back button hidden", async () => {
    const { container } = render(<Conversation>answer</Conversation>);
    const button = container.querySelector("button")!;
    expect(button).toHaveAttribute("tabindex", "-1");
    await check(container);
  });

  it("passes without a button at all", async () => {
    const { container } = render(<Conversation scrollButton={false}>answer</Conversation>);
    await check(container);
  });
});

describe("axe — the answer's actions", () => {
  const TEXT = "Particle physics studies matter.";

  it("passes with everything drawn", async () => {
    const { container } = render(
      <AnswerActions text={TEXT} onRegenerate={vi.fn()} onFeedback={vi.fn()} />
    );
    await check(container);
  });

  /** A toggle pair: the state is `aria-pressed`, and only one is true. */
  it("passes with a verdict given", async () => {
    const { container } = render(
      <AnswerActions text={TEXT} feedback="up" onFeedback={vi.fn()} />
    );
    await check(container);
  });

  it("passes once copied, when the button's name changes under it", async () => {
    const { container } = render(<AnswerActions text={TEXT} onCopy={vi.fn()} />);
    fireEvent.click(container.querySelector("button")!);
    await check(container);
  });

  it("passes while regenerating", async () => {
    const { container } = render(<AnswerActions text={TEXT} onRegenerate={vi.fn()} busy />);
    await check(container);
  });
});

describe("axe — the empty state and the loader", () => {
  it("passes with everything the empty state can show", async () => {
    const { container } = render(
      <EmptyState
        title="Ask me anything"
        description="About particle physics."
        suggestions={["What is a boson?", "Explain spin"]}
        onSuggestion={vi.fn()}
      />
    );
    await check(container);
  });

  it("passes as a decorative loader", async () => {
    const { container } = render(<Loader />);
    await check(container);
  });

  it("passes as a loader that speaks", async () => {
    const { container } = render(<Loader label="Thinking" />);
    await check(container);
  });
});

describe("axe — a structured question", () => {
  const INPUTS: Question = {
    id: "who",
    type: "inputs",
    title: "Who are we caring for?",
    subtitle: "Just the basics",
    shortTitle: "About them",
    fields: [{ id: "name", label: "Their name", placeholder: "Milica" }],
  };

  const MULTI: Question = {
    id: "help",
    type: "multi",
    title: "What do they need help with?",
    shortTitle: "Support",
    allowOther: true,
    allowEmpty: true,
    options: [{ id: "meals", title: "Meals", description: "Cooking and shopping" }],
  };

  it("passes while being answered with fields", async () => {
    const { container } = render(<QuestionCard question={INPUTS} number={1} state="active" />);
    await check(container);
  });

  it("passes while being answered with options", async () => {
    const { container } = render(<QuestionCard question={MULTI} number={1} state="active" />);
    await check(container);
  });

  /** One control for the row, named by what pressing it does. */
  it("passes once answered and folded", async () => {
    const { container } = render(
      <QuestionCard
        question={INPUTS}
        number={1}
        state="collapsed"
        answer={{ values: { name: "Milica" } }}
        onEdit={vi.fn()}
      />
    );
    await check(container);
  });

  it("passes read-only, where it is not a control at all", async () => {
    const { container } = render(
      <QuestionCard
        question={INPUTS}
        number={1}
        state="collapsed"
        readOnly
        answer={{ values: { name: "Milica" } }}
      />
    );
    await check(container);
  });

  it("passes as a whole step, and folded", async () => {
    const questions = [INPUTS, MULTI];
    const { container, rerender } = render(
      <QuestionGroup id="s" questions={questions} answers={{}} activeIndex={0} />
    );
    await check(container);

    rerender(
      <QuestionGroup
        id="s"
        questions={questions}
        answers={{ who: { values: { name: "Milica" } }, help: { optionIds: [] } }}
        collapsible
      />
    );
    await check(container);
  });
});
