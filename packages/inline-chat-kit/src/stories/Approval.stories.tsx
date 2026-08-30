import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Approval, type Decision } from "../Approval/Approval";
import { Tool } from "../Tool/Tool";
import { CodeBlock } from "../CodeBlock/CodeBlock";

/**
 * "It wants to do this. Is that all right?"
 *
 * The one pattern from a coding agent that generalises to any agent that acts,
 * and the only component here whose whole job is to slow somebody down for a
 * moment.
 */
const meta: Meta<typeof Approval> = {
  title: "Components/Approval",
  component: Approval,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Approval>;

const Wrap = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 32, maxWidth: 520 }}>
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

const COMMAND = { command: "rm -rf Shots/", cwd: "~/Projects/chat" };

/** Asking, with the thing it wants to run under it. */
export const Asking: Story = {
  render: () => (
    <Wrap label="allow once is the primary — the narrow permission is the easy one to give">
      <Approval
        title="Run a command in your shell"
        description="It removes the generated screenshots. Nothing else is touched."
      >
        <Tool name="bash" state="pending" input={COMMAND} defaultOpen />
      </Approval>
    </Wrap>
  ),
};

/** Once it is decided it stops being a set of buttons. */
export const Decided: Story = {
  render: () => (
    <>
      {(["once", "always", "denied"] as const).map((decision) => (
        <Wrap key={decision} label={`decision="${decision}"`}>
          <Approval
            title="Run a command in your shell"
            decision={decision}
            description="It removes the generated screenshots."
          >
            <Tool name="bash" state="pending" input={COMMAND} />
          </Approval>
        </Wrap>
      ))}
    </>
  ),
};

/** Whatever it is asking about — a command, a diff, a message. */
export const AnythingUnderIt: Story = {
  render: () => (
    <Wrap label="the subject is yours: here, the code it wants to write">
      <Approval
        title="Write to src/config.ts"
        description="Twelve lines, replacing the existing export."
      >
        <CodeBlock
          lang="ts"
          label="src/config.ts"
          code={'export const config = {\n  retries: 3,\n  timeout: 10_000,\n};'}
        />
      </Approval>
    </Wrap>
  ),
};

/** Nothing under it at all, for something with nothing to show. */
export const Bare: Story = {
  render: () => (
    <Wrap label="no subject — an approval with nothing under it is a signature on a blank page, so use it sparingly">
      <Approval title="Send the summary to the family" />
    </Wrap>
  ),
};

/** Press one and watch it settle. */
export const Live: Story = {
  render: function Live() {
    const [decision, setDecision] = useState<Decision | null>(null);
    return (
      <Wrap label="press one">
        <Approval
          title="Run a command in your shell"
          description="It removes the generated screenshots. Nothing else is touched."
          decision={decision}
          onDecide={setDecision}
        >
          <Tool name="bash" state="pending" input={COMMAND} defaultOpen={decision === null} />
        </Approval>
        {decision && (
          <button
            type="button"
            onClick={() => setDecision(null)}
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
            Ask again
          </button>
        )}
      </Wrap>
    );
  },
};
