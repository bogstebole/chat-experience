import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Share2 } from "lucide-react";
import { AnswerActions, type Verdict } from "../AnswerActions/AnswerActions";
import { Button } from "../Button/Button";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import type { ChatTurn } from "../useChatTurns/useChatTurns";

const TEXT =
  "Particle physics studies the most fundamental constituents of matter and the forces that " +
  "act between them.";

const meta: Meta<typeof AnswerActions> = {
  title: "Components/AnswerActions",
  component: AnswerActions,
  parameters: { layout: "padded" },
  args: { text: TEXT, reveal: false, busy: false },
};

export default meta;
type Story = StoryObj<typeof AnswerActions>;

const Frame = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 36, maxWidth: 560 }}>
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

const Answer = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: "0.75rem", lineHeight: 1.7, color: "var(--ick-ink)", maxWidth: "56ch" }}>
    <p style={{ margin: "0 0 12px" }}>{TEXT}</p>
    {children}
  </div>
);

/**
 * Only what has somewhere to report is drawn. A button that calls nothing
 * looks like a feature and behaves like a dead end.
 */
export const WhatIsDrawn: Story = {
  render: (args) => (
    <div>
      <Frame label="copy alone — no other handlers given">
        <Answer>
          <AnswerActions {...args} />
        </Answer>
      </Frame>
      <Frame label="with regenerate">
        <Answer>
          <AnswerActions {...args} onRegenerate={() => {}} />
        </Answer>
      </Frame>
      <Frame label="everything, plus one of your own">
        <Answer>
          <AnswerActions {...args} onRegenerate={() => {}} onFeedback={() => {}}>
            <Button variant="ghost" icon={<Share2 size={14} aria-hidden />} aria-label="Share" />
          </AnswerActions>
        </Answer>
      </Frame>
    </div>
  ),
};

/** Press one, press it again to take it back. */
function Verdicts(args: React.ComponentProps<typeof AnswerActions>) {
  const [feedback, setFeedback] = useState<Verdict | null>(null);
  return (
    <Frame label={`feedback: ${feedback ?? "none"}`}>
      <Answer>
        <AnswerActions {...args} feedback={feedback} onFeedback={setFeedback} onRegenerate={() => {}} />
      </Answer>
    </Frame>
  );
}

export const TheVerdict: Story = { render: (args) => <Verdicts {...args} /> };

/** Regenerating: the button refuses a second press while it is already going. */
export const Busy: Story = {
  render: (args) => (
    <Frame label="busy">
      <Answer>
        <AnswerActions {...args} onRegenerate={() => {}} onFeedback={() => {}} busy />
      </Answer>
    </Frame>
  ),
};

/**
 * Invisible until hovered or focused — but still there, still taking up its
 * space, still hit-testing. Tab into it and `:focus-within` brings it back.
 */
export const Revealed: Story = {
  render: (args) => (
    <Frame label="hover the row under the answer, or tab into it">
      <Answer>
        <AnswerActions {...args} reveal onRegenerate={() => {}} onFeedback={() => {}} />
      </Answer>
    </Frame>
  ),
};

const turn = (over: Partial<ChatTurn> = {}): ChatTurn => ({
  id: "t1",
  user: "What does particle physics actually study?",
  ai: TEXT,
  state: "resting",
  ...over,
});

/**
 * In place. They appear when the answer *settles* — offering to copy a
 * half-written answer, or to rate one, is offering the wrong thing.
 */
export const InATurn: Story = {
  render: () => (
    <div style={{ maxWidth: 620 }}>
      <Frame label="responding — nothing to act on yet">
        <ChatTurnRow turn={turn({ state: "responding", ai: TEXT.slice(0, 60) })} />
      </Frame>
      <Frame label="resting">
        <ChatTurnRow turn={turn()} onRegenerate={() => {}} onFeedback={() => {}} />
      </Frame>
    </div>
  ),
};
