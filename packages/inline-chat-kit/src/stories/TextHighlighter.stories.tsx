import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

const TEXT =
  "Particle physics studies the most fundamental constituents of matter and the forces that act between them. The Standard Model organises twelve fermions — six quarks and six leptons — plus the force-carrying bosons into a single coherent framework.";

const meta: Meta<typeof TextHighlighter> = {
  title: "Components/TextHighlighter",
  component: TextHighlighter,
  parameters: { layout: "padded" },
  args: { text: TEXT },
  argTypes: { selectionMode: { control: "inline-radio", options: ["marker", "precise"] } },
};

export default meta;
type Story = StoryObj<typeof TextHighlighter>;

/**
 * Drag across the text to draw a marker — or tab to the paragraph and use the
 * arrow keys, which is the same thing without a mouse.
 */
export const Marker: Story = {
  render: (args) => (
    <div style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.65 }}>
      <TextHighlighter {...args} />
    </div>
  ),
};

/** Native selection owns the pointer here; the marker follows the words exactly. */
export const Precise: Story = {
  args: { selectionMode: "precise" },
  render: (args) => (
    <div style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.65 }}>
      <TextHighlighter {...args} />
    </div>
  ),
};

/**
 * The menu on a highlight: reply in a thread, keep it, or take it away.
 *
 * Drawing a highlight keeps nothing. "Bookmark" does, and on a kept passage
 * the same item says "Remove bookmark". The open highlight is lifted with one
 * pass of light rather than a sweep that repeats for as long as the menu is
 * open — try it in the dark theme, where that was a flashlight.
 */
export const Menu: Story = {
  render: function Menu(args) {
    const [kept, setKept] = useState<string[]>([]);
    return (
      <div style={{ maxWidth: 520, fontSize: 14, lineHeight: 1.65 }}>
        <TextHighlighter
          {...args}
          onReplyInThread={() => {}}
          onBookmark={(text) =>
            setKept((all) => (all.includes(text) ? all.filter((t) => t !== text) : [...all, text]))
          }
          bookmarked={kept}
        />
        <p style={{ marginTop: 24, fontSize: 12, color: "var(--ick-ink-faint)" }}>
          Kept: {kept.length ? kept.map((t) => `“${t}”`).join(", ") : "nothing yet"}
        </p>
      </div>
    );
  },
};
