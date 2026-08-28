import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock } from "../CodeBlock/CodeBlock";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";

const meta: Meta<typeof CodeBlock> = {
  title: "Components/CodeBlock",
  component: CodeBlock,
  parameters: { layout: "padded" },
  args: { copyable: true },
};

export default meta;
type Story = StoryObj<typeof CodeBlock>;

const Frame = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 32, maxWidth: 560 }}>
    <div
      style={{
        marginBottom: 8,
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

const SAMPLES: { lang: string; code: string }[] = [
  {
    lang: "ts",
    code: `// The Higgs, as far as the Standard Model is concerned.
interface Particle {
  mass: number;   // GeV/c²
  spin: 0 | 1 | 2;
}

const higgs: Particle = { mass: 125.25, spin: 0 };
export const isBoson = (p: Particle) => p.spin % 1 === 0;`,
  },
  {
    lang: "bash",
    code: `#!/bin/bash
# install and run
npm install inline-chat-kit
npm run dev -- --port 5173`,
  },
  {
    lang: "json",
    code: `{
  "name": "higgs",
  "mass": 125.25,
  "charge": 0,
  "discovered": true
}`,
  },
  {
    lang: "sql",
    code: `SELECT name, mass
FROM particles
WHERE spin = 0 AND mass > 100
ORDER BY mass DESC;`,
  },
  {
    lang: "yaml",
    code: `particle: higgs
mass: 125.25
quantum:
  - spin: 0
  - charge: 0`,
  },
  {
    lang: "diff",
    code: `- const higgs = { mass: 125 };
+ const higgs = { mass: 125.25 };
  export default higgs;`,
  },
];

/**
 * The registered languages. Ink at four weights rather than a syntax palette —
 * this kit is ink, paper and one acid yellow, and a twelve-colour scheme
 * dropped into it reads as somebody else's component. The six colours are
 * tokens, so a brand that wants them coloured sets six values.
 */
export const Languages: Story = {
  render: (args) => (
    <div>
      {SAMPLES.map(({ lang, code }) => (
        <Frame key={lang} label={lang}>
          <CodeBlock {...args} code={code} lang={lang} />
        </Frame>
      ))}
    </div>
  ),
};

/** The bar carries whatever you give it, or nothing. */
export const TheBar: Story = {
  render: (args) => (
    <div>
      <Frame label="the language, by default">
        <CodeBlock {...args} code={SAMPLES[2].code} lang="json" />
      </Frame>
      <Frame label="a filename instead">
        <CodeBlock {...args} code={SAMPLES[2].code} lang="json" label="particle.json" />
      </Frame>
      <Frame label="no label, still copyable">
        <CodeBlock {...args} code={SAMPLES[2].code} lang="json" label={false} />
      </Frame>
      <Frame label="no bar at all">
        <CodeBlock {...args} code={SAMPLES[2].code} lang="json" label={false} copyable={false} />
      </Frame>
    </div>
  ),
};

/**
 * A grammar we did not register renders unhighlighted rather than throwing.
 * Losing the colour is a small thing; a chat that crashes on one answer is not.
 */
export const UnknownLanguage: Story = {
  render: (args) => (
    <Frame label="rust — not one of the ten">
      <CodeBlock {...args} lang="rust" code={`fn main() {\n    println!("no grammar, no colour");\n}`} />
    </Frame>
  ),
};

/** A long line scrolls inside the block rather than widening the answer. */
export const LongLines: Story = {
  render: (args) => (
    <Frame label="scroll it sideways">
      <CodeBlock
        {...args}
        lang="ts"
        code={`export const everything = { mass: 125.25, spin: 0, charge: 0, colour: null, discovered: 2012, where: "CERN", how: "ATLAS and CMS, independently" };`}
      />
    </Frame>
  ),
};

/**
 * In place, which is where it actually lives. The prose around it is markable
 * and the block is not — preformatted text split into words stops being
 * preformatted, so it gets a copy button instead.
 */
export const InAnAnswer: Story = {
  render: () => (
    <Frame label="drag across the prose; the block does not take a marker">
      <div style={{ fontSize: "0.75rem", lineHeight: 1.7 }}>
        <TextHighlighter
          text={`The Higgs has **no measurable extent**, only mass and quantum numbers:\n\n\`\`\`ts\nconst higgs = { mass: 125.25, spin: 0 };\n\`\`\`\n\nThat is the whole of it.`}
        />
      </div>
    </Frame>
  ),
};
