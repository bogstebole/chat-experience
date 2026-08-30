import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChainOfThought, type Thought } from "../ChainOfThought/ChainOfThought";
import { Tool } from "../Tool/Tool";

/**
 * How the answer was arrived at, step by step.
 *
 * The third thing in this kit that draws a sequence, and the line between them
 * is the only reason there are three: `Reasoning` is prose, `TaskList` is a
 * plan, and this is a derivation — each step follows from the one above it,
 * which is what the line down the side is drawing.
 */
const meta: Meta<typeof ChainOfThought> = {
  title: "Components/ChainOfThought",
  component: ChainOfThought,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof ChainOfThought>;

const STEPS: Thought[] = [
  {
    id: "read",
    label: "The question is about size, not mass",
    body: "And a point particle has no size — so answering the question as asked would mean answering it wrongly.",
  },
  {
    id: "check",
    label: "Checked the current measured value",
    body: "ATLAS and CMS combine to 125.25 GeV, with an uncertainty of about 0.17. Worth quoting, because “about 125” hides how well this is pinned down.",
  },
  {
    id: "frame",
    label: "Found something to compare it to",
    body: "133 protons, or roughly a caesium atom. A number nobody has a feel for becomes one they do.",
  },
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

/** Both states. */
export const States: Story = {
  render: () => (
    <>
      <Wrap label="done — folded, and it kept the count and how long it took">
        <ChainOfThought steps={STEPS} duration={4200} />
      </Wrap>
      <Wrap label="done, opened — each step follows from the one above it">
        <ChainOfThought steps={STEPS} duration={4200} defaultOpen />
      </Wrap>
    </>
  ),
};

/** While it runs, the header narrates the step it is on. */
export const Thinking: Story = {
  render: () => (
    <Wrap label="thinking — the header says where it is up to">
      <ChainOfThought
        state="thinking"
        steps={[
          { ...STEPS[0] },
          { ...STEPS[1], state: "running" },
          { id: "frame", label: "Find something to compare it to", state: "pending" },
        ]}
      />
    </Wrap>
  ),
};

/** A step's working is whatever you put there — including a tool call. */
export const WithATool: Story = {
  render: () => (
    <Wrap label="a step whose working is a tool call">
      <ChainOfThought
        defaultOpen
        duration={4200}
        steps={[
          STEPS[0],
          {
            id: "check",
            label: "Checked the current measured value",
            body: (
              <Tool
                name="search_web"
                state="done"
                summary="2 results"
                duration={412}
                input={{ query: "higgs boson mass measurement" }}
                output={{ combined_gev: 125.25, uncertainty: 0.17 }}
              />
            ),
          },
          STEPS[2],
        ]}
      />
    </Wrap>
  ),
};

/** Steps arriving one at a time, which is how a derivation actually reads. */
export const Live: Story = {
  render: function Live() {
    const [at, setAt] = useState(0);
    useEffect(() => {
      const t = setInterval(() => setAt((i) => (i + 1) % (STEPS.length + 2)), 1600);
      return () => clearInterval(t);
    }, []);
    const done = at >= STEPS.length;
    return (
      <Wrap label="it grows — a plan is known up front, a derivation is not">
        <ChainOfThought
          state={done ? "done" : "thinking"}
          duration={done ? 4200 : undefined}
          steps={STEPS.slice(0, Math.min(at + 1, STEPS.length)).map((step, i) => ({
            ...step,
            state: !done && i === Math.min(at, STEPS.length - 1) ? "running" : "done",
          }))}
        />
      </Wrap>
    );
  },
};
