import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bookmark, Share2, Sun, Moon, Highlighter, TextCursor, Settings, Download } from "lucide-react";
import {
  ChatHeader,
  type ChatHeaderAction,
  type ChatHeaderSize,
  type ChatHeaderVariant,
} from "../ChatHeader/ChatHeader";

const meta: Meta<typeof ChatHeader> = {
  title: "Components/ChatHeader",
  component: ChatHeader,
  parameters: { layout: "padded" },
  argTypes: {
    variant: { control: "inline-radio", options: ["plain", "glass", "bordered"] },
    size: { control: "inline-radio", options: ["s", "m", "l"] },
    align: { control: "inline-radio", options: ["start", "center"] },
    status: { control: "inline-radio", options: [null, "online", "busy", "thinking"] },
    headingLevel: { control: "inline-radio", options: [1, 2, 3, 4, 5, 6, false] },
  },
  args: {
    title: "Particle physics",
    subtitle: "Claude Opus 5",
    variant: "bordered",
    size: "m",
    align: "start",
    backHref: "#",
  },
};

export default meta;
type Story = StoryObj<typeof ChatHeader>;

const ICON = 16;

const ACTIONS: ChatHeaderAction[] = [
  { id: "bookmarks", label: "Bookmarks", icon: <Bookmark size={ICON} aria-hidden />, count: 3, pinned: true },
  { id: "share", label: "Share", icon: <Share2 size={ICON} aria-hidden /> },
  { id: "download", label: "Download transcript", icon: <Download size={ICON} aria-hidden /> },
  { id: "settings", label: "Settings", icon: <Settings size={ICON} aria-hidden /> },
];

const Frame = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 28 }}>
    <div
      style={{
        marginBottom: 6,
        fontFamily: "var(--ick-font-mono)",
        fontSize: 11,
        color: "var(--ick-ink-faint)",
      }}
    >
      {label}
    </div>
    <div style={{ border: "1px dashed var(--ick-border)", borderRadius: 12, overflow: "hidden" }}>
      {children}
    </div>
  </div>
);

export const Playground: Story = {
  args: { actions: ACTIONS.slice(0, 2), status: "online" },
};

/** The three materials. `plain` grows its own border only once content scrolls under it. */
export const Variants: Story = {
  render: (args) => (
    <div>
      {(["plain", "bordered", "glass"] as ChatHeaderVariant[]).map((variant) => (
        <Frame key={variant} label={variant}>
          <ChatHeader {...args} variant={variant} actions={ACTIONS.slice(0, 2)} />
        </Frame>
      ))}
    </div>
  ),
};

/** 40, 48 and 56 — the row heights, carrying the button scale with them. */
export const Sizes: Story = {
  render: (args) => (
    <div>
      {(["s", "m", "l"] as ChatHeaderSize[]).map((size) => (
        <Frame key={size} label={`${size} · ${{ s: 40, m: 48, l: 56 }[size]}px`}>
          <ChatHeader {...args} size={size} actions={ACTIONS.slice(0, 2)} />
        </Frame>
      ))}
    </div>
  ),
};

/** Centred is the native arrangement: identity in the middle, controls either side. */
export const Alignment: Story = {
  render: (args) => (
    <div>
      <Frame label="start">
        <ChatHeader {...args} align="start" actions={ACTIONS.slice(0, 2)} />
      </Frame>
      <Frame label="center">
        <ChatHeader {...args} align="center" actions={ACTIONS.slice(0, 2)} />
      </Frame>
    </div>
  ),
};

/**
 * The dot is a picture of the state and carries no text of its own; the word
 * beside each one here is what a screen reader is given.
 */
export const Status: Story = {
  render: (args) => (
    <div>
      {(["online", "busy", "thinking"] as const).map((status) => (
        <Frame key={status} label={status}>
          <ChatHeader {...args} status={status} subtitle={`Claude Opus 5 · ${status}`} />
        </Frame>
      ))}
    </div>
  ),
};

/**
 * A count on the glyph. The badge is decorative — the number is folded into
 * the button's accessible name, so it reads as "Bookmarks, 3".
 */
export const WithCounts: Story = {
  render: (args) => (
    <Frame label="bookmarks, with and without">
      <ChatHeader
        {...args}
        actions={[
          { id: "b", label: "Bookmarks", icon: <Bookmark size={ICON} aria-hidden />, count: 3 },
          { id: "c", label: "Bookmarks", icon: <Bookmark size={ICON} aria-hidden />, count: 0 },
          { id: "d", label: "Bookmarks", icon: <Bookmark size={ICON} aria-hidden />, count: 128 },
        ]}
      />
    </Frame>
  ),
};

/**
 * Drag the handle in the corner. Below 520px everything unpinned folds into
 * the menu; `bookmarks` is pinned and stays. This is the whole reason actions
 * are described rather than handed over as children — the header can only
 * summarise what it can read.
 */
export const Collapsing: Story = {
  render: (args) => (
    <div
      style={{
        resize: "horizontal",
        overflow: "auto",
        width: 640,
        minWidth: 260,
        maxWidth: "100%",
        border: "1px dashed var(--ick-border)",
        borderRadius: 12,
      }}
    >
      <ChatHeader {...args} actions={ACTIONS} />
    </div>
  ),
};

/**
 * Anything the kit should not manage goes in as children: it sits before the
 * actions and never collapses. Here, the selection-mode toggle.
 */
function SelectionToggle() {
  const [mode, setMode] = useState<"marker" | "precise">("marker");
  return (
    <div
      role="group"
      aria-label="Selection mode"
      style={{
        display: "flex",
        gap: 2,
        padding: 2,
        borderRadius: 999,
        background: "var(--ick-surface-sunken)",
      }}
    >
      {([["marker", Highlighter], ["precise", TextCursor]] as const).map(([value, Icon]) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          aria-pressed={mode === value}
          aria-label={value === "marker" ? "Freeform marker" : "Precise text selection"}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            border: 0,
            borderRadius: 999,
            cursor: "pointer",
            color: mode === value ? "var(--ick-ink)" : "var(--ick-ink-faint)",
            background: mode === value ? "var(--ick-surface-raised)" : "transparent",
          }}
        >
          <Icon size={15} aria-hidden />
        </button>
      ))}
    </div>
  );
}

export const WithCustomControls: Story = {
  render: (args) => (
    <Frame label="a segmented control the kit does not manage">
      <ChatHeader {...args} actions={ACTIONS.slice(0, 2)}>
        <SelectionToggle />
      </ChatHeader>
    </Frame>
  ),
};

/** What the demo actually uses, end to end. */
function DemoHeader(args: React.ComponentProps<typeof ChatHeader>) {
  const [dark, setDark] = useState(false);
  const [saved, setSaved] = useState(3);
  return (
    <div
      style={{
        border: "1px solid var(--ick-border)",
        borderRadius: 16,
        overflow: "hidden",
        background: "var(--ick-surface)",
      }}
    >
      <ChatHeader
        {...args}
        variant="glass"
        status="thinking"
        subtitle="Claude Opus 5 · answering"
        actions={[
          {
            id: "bookmarks",
            label: "Bookmarks",
            icon: <Bookmark size={ICON} aria-hidden />,
            count: saved,
            pinned: true,
            onClick: () => setSaved((n) => n + 1),
          },
          {
            id: "theme",
            label: dark ? "Switch to the light theme" : "Switch to the dark theme",
            icon: dark ? <Sun size={ICON} aria-hidden /> : <Moon size={ICON} aria-hidden />,
            active: dark,
            onClick: () => setDark((v) => !v),
          },
          { id: "share", label: "Share", icon: <Share2 size={ICON} aria-hidden /> },
        ]}
      >
        <SelectionToggle />
      </ChatHeader>
      <div style={{ padding: 24, color: "var(--ick-ink-soft)", fontSize: 14 }}>
        Particle physics studies the most basic constituents of matter.
      </div>
    </div>
  );
}

export const InContext: Story = {
  render: (args) => <DemoHeader {...args} />,
};
