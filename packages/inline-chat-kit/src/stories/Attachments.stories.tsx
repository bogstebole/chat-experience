import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Attachments, type Attachment } from "../Attachments/Attachments";

/**
 * What goes along with a message.
 *
 * An image shows itself; everything else shows its name. A thumbnail of a PDF
 * at 64px is a grey rectangle with a corner turned down and tells you less than
 * the filename does.
 *
 * The same row draws them in the composer and under the message once it has
 * been sent — with `onRemove` in the first case and without in the second,
 * which is the whole difference between a control and a record.
 */
const meta: Meta<typeof Attachments> = {
  title: "Components/Attachments",
  component: Attachments,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Attachments>;

/* An SVG data URL rather than a file: a story that needs a fixture on disk is
   a story that breaks when somebody moves the fixture. */
const swatch = (from: string, to: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/></svg>`
  )}`;

const PICTURES: Attachment[] = [
  { id: "a", name: "kitchen.png", type: "image/png", size: 284_112, url: swatch("#ccff00", "#0b7") },
  { id: "b", name: "hallway.jpg", type: "image/jpeg", size: 1_284_112, url: swatch("#7ab", "#123") },
];

const FILES: Attachment[] = [
  { id: "c", name: "care-plan-2026.pdf", type: "application/pdf", size: 482_000 },
  { id: "d", name: "medication-list.csv", type: "text/csv", size: 1_204 },
  {
    id: "e",
    name: "a-filename-long-enough-that-it-has-to-be-cut-somewhere.docx",
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 92_400,
  },
];

const Wrap = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 32, maxWidth: 560 }}>
    <div
      style={{
        marginBottom: 10,
        fontFamily: "var(--ick-font-mono)",
        fontSize: 11,
        color: "var(--ick-ink-faint)",
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

/** A record: no remove button, because the message has been sent. */
export const Sent: Story = {
  render: () => (
    <div>
      <Wrap label="pictures — they show themselves">
        <Attachments attachments={PICTURES} />
      </Wrap>
      <Wrap label="everything else — a glyph, a name, a size">
        <Attachments attachments={FILES} />
      </Wrap>
      <Wrap label="mixed, and wrapping">
        <Attachments attachments={[...PICTURES, ...FILES]} />
      </Wrap>
    </div>
  ),
};

/** A control: `onRemove`, so each one can be taken back out. */
export const BeingAssembled: Story = {
  name: "Being assembled",
  render: function Removable() {
    const [files, setFiles] = useState<Attachment[]>([...PICTURES, ...FILES]);
    return (
      <Wrap label="hover a picture for its button; a named file keeps one beside it">
        <Attachments
          attachments={files}
          onRemove={(id) => setFiles((f) => f.filter((a) => a.id !== id))}
        />
      </Wrap>
    );
  },
};

/** Nothing to show is nothing drawn — not an empty box with a gap under it. */
export const Empty: Story = {
  render: () => (
    <Wrap label="no attachments — the row renders nothing at all">
      <Attachments attachments={[]} />
    </Wrap>
  ),
};
