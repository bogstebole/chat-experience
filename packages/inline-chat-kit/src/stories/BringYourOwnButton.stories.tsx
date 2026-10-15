import type { Meta, StoryObj } from "@storybook/react-vite";
import { forwardRef, useState, type ReactNode } from "react";
import { Bookmark, Share, Star, Trash2 } from "lucide-react";
import { ChatExperience } from "../ChatExperience/ChatExperience";
import { ComponentsProvider, type KitButtonProps } from "../components/components";
import { ChatHeader } from "../ChatHeader/ChatHeader";
import { ChatInput } from "../ChatInput/ChatInput";
import { Approval } from "../Approval/Approval";
import { AnswerActions } from "../AnswerActions/AnswerActions";
import { EmptyState } from "../EmptyState/EmptyState";
import { ArtifactPane } from "../Artifact/ArtifactPane";
import { Attachments } from "../Attachments/Attachments";
import { scriptedApi, scriptedTranscript } from "../demo/scriptedApi";

/**
 * A host's own button, drawn wherever the kit draws one.
 *
 * The button here is written the way a shadcn/ui one is — a 6px corner, a
 * 36px default height, a dark primary, a ring on keyboard focus — in plain CSS
 * so the story needs no Tailwind. It is the shape a host's design system
 * usually arrives in, and the one the kit has to stay coherent around.
 *
 * What stays the kit's: the box each button sits in (its height comes from
 * `--ick-control-*`, not from the host's `h-9`), where it goes, how it arrives,
 * and the 44px a finger gets. And the composer's send / stop / save glyph,
 * which is never handed over: it morphs between the three inside the button.
 * It follows `--ick-btn-radius` instead, as does the composer around it.
 */
const SHADCN_CSS = `
  .byob {
    --sb-bg: #ffffff;
    --sb-fg: #09090b;
    --sb-primary: #18181b;
    --sb-primary-fg: #fafafa;
    --sb-muted: #f4f4f5;
    --sb-muted-strong: #e4e4e7;
    --sb-border: #e4e4e7;
    --sb-ring: rgb(161 161 170 / 0.5);

    /* The one radius the kit is told about, so the send glyph and the
       composer around it match the host's buttons. */
    --ick-btn-radius: 6px;
    --ick-btn-primary-bg: var(--sb-primary);
    --ick-btn-primary-ink: var(--sb-primary-fg);
    --ick-btn-primary-border: transparent;
    --ick-btn-primary-shadow: none;
    --ick-btn-primary-shadow-hover: none;
    --ick-btn-primary-shadow-press: none;
  }
  /* Dark the way the kit decides it: the system's, unless the page pins one. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) .byob {
      --sb-bg: #09090b;
      --sb-fg: #fafafa;
      --sb-primary: #fafafa;
      --sb-primary-fg: #18181b;
      --sb-muted: #27272a;
      --sb-muted-strong: #3f3f46;
      --sb-border: #27272a;
      --sb-ring: rgb(113 113 122 / 0.5);
    }
  }
  [data-theme="dark"] .byob {
    --sb-bg: #09090b;
    --sb-fg: #fafafa;
    --sb-primary: #fafafa;
    --sb-primary-fg: #18181b;
    --sb-muted: #27272a;
    --sb-muted-strong: #3f3f46;
    --sb-border: #27272a;
    --sb-ring: rgb(113 113 122 / 0.5);
  }

  .sb {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 36px;
    padding: 0 16px;
    border: 1px solid transparent;
    border-radius: 6px;
    font: 500 14px/1 ui-sans-serif, system-ui, sans-serif;
    white-space: nowrap;
    cursor: pointer;
    transition: color 150ms, background-color 150ms, box-shadow 150ms, border-color 150ms;
  }
  .sb svg { width: 16px; height: 16px; flex-shrink: 0; }
  .sb:focus-visible { border-color: #a1a1aa; box-shadow: 0 0 0 3px var(--sb-ring); }
  .sb:disabled { opacity: 0.5; cursor: not-allowed; }

  .sb-default { background: var(--sb-primary); color: var(--sb-primary-fg); }
  .sb-default:hover:not(:disabled) { background: color-mix(in srgb, var(--sb-primary) 90%, transparent); }
  .sb-outline { background: var(--sb-bg); color: var(--sb-fg); border-color: var(--sb-border); box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); }
  .sb-outline:hover:not(:disabled) { background: var(--sb-muted); }
  .sb-secondary { background: var(--sb-muted); color: var(--sb-fg); }
  .sb-secondary:hover:not(:disabled) { background: var(--sb-muted-strong); }
  .sb-ghost { background: transparent; color: var(--sb-fg); }
  .sb-ghost:hover:not(:disabled) { background: var(--sb-muted); }
  .sb-on { background: var(--sb-muted-strong); }

  .sb-icon { padding: 0; aspect-ratio: 1; }
  .sb-sm { gap: 6px; padding: 0 12px; font-size: 13px; }
  .sb-row { justify-content: flex-start; width: 100%; padding: 0 8px; }

  .sb-spin {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid currentColor; border-right-color: transparent;
    animation: sb-spin 0.7s linear infinite;
  }
  @keyframes sb-spin { to { transform: rotate(360deg); } }
`;

type ShadcnVariant = "default" | "outline" | "secondary" | "ghost";

/* The kit's variant is a hint; the role is what a host's design system cares
   about. An opener is an outline chip there, a "yes" is the primary. */
function pick({ kitRole, variant }: Pick<KitButtonProps, "kitRole" | "variant">): ShadcnVariant {
  switch (kitRole) {
    case "suggestion":
    case "approval-always":
    case "thread-close":
      return "outline";
    case "approval-once":
    case "thread-save":
    case "question-next":
      return "default";
    case "approval-deny":
    case "answer-action":
    case "message-action":
    case "header-menu-item":
      return "ghost";
  }
  return variant === "primary" ? "secondary" : variant === "outline" ? "outline" : "ghost";
}

/**
 * The adapter a host writes once: the kit's words in, its own button out.
 * `forwardRef`, a real `<button>`, and everything it does not use spread onto
 * it — the three rules.
 */
const HostButton = forwardRef<HTMLButtonElement, KitButtonProps>(function HostButton(
  { kitRole, variant, size, shape, icon, iconRight, loading, pressed, children, ...rest },
  ref
) {
  const look = pick({ kitRole, variant });
  const className = [
    "sb",
    `sb-${look}`,
    shape === "square" ? "sb-icon" : "",
    size === "xs" || size === "s" ? "sb-sm" : "",
    kitRole === "header-menu-item" ? "sb-row" : "",
    pressed ? "sb-on" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} className={className} {...rest}>
      {loading ? <span className="sb-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

function Brand({ children }: { children: ReactNode }) {
  return (
    <div className="byob" style={{ display: "contents" }}>
      <style>{SHADCN_CSS}</style>
      {children}
    </div>
  );
}

const meta: Meta<typeof ComponentsProvider> = {
  title: "Theming/Bring your own button",
  component: ComponentsProvider,
};

export default meta;
type Story = StoryObj<typeof ComponentsProvider>;

/**
 * The assembled chat, with `components={{ Button }}`. Ask something: the
 * openers, the answer's actions, the header, the "+" and the microphone are
 * the host's button; the send glyph is the kit's, at the host's 6px corner,
 * and the composer around it is 6 + 8 = 14px, concentric.
 */
export const InTheChat: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <Brand>
      <ChatExperience
        onSend={scriptedApi}
        onTranscribe={scriptedTranscript}
        title="Bring your own button"
        components={{ Button: HostButton }}
        empty={{
          title: "Ask me about particle physics",
          suggestions: ["What does particle physics study?", "How big is the Higgs boson?"],
        }}
      />
    </Brand>
  ),
};

function Pieces() {
  const [feedback, setFeedback] = useState<"up" | "down" | null>("up");
  return (
    <div style={{ display: "grid", gap: 32, maxWidth: 560 }}>
      <ChatHeader
        title="Hand-assembled"
        subtitle="ComponentsProvider reaches every piece"
        onBack={() => {}}
        collapseActionsAt={10_000}
        sticky={false}
        landmark={false}
        actions={[
          { id: "share", label: "Share", icon: <Share size={16} aria-hidden />, onClick: () => {}, pinned: true },
          { id: "save", label: "Save", icon: <Bookmark size={16} aria-hidden />, onClick: () => {} },
          { id: "star", label: "Favourite", icon: <Star size={16} aria-hidden />, active: true, onClick: () => {} },
          { id: "delete", label: "Delete", icon: <Trash2 size={16} aria-hidden />, onClick: () => {} },
        ]}
      />
      <EmptyState
        title="Openers"
        suggestions={["Plan a 5k", "Explain the Higgs"]}
        onSuggestion={() => {}}
      />
      <Approval title="Run a command in your shell" description="npm run verify" onDecide={() => {}} />
      <AnswerActions
        text="An answer to copy."
        onRegenerate={() => {}}
        feedback={feedback}
        onFeedback={setFeedback}
        reveal={false}
      />
      <Attachments
        attachments={[{ id: "a", name: "notes.pdf", type: "application/pdf", size: 120_000 }]}
        onRemove={() => {}}
      />
      <div style={{ height: 220 }}>
        <ArtifactPane title="Artifact" meta="The pane's own controls" onClose={() => {}} onToggleExpanded={() => {}}>
          <p style={{ margin: 0 }}>Its expand and close are the host's.</p>
        </ArtifactPane>
      </div>
      <div style={{ width: 320 }}>
        <ChatInput
          state="typing"
          value="The send glyph stays the kit's"
          onChange={() => {}}
          onSubmit={() => {}}
          onTranscribe={scriptedTranscript}
        />
      </div>
    </div>
  );
}

/**
 * Pieces assembled by hand, under `ComponentsProvider` — the same button
 * reaches each without being passed to any of them.
 */
export const HandAssembled: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <Brand>
      <ComponentsProvider components={{ Button: HostButton }}>
        <Pieces />
      </ComponentsProvider>
    </Brand>
  ),
};

/** The same pieces with nothing provided: the kit's own buttons, unchanged. */
export const KitDefault: Story = {
  parameters: { layout: "padded" },
  render: () => <Pieces />,
};
