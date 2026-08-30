import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sparkles } from "lucide-react";
import { EmptyState } from "../EmptyState/EmptyState";
import { Loader } from "../Loader/Loader";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";

const meta: Meta<typeof EmptyState> = {
  title: "Components/EmptyState",
  component: EmptyState,
  parameters: { layout: "padded" },
  args: {
    title: "Ask me about particle physics",
    description: "The Standard Model, the Higgs, and what a boson actually is.",
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

const Frame = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 40, maxWidth: 600 }}>
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
    <div style={{ border: "1px dashed var(--ick-border)", borderRadius: 12 }}>{children}</div>
  </div>
);

const OPENERS = ["What is a boson?", "Explain spin", "Why does mass exist?"];

export const Everything: Story = {
  render: (args) => (
    <Frame label="icon, title, description, openers">
      <EmptyState
        {...args}
        icon={<Sparkles size={22} aria-hidden />}
        suggestions={OPENERS}
        onSuggestion={() => {}}
      />
    </Frame>
  ),
};

/** Each piece is optional, and nothing is drawn in its place. */
export const Sparse: Story = {
  render: () => (
    <div>
      <Frame label="a title alone">
        <EmptyState title="Ask me anything" />
      </Frame>
      <Frame label="openers alone">
        <EmptyState suggestions={OPENERS} onSuggestion={() => {}} />
      </Frame>
      <Frame label="nothing at all">
        <EmptyState />
      </Frame>
    </div>
  ),
};

/** An opener with nowhere to report is a button that does nothing, so it is not drawn. */
export const OpenersNeedAHandler: Story = {
  render: (args) => (
    <Frame label="suggestions given, onSuggestion omitted">
      <EmptyState {...args} suggestions={OPENERS} />
    </Frame>
  ),
};

function Picked(args: React.ComponentProps<typeof EmptyState>) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Frame label={picked ? `picked: ${picked}` : "pick one"}>
      <EmptyState {...args} suggestions={OPENERS} onSuggestion={setPicked} />
    </Frame>
  );
}

export const Picking: Story = { render: (args) => <Picked {...args} /> };

/**
 * The other half: the gap between sending and the first word. Silent, because
 * `useChatTurns` has already announced that a response is coming.
 */
export const TheLoader: Story = {
  render: () => (
    <div>
      <Frame label="dots — nothing back yet">
        <div style={{ padding: 24 }}>
          <Loader />
        </div>
      </Frame>
      <Frame label="shimmer — words standing in for something">
        <div style={{ padding: 24 }}>
          <Loader variant="shimmer">Searching the archive…</Loader>
        </div>
      </Frame>
      <Frame label="in a turn, sent and waiting">
        <div style={{ padding: 24 }}>
          <ChatTurnRow
            turn={{
              id: "t1",
              user: "What does particle physics study?",
              ai: "",
              parts: [],
              state: "responding",
            }}
          />
        </div>
      </Frame>
    </div>
  ),
};
