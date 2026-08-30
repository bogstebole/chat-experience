import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sources, type Source } from "../Sources/Sources";
import { InlineCitation } from "../InlineCitation/InlineCitation";

/**
 * A numbered marker in the text and the list underneath.
 *
 * The kit already had a way of saying "this run of words is picked out" — the
 * marker somebody draws over an answer to ask about it. A citation is the same
 * statement made by the answer rather than by the reader, so it is drawn the
 * same way.
 */
const meta: Meta<typeof Sources> = {
  title: "Components/Sources",
  component: Sources,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Sources>;

const SOURCES: Source[] = [
  {
    id: "atlas",
    title: "Combined measurement of the Higgs boson mass",
    origin: "atlas.cern",
    url: "https://example.com/atlas",
    quote: "125.25 ± 0.17 GeV, combining the ATLAS and CMS datasets.",
  },
  {
    id: "pdg",
    title: "Particle Data Group — Higgs boson",
    origin: "pdg.lbl.gov",
    url: "https://example.com/pdg",
  },
  { id: "notes", title: "Seminar notes, week 9", origin: "notes.md, page 4" },
];

const Wrap = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 36, maxWidth: 560 }}>
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
    {children}
  </div>
);

const answerStyle = {
  fontSize: "var(--ick-answer-size)",
  lineHeight: "var(--ick-answer-leading)",
  letterSpacing: "var(--ick-answer-tracking)",
  color: "var(--ick-ink)",
  margin: 0,
} as const;

/** The list on its own. */
export const List: Story = {
  render: () => (
    <>
      <Wrap label="open, which is the default — a source folded away says the opposite of what a citation is for">
        <Sources sources={SOURCES} />
      </Wrap>
      <Wrap label="collapsible, folded to its own row">
        <Sources sources={SOURCES} collapsible defaultOpen={false} />
      </Wrap>
    </>
  ),
};

/** The marker on its own, after the sentence it follows. */
export const Markers: Story = {
  render: () => (
    <Wrap label="a marker with nowhere to go is not a control, and does not pretend to be">
      <p style={answerStyle}>
        The Higgs boson weighs about 125.25 GeV<InlineCitation index={1} source={SOURCES[0]} />, and
        it is known to a fifth of a percent<InlineCitation index={2} source={SOURCES[1]} />.
      </p>
    </Wrap>
  ),
};

/** Given the passage it speaks for, the citation marks it. */
export const MarkedPassages: Story = {
  render: () => (
    <Wrap label="the same yellow the highlighter draws — it is the same statement">
      <p style={answerStyle}>
        The Higgs boson is a point particle, so{" "}
        <InlineCitation index={1} source={SOURCES[0]} onSelect={() => {}}>
          it has no measurable spatial extent at any scale we can currently probe
        </InlineCitation>
        . What it does have is a mass, and{" "}
        <InlineCitation index={2} source={SOURCES[1]} onSelect={() => {}}>
          that mass is known to about a fifth of a percent
        </InlineCitation>
        .
      </p>
    </Wrap>
  ),
};

/** Press a marker and the entry it points at is marked, not scrolled to. */
export const TheTwoTogether: Story = {
  render: function TheTwoTogether() {
    const [active, setActive] = useState<string | null>(null);
    return (
      <Wrap label="press a number in the text">
        <p style={{ ...answerStyle, marginBottom: 24 }}>
          The Higgs boson is a point particle, so{" "}
          <InlineCitation
            index={1}
            source={SOURCES[0]}
            onSelect={(_, source) => setActive(source?.id ?? null)}
          >
            it has no measurable spatial extent
          </InlineCitation>
          . Its mass, though,{" "}
          <InlineCitation
            index={2}
            source={SOURCES[1]}
            onSelect={(_, source) => setActive(source?.id ?? null)}
          >
            is known to about a fifth of a percent
          </InlineCitation>
          .
        </p>
        <Sources sources={SOURCES} activeId={active} onSelect={(s) => setActive(s.id)} />
      </Wrap>
    );
  },
};
