import { useCallback, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import { useChatTurns, type ChatTurn } from "../useChatTurns/useChatTurns";
import type { ChatInputHandle } from "../ChatInput/ChatInput";

const ANSWER =
  "Particle physics studies the most fundamental constituents of matter and the " +
  "forces that act between them. The Standard Model organises twelve fermions — " +
  "six quarks and six leptons — plus the force-carrying bosons into a single " +
  "coherent framework.";

const turn = (over: Partial<ChatTurn> = {}): ChatTurn => ({
  id: "t1",
  user: "What does particle physics actually study?",
  ai: "",
  state: "idle",
  ...over,
});

const meta: Meta<typeof ChatTurnRow> = {
  title: "Components/ChatTurnRow",
  component: ChatTurnRow,
  parameters: { layout: "padded" },
  argTypes: {
    selectionMode: { control: "inline-radio", options: ["marker", "precise"] },
  },
  args: { selectionMode: "marker", placeholder: "Ask me about particle physics…" },
};

export default meta;
type Story = StoryObj<typeof ChatTurnRow>;

const Frame = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 56, maxWidth: 720 }}>
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

/**
 * The four states a turn passes through, side by side. `idle` and `typing`
 * are a composer; `responding` and `resting` are a bubble with an answer
 * under it.
 */
export const States: Story = {
  render: (args) => (
    <div>
      <Frame label="idle — an empty composer">
        <ChatTurnRow {...args} turn={turn({ user: "" })} isActiveInput />
      </Frame>
      <Frame label="typing">
        <ChatTurnRow {...args} turn={turn({ state: "typing" })} isActiveInput />
      </Frame>
      <Frame label="responding — aria-busy, and the answer arriving">
        <ChatTurnRow
          {...args}
          turn={turn({ state: "responding", ai: ANSWER.slice(0, 96) })}
        />
      </Frame>
      <Frame label="resting — settled, and markable">
        <ChatTurnRow {...args} turn={turn({ state: "resting", ai: ANSWER })} />
      </Frame>
    </div>
  ),
};

/** Precise selection instead of the freeform marker. */
export const PreciseSelection: Story = {
  render: (args) => (
    <Frame label="selectionMode: precise">
      <ChatTurnRow {...args} selectionMode="precise" turn={turn({ state: "resting", ai: ANSWER })} />
    </Frame>
  ),
};

/**
 * A live conversation, driven by `useChatTurns` — which is the pairing the
 * row exists for. Ask something; the answer is fixed, the plumbing is real.
 */
function LiveConversation(args: React.ComponentProps<typeof ChatTurnRow>) {
  const activeInput = useRef<ChatInputHandle>(null);
  const [mode] = useState(args.selectionMode);

  const onSend = useCallback(async function* () {
    for (const word of ANSWER.split(" ")) {
      await new Promise((r) => setTimeout(r, 26));
      yield `${word} `;
    }
  }, []);

  const { turns, setDraft, submit, stop, beginEdit, cancelEdit } = useChatTurns({ onSend });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 48, maxWidth: 720 }}>
      {turns.map((t, i) => {
        const isActive = i === turns.length - 1 && (t.state === "idle" || t.state === "typing");
        return (
          <ChatTurnRow
            key={t.id}
            turn={t}
            isActiveInput={isActive}
            inputRef={isActive ? activeInput : null}
            selectionMode={mode}
            placeholder={args.placeholder}
            onDraft={setDraft}
            onSubmit={submit}
            onStop={stop}
            onEdit={beginEdit}
            onCancelEdit={cancelEdit}
          />
        );
      })}
    </div>
  );
}

export const Live: Story = {
  render: (args) => <LiveConversation {...args} />,
};

/**
 * The long answer, to see where the measure falls. `--ick-answer-measure` is
 * in `ch`, so it follows whatever font a brand sets rather than fighting it.
 */
export const Measure: Story = {
  render: (args) => (
    <Frame label="--ick-answer-measure: 56ch">
      <ChatTurnRow
        {...args}
        turn={turn({
          state: "resting",
          ai: `${ANSWER} The Higgs boson, found at CERN in 2012, completes the picture by giving elementary particles their mass through interaction with the Higgs field.`,
        })}
      />
    </Frame>
  ),
};
