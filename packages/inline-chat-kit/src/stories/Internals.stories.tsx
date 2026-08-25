import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { HoverActionsRow } from "../ChatInput/HoverActionsRow";
import { AddCardsOverlay } from "../ChatInput/AddCardsOverlay";
import { MorphGlyph } from "../ChatInput/MorphGlyph";
import { CustomCursor } from "../CustomCursor/CustomCursor";
import { defaultInlineAnimConfig } from "../ChatInput/ChatInput";

/**
 * The parts `ChatInput` is built from.
 *
 * They are exported so a consumer can recompose the input rather than fork it,
 * which makes them public API — and public API that nobody can look at is
 * public API nobody will use correctly.
 */
const meta: Meta = {
  title: "Components/Internals",
  parameters: { layout: "centered" },
};

export default meta;

const Label = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 11,
      fontFamily: "var(--ick-font-mono)",
      color: "var(--ick-ink-faint)",
      marginBottom: 10,
    }}
  >
    {children}
  </div>
);

/** The send button's icon, which slides between three shapes rather than swapping. */
export const Glyph: StoryObj = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ display: "flex", gap: 40 }}>
      {(["send", "stop", "check"] as const).map((mode) => (
        <div key={mode}>
          <Label>{mode}</Label>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              background: "var(--ick-surface-active)",
            }}
          >
            <MorphGlyph mode={mode} size={18} />
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Copy, edit and read-more, shown under a settled message. */
function HoverActions() {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div style={{ width: 360 }}>
      <HoverActionsRow
        showActions
        showReadMore
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        value="What holds a proton together?"
        onCopy={() => {}}
        onEdit={() => {}}
        ac={defaultInlineAnimConfig}
      />
    </div>
  );
}

export const HoverActionsRowStory: StoryObj = {
  name: "Hover actions",
  render: () => <HoverActions />,
};

/** The attachment menu. Open it with the button; escape or the close button ends it. */
function AddCards() {
  const [isAddOpen, setIsAddOpen] = useState(true);
  return (
    <div style={{ width: 420, height: 260, position: "relative" }}>
      <AddCardsOverlay
        isAddOpen={isAddOpen}
        setIsAddOpen={setIsAddOpen}
        onAdd={() => setIsAddOpen(false)}
        showInlineGlyph={false}
        showButtons
        ac={defaultInlineAnimConfig}
      />
    </div>
  );
}

export const AddCards_: StoryObj = {
  name: "Add cards overlay",
  parameters: { layout: "padded" },
  render: () => <AddCards />,
};

/**
 * Replaces the system cursor with the marker over anything that asks for it.
 * Move the pointer across the two areas below to see it change.
 */
export const Cursor: StoryObj = {
  name: "Custom cursor",
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ display: "flex", gap: 16, cursor: "none" }}>
      <CustomCursor />
      {(["marker", "text"] as const).map((kind) => (
        <div
          key={kind}
          data-cursor={kind}
          style={{
            width: 200,
            height: 120,
            display: "grid",
            placeItems: "center",
            borderRadius: "var(--ick-radius-md)",
            border: "1px solid var(--ick-border)",
            fontSize: 12,
            fontFamily: "var(--ick-font-mono)",
            color: "var(--ick-ink-soft)",
          }}
        >
          data-cursor=&quot;{kind}&quot;
        </div>
      ))}
      <div
        style={{
          width: 200,
          height: 120,
          display: "grid",
          placeItems: "center",
          borderRadius: "var(--ick-radius-md)",
          border: "1px solid var(--ick-border)",
          fontSize: 12,
          fontFamily: "var(--ick-font-mono)",
          color: "var(--ick-ink-soft)",
        }}
      >
        no attribute
      </div>
    </div>
  ),
};
