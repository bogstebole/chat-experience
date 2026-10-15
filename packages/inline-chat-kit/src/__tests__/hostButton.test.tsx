import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { forwardRef, createRef, type ReactNode, type Ref } from "react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { render, screen, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentsProvider, type KitButtonProps, type KitButtonRole } from "../components/components";
import { resetHostButtonWarnings } from "../Button/hostButtonChecks";
import { KitButton } from "../Button/KitButton";
import { AnswerActions } from "../AnswerActions/AnswerActions";
import { Approval } from "../Approval/Approval";
import { ArtifactPane } from "../Artifact/ArtifactPane";
import { Attachments } from "../Attachments/Attachments";
import { ChatHeader } from "../ChatHeader/ChatHeader";
import { ChatInput } from "../ChatInput/ChatInput";
import { EmptyState } from "../EmptyState/EmptyState";
import { QuestionCard } from "../QuestionCard/QuestionCard";
import { ReplyThreadPopup } from "../ReplyThreadPopup/ReplyThreadPopup";
import type { Question } from "../QuestionCard/types";

/**
 * A host's own button: `components={{ Button }}` on `ChatExperience`, or
 * `ComponentsProvider` around pieces assembled by hand.
 *
 * Asked for by a host that was matching the kit's buttons by hashed class
 * name and by position. Turned down in 0.60.0 because the composer's glyph
 * morphs inside its button; taken up in 0.61.0 for every button but that one.
 */

const SRC = join(import.meta.dirname, "..");

/** Every call the host button gets, by role. */
let seen: KitButtonProps[] = [];

const HostButton = forwardRef<HTMLButtonElement, KitButtonProps>(function HostButton(
  { kitRole, variant, size, shape, icon, iconRight, loading, pressed, children, ...rest },
  ref
) {
  seen.push({ kitRole, variant, size, shape, icon, iconRight, loading, pressed, children, ...rest } as KitButtonProps);
  return (
    <button ref={ref} className="host" {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  );
});

const withHost = (ui: ReactNode) =>
  render(<ComponentsProvider components={{ Button: HostButton }}>{ui}</ComponentsProvider>);

const rolesSeen = () => new Set(seen.map((props) => props.kitRole));

/* jsdom lays nothing out, so a header never measures narrow enough to fold
   its actions into "…" on its own. Every header here is told it is 300 wide. */
let observers: ((entries: { contentRect: { width: number } }[]) => void)[] = [];
class NarrowObserver {
  constructor(cb: (entries: { contentRect: { width: number } }[]) => void) {
    observers.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
const narrow = () => act(() => observers.forEach((cb) => cb([{ contentRect: { width: 300 } }])));

beforeEach(() => {
  seen = [];
  observers = [];
  resetHostButtonWarnings();
  vi.stubGlobal("ResizeObserver", NarrowObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const anchorRect = () =>
  ({ x: 100, y: 200, width: 240, height: 20, top: 200, left: 100, right: 340, bottom: 220, toJSON: () => ({}) }) as DOMRect;

const NEXT: Question = {
  id: "who",
  type: "inputs",
  title: "Who are we caring for?",
  shortTitle: "About them",
  fields: [{ id: "name", label: "Their name" }],
};

/** The role table in theming.md, which is what a host reads. */
const documentedRoles = (): string[] => {
  const theming = readFileSync(join(SRC, "..", "theming.md"), "utf8");
  const table = theming.slice(theming.indexOf("| Role | Where |"));
  const rows = table.slice(0, table.indexOf("\n\n")).split("\n").slice(2);
  return rows.flatMap((row) => [...row.split("|")[1].matchAll(/`([a-z-]+)`/g)].map((m) => m[1]));
};

describe("a host's button, everywhere the kit draws one", () => {
  it("is used for every role a piece draws", async () => {
    const user = userEvent.setup();
    withHost(
      <>
        <AnswerActions text="An answer" onRegenerate={() => {}} onFeedback={() => {}} />
        <EmptyState suggestions={["Plan a 5k"]} onSuggestion={() => {}} />
        <Approval title="Run a command" onDecide={() => {}} />
        <QuestionCard question={NEXT} number={1} state="active" onCommit={() => {}} />
        <ArtifactPane title="Plan" onClose={() => {}} onToggleExpanded={() => {}} />
        <Attachments attachments={[{ id: "a", name: "notes.pdf" }]} onRemove={() => {}} />
        <ChatHeader
          title="Chat"
          onBack={() => {}}
          collapseActionsAt={false}
          actions={[{ id: "share", label: "Share", icon: <svg />, onClick: () => {} }]}
        />
        <ChatHeader
          title="Folded"
          collapseActionsAt={10_000}
          actions={[{ id: "save", label: "Save", icon: <svg />, onClick: () => {} }]}
        />
        <ReplyThreadPopup activeReply={{ text: "a passage", rect: anchorRect() }} onClose={() => {}} onSendMessage={() => ""} />
        <ChatInput state="typing" value="Hi" onChange={() => {}} onSubmit={() => {}} />
        <ChatInput state="typing" value="Hi" isEditing onChange={() => {}} onSubmit={() => {}} onCancelEdit={() => {}} />
      </>
    );

    narrow();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getAllByRole("button", { name: "Add" })[0]);

    expect([...rolesSeen()].sort()).toEqual(
      [
        "add",
        "add-close",
        "answer-action",
        "approval-always",
        "approval-deny",
        "approval-once",
        "back",
        "cancel-edit",
        "header-action",
        "header-menu-item",
        "header-more",
        "pane-close",
        "pane-expand",
        "question-next",
        "remove-attachment",
        "suggestion",
        "thread-close",
        "thread-save",
      ].sort()
    );
  });

  /* `dictate` needs a microphone, `read-more` and `message-action` a sent
     message being hovered, `highlight-action` a marker drawn by hand — none
     of which jsdom has. The source says the rest: every button the kit draws
     goes through `KitButton`, which is what reaches the host, and the roles
     written on them are exactly the documented ones. */
  it("is the only way a kit component draws a button, but for the composer's glyph", () => {
    const sources = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          return ["stories", "__tests__", "demo", "examples"].includes(entry.name) ? [] : sources(path);
        }
        return entry.name.endsWith(".tsx") ? [path] : [];
      });

    const raw: string[] = [];
    const roles = new Set<string>();
    for (const path of sources(SRC)) {
      if (/Button\/(Button|KitButton)\.tsx$|GlassButton\.tsx$/.test(path)) continue;
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(/<Button(?=[\s/>])[\s\S]*?data-ick-role=\{?"?([^"}\s]+)/g)) {
        raw.push(`${path.slice(SRC.length + 1)}: ${match[1]}`);
      }
      for (const match of text.matchAll(/kitRole="([a-z-]+)"/g)) roles.add(match[1]);
    }

    /* The one `<Button>` left: send, stop and save, morphing in place. */
    expect(raw).toEqual(["ChatInput/ChatInput.tsx: showStop"]);

    const documented = documentedRoles().filter((role) => !["send", "stop", "save"].includes(role));
    expect([...roles].sort()).toEqual([...new Set(documented)].sort());
  });

  it("never draws the send / stop / save glyph", () => {
    const { rerender } = withHost(<ChatInput state="typing" value="Hi" onChange={() => {}} onSubmit={() => {}} onStop={() => {}} />);
    const send = screen.getByRole("button", { name: /send/i });
    expect(send).not.toHaveClass("host");
    expect(send.closest("[data-ick-box]")).toBeNull();

    rerender(
      <ComponentsProvider components={{ Button: HostButton }}>
        <ChatInput state="responding" value="Hi" onChange={() => {}} onSubmit={() => {}} onStop={() => {}} />
      </ComponentsProvider>
    );
    expect(screen.getByRole("button", { name: /stop/i })).not.toHaveClass("host");
    expect(seen.map((props) => props.kitRole)).not.toContain("send");
    expect(seen.map((props) => props.kitRole)).not.toContain("stop");
  });
});

describe("what the host's button is given", () => {
  it("the kit's words, the attributes, and type=button", () => {
    withHost(<AnswerActions text="An answer" onFeedback={() => {}} feedback="up" />);
    const up = seen.filter((props) => props["data-ick-action"] === "up").at(-1)!;

    expect(up).toMatchObject({
      kitRole: "answer-action",
      variant: "ghost",
      size: "s",
      shape: "square",
      pressed: true,
      type: "button",
      "aria-pressed": true,
      "aria-label": "Good answer",
      "data-ick-role": "answer-action",
      "data-ick-variant": "ghost",
      "data-ick-action": "up",
    });
    expect(up.icon).toBeTruthy();

    const button = screen.getByRole("button", { name: "Good answer" });
    expect(button).toHaveClass("host");
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-ick-role", "answer-action");
  });

  it("text as children, and a shape for a chip", () => {
    withHost(<EmptyState suggestions={["Plan a 5k"]} onSuggestion={() => {}} />);
    expect(seen.at(-1)).toMatchObject({ kitRole: "suggestion", shape: "pill", variant: "primary", size: "m", children: "Plan a 5k" });
  });

  it("loading as disabled and busy", () => {
    withHost(<AnswerActions text="An answer" onRegenerate={() => {}} busy />);
    const regenerate = screen.getByRole("button", { name: "Regenerate" });
    expect(regenerate).toBeDisabled();
    expect(regenerate).toHaveAttribute("aria-busy", "true");
    expect(seen.find((props) => props["data-ick-action"] === "regenerate")).toMatchObject({ loading: true });
  });

  it("the press, and the ref the kit focuses", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    withHost(
      <ChatHeader
        title="Folded"
        collapseActionsAt={10_000}
        actions={[{ id: "save", label: "Save", icon: <svg />, onClick }]}
      />
    );
    narrow();
    const more = screen.getByRole("button", { name: "More actions" });
    await user.click(more);
    const item = screen.getByRole("menuitem", { name: "Save" });
    expect(item).toHaveClass("host");
    /* The menu moves focus to its first item, by role — so the role reached it. */
    expect(item).toHaveFocus();

    await user.keyboard("{Escape}");
    /* And back to the trigger through the ref the host forwarded. */
    expect(more).toHaveFocus();

    await user.click(more);
    await user.click(screen.getByRole("menuitem", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("a ref a hand-assembled host passes reaches the element", () => {
    const ref = createRef<HTMLButtonElement>();
    withHost(<KitButtonHarness buttonRef={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current).toHaveClass("host");
  });
});

function KitButtonHarness({ buttonRef }: { buttonRef: Ref<HTMLButtonElement> }) {
  return <KitButton ref={buttonRef} kitRole="pane-close" variant="ghost" icon={<svg />} aria-label="Close" />;
}

describe("the box the kit lays it out in", () => {
  it("has the size and the shape, and hands on a press around the button", () => {
    const onClose = vi.fn();
    withHost(<ArtifactPane title="Plan" onClose={onClose} />);
    const close = screen.getByRole("button", { name: /close/i });
    const box = close.parentElement!;
    expect(box).toHaveAttribute("data-ick-box", "pane-close");
    expect(box).toHaveAttribute("data-shape", "square");

    /* The 44px ring on a touch screen belongs to the box: a press there has
       the box as its target, and the button answers. */
    fireEvent.click(box);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("with no host button, nothing changes", () => {
  it("draws the kit's own button, with no box around it", () => {
    const { container } = render(
      <>
        <AnswerActions text="An answer" onRegenerate={() => {}} onFeedback={() => {}} />
        <Approval title="Run a command" onDecide={() => {}} />
        <ChatHeader
          title="Chat"
          onBack={() => {}}
          actions={[{ id: "share", label: "Share", icon: <svg />, onClick: () => {} }]}
        />
      </>
    );
    expect(container.querySelector("[data-ick-box]")).toBeNull();
    const copy = screen.getByRole("button", { name: "Copy answer" });
    expect(copy).toHaveAttribute("data-ick-variant", "ghost");
    expect(copy).toHaveAttribute("data-ick-role", "answer-action");
    expect(copy).toHaveAttribute("aria-busy", "false");
    expect(copy.className).toMatch(/btn/);
    expect(copy.parentElement?.className).toMatch(/row/);
  });
});

describe("in development, a host button that breaks the contract is named", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const warnings = () => warn.mock.calls.map((call: unknown[]) => String(call[0]));

  it("says nothing about one that keeps it", () => {
    withHost(<AnswerActions text="An answer" onRegenerate={() => {}} onFeedback={() => {}} />);
    expect(warnings()).toEqual([]);
  });

  /* React 19 hands a function component its `ref` as a prop, so a button
     that spreads everything forwards it without `forwardRef`. This one picks
     what it wants, and the ref is not among it. */
  it("names one that does not forward its ref", () => {
    const NoRef = ({ icon, children, onClick, ...rest }: KitButtonProps) => (
      <button
        onClick={onClick}
        aria-label={rest["aria-label"]}
        aria-pressed={rest["aria-pressed"]}
        aria-busy={rest["aria-busy"]}
        title={rest.title}
        data-ick-role={rest["data-ick-role"]}
        data-ick-variant={rest["data-ick-variant"]}
        data-ick-action={rest["data-ick-action"]}
      >
        {children ?? icon}
      </button>
    );
    render(
      <ComponentsProvider components={{ Button: NoRef }}>
        <AnswerActions text="An answer" onRegenerate={() => {}} onFeedback={() => {}} />
      </ComponentsProvider>
    );
    /* Four buttons of one role: one warning. */
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toMatch(/"answer-action" does not forward its ref/);
  });

  it("names one that is not a <button>, or drops what it was given", () => {
    const Div = forwardRef<HTMLDivElement, KitButtonProps>(function Div({ children, onClick }, ref) {
      return (
        <div ref={ref} onClick={onClick as never}>
          {children}
        </div>
      );
    });
    render(
      <ComponentsProvider components={{ Button: Div as never }}>
        <EmptyState suggestions={["Plan a 5k", "Explain the Higgs"]} onSuggestion={() => {}} />
      </ComponentsProvider>
    );
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toMatch(/"suggestion" renders a <div>, not a <button>/);
    expect(warnings()[0]).toMatch(/drops data-ick-role/);
  });

  it("names one that shows no focus", async () => {
    /* jsdom decides `:focus-visible` from every click since the file began,
       so a tab after other tests' clicks can read as a mouse's. What is
       tested is what the kit does with a keyboard focus. */
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
      return selector === ":focus-visible" ? true : matches.call(this, selector);
    });
    const user = userEvent.setup();
    withHost(<ArtifactPane title="Plan" onClose={() => {}} />);
    await user.tab();
    expect(screen.getByRole("button", { name: /close/i })).toHaveFocus();
    /* Read a moment after focus arrives, so a ring that fades in has. */
    await act(() => new Promise((resolve) => setTimeout(resolve, 450)));
    expect(warnings().join("\n")).toMatch(/"pane-close" shows no change on keyboard focus/);
  });

  it("is silent in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const NoRef = ({ children }: KitButtonProps) => <span>{children}</span>;
    render(
      <ComponentsProvider components={{ Button: NoRef }}>
        <EmptyState suggestions={["Plan a 5k"]} onSuggestion={() => {}} />
      </ComponentsProvider>
    );
    expect(warnings()).toEqual([]);
  });
});

describe("the composer's controls are on the scale", () => {
  const tokens = readFileSync(join(SRC, "styles", "tokens.css"), "utf8");
  const input = readFileSync(join(SRC, "ChatInput", "ChatInput.tsx"), "utf8");
  const overlay = readFileSync(join(SRC, "ChatInput", "AddCardsOverlay.tsx"), "utf8");
  const css = readFileSync(join(SRC, "ChatInput", "ChatInput.module.css"), "utf8");

  it("sized by --ick-composer-control, which is a step of --ick-control-*", () => {
    expect(tokens).toMatch(/--ick-composer-control: var\(--ick-control-s\);/);
    /* Not pinned under the touch block: it follows `s` there, as the send
       glyph's min-width always did. */
    const coarse = tokens.slice(tokens.indexOf("@media (pointer: coarse)"));
    expect(coarse).not.toMatch(/--ick-composer-control:/);
  });

  it("with no 28 written into the composer any more", () => {
    for (const [name, text] of [["ChatInput.tsx", input], ["AddCardsOverlay.tsx", overlay]] as const) {
      expect(text, name).not.toMatch(/(width|height): 28\b/);
      expect(text, name).not.toMatch(/\? (36|44) : /);
    }
    expect(css).not.toMatch(/width: 28px/);
  });

  it("inside a surface whose corner is the button's plus its padding", () => {
    expect(css).toMatch(
      /--ick-input-radius: min\(var\(--ick-btn-radius\) \+ var\(--ick-space-4\), var\(--ick-radius-xl\)\);/
    );
    expect(css).toMatch(/\.surface \{[^}]*padding: var\(--ick-space-4\);/);
  });
});

/* Not a role anyone draws; here so the list above fails when one is added
   and not handled. */
const _exhaustive: Record<Exclude<KitButtonRole, "send" | "stop" | "save">, true> = {
  add: true, dictate: true, "cancel-edit": true, "add-close": true, "read-more": true,
  "message-action": true, "answer-action": true, suggestion: true, back: true,
  "header-action": true, "header-more": true, "header-menu-item": true, "approval-once": true,
  "approval-always": true, "approval-deny": true, "question-next": true, "highlight-action": true,
  "thread-save": true, "thread-close": true, "pane-expand": true, "pane-close": true,
  "remove-attachment": true,
};
void _exhaustive;
