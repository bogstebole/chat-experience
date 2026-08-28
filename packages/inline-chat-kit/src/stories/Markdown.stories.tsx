import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

const meta: Meta<typeof TextHighlighter> = {
  title: "Components/TextHighlighter/Markdown",
  component: TextHighlighter,
  parameters: { layout: "padded" },
  argTypes: {
    selectionMode: { control: "inline-radio", options: ["marker", "precise"] },
  },
  args: { selectionMode: "marker" },
};

export default meta;
type Story = StoryObj<typeof TextHighlighter>;

const Frame = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 48, maxWidth: 560 }}>
    <div
      style={{
        marginBottom: 12,
        fontFamily: "var(--ick-font-mono)",
        fontSize: 11,
        color: "var(--ick-ink-faint)",
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: "0.75rem", lineHeight: 1.7 }}>{children}</div>
  </div>
);

const EVERYTHING = `## The Standard Model

Particle physics studies the most **fundamental** constituents of matter and
the *forces* that act between them. Found at [CERN](https://home.cern) in 2012.

- twelve fermions — six quarks and six leptons
- the force-carrying bosons
- the Higgs, which gives the rest their \`mass\`

1. quarks
2. leptons
3. bosons

> A point particle has no measurable spatial extent at any scale we can
> currently probe.

| property | value |
| --- | --- |
| mass | ~125 GeV/c² |
| charge | 0 |
| spin | 0 |

\`\`\`ts
const higgs = { mass: 125.25, spin: 0 };
\`\`\`

~~Everything below this line was wrong.~~

---

That is the whole picture.`;

/**
 * Every element an answer can contain. Drag across any of it — the marker does
 * not care which element a word sits in, because the token indices are flat
 * and the tree is only where they are drawn.
 */
export const Everything: Story = {
  render: (args) => (
    <Frame label="the full set">
      <TextHighlighter {...args} text={EVERYTHING} />
    </Frame>
  ),
};

/** The case the whole design is for: a stroke that crosses `**bold**`. */
export const AcrossEmphasis: Story = {
  render: (args) => (
    <Frame label="drag from 'The' through the bold run and out the other side">
      <TextHighlighter
        {...args}
        text="The **Standard Model** organises twelve fermions into a single coherent framework."
      />
    </Frame>
  ),
};

/**
 * Markdown arrives a word at a time, so for a moment the syntax is incomplete
 * — `**Standard` with no closing pair is literally two asterisks, and remark
 * renders it as such until the pair lands. This is what that looks like.
 */
export const PartialSyntax: Story = {
  render: (args) => (
    <div>
      {["The **Stand", "The **Standard Mod", "The **Standard Model**"].map((text) => (
        <Frame key={text} label={JSON.stringify(text)}>
          <TextHighlighter {...args} text={text} />
        </Frame>
      ))}
    </div>
  ),
};

/** A fenced block is preformatted, so it is not tokenised and cannot be marked. */
export const CodeIsNotMarkable: Story = {
  render: (args) => (
    <Frame label="the prose around it marks; the block does not">
      <TextHighlighter
        {...args}
        text={"Use the constant:\n\n```ts\nconst higgs = 125.25;\n```\n\nIt is in GeV."}
      />
    </Frame>
  ),
};
