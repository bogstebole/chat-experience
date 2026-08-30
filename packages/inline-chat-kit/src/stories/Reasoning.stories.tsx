import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Reasoning } from "../Reasoning/Reasoning";

/**
 * What the model worked through before it answered.
 *
 * Open while it thinks, folded away once the answer starts — and reachable
 * afterwards, because the times the thinking matters are exactly the times the
 * answer looks wrong.
 */
const meta: Meta<typeof Reasoning> = {
  title: "Components/Reasoning",
  component: Reasoning,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Reasoning>;

const THINKING = `The question is about the Higgs boson's mass, so two numbers matter: the mass itself and how precisely it is known.

ATLAS and CMS both measure it near 125 GeV. The combined figure is 125.25 GeV with an uncertainty of about 0.17, which is a fifth of a percent — worth saying, because "about 125" hides how well this is pinned down.

Mass is the wrong word for a general reader, though. Better to give it in terms of something with a mass they already have a feel for.`;

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

/** Both states, side by side. */
export const States: Story = {
  render: () => (
    <>
      <Wrap label="thinking — open, and the words say they are provisional">
        <Reasoning state="thinking">{THINKING}</Reasoning>
      </Wrap>
      <Wrap label="done — folded away, and it kept how long it took">
        <Reasoning state="done" duration={12400}>
          {THINKING}
        </Reasoning>
      </Wrap>
      <Wrap label="done, opened again — where it matters">
        <Reasoning state="done" duration={12400} defaultOpen>
          {THINKING}
        </Reasoning>
      </Wrap>
    </>
  ),
};

/** With no `duration`, it times itself. Watch it fold when the thinking stops. */
export const Live: Story = {
  render: function Live() {
    const [thinking, setThinking] = useState(true);
    useEffect(() => {
      const t = setInterval(() => setThinking((v) => !v), 4200);
      return () => clearInterval(t);
    }, []);
    return (
      <Wrap label="no duration given — it times itself, and folds when the answer starts">
        <Reasoning state={thinking ? "thinking" : "done"}>{THINKING}</Reasoning>
      </Wrap>
    );
  },
};

/**
 * Folding is the block's preference, not something done to the reader. Open it
 * while it is thinking and it stays open when the answer arrives.
 */
export const OpenedStaysOpen: Story = {
  render: function OpenedStaysOpen() {
    const [state, setState] = useState<"thinking" | "done">("thinking");
    return (
      <Wrap label="shut it while it thinks, then press Done — it stays where you put it">
        <Reasoning state={state}>{THINKING}</Reasoning>
        <button
          type="button"
          onClick={() => setState((s) => (s === "thinking" ? "done" : "thinking"))}
          style={{
            marginTop: 16,
            font: "inherit",
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--ick-border)",
            background: "transparent",
            color: "var(--ick-ink)",
            cursor: "pointer",
          }}
        >
          {state === "thinking" ? "Done" : "Think again"}
        </button>
      </Wrap>
    );
  },
};

/** How it actually reads: the aside above the answer it explains. */
export const AboveAnAnswer: Story = {
  render: () => (
    <Wrap label="in place">
      <Reasoning state="done" duration={12400}>
        {THINKING}
      </Reasoning>
      <p
        style={{
          marginTop: 24,
          fontSize: "var(--ick-answer-size)",
          lineHeight: "var(--ick-answer-leading)",
          letterSpacing: "var(--ick-answer-tracking)",
          color: "var(--ick-ink)",
          maxWidth: "var(--ick-answer-measure)",
        }}
      >
        The Higgs boson weighs about 125.25 GeV — roughly 133 times a proton, or
        about as much as a caesium atom. It is known to a fifth of a percent,
        which for a particle nobody had seen fifteen years ago is remarkable.
      </p>
    </Wrap>
  ),
};
