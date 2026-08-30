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
  parts: [],
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

/**
 * Where the composer sits.
 *
 * `end` by default, because it is about to become the reader's own bubble.
 * `stretch` is for the opening composer — on an empty conversation it is not a
 * message on its way, it is the box under the openers, and it lines up with
 * them instead of floating at the right edge of the column.
 */
export const OpeningComposer: Story = {
  render: (args) => (
    <div style={{ maxWidth: 560 }}>
      <Frame label='questionAlign="end" — the default, on its way to being a bubble'>
        <ChatTurnRow {...args} turn={turn({ user: "" })} isActiveInput />
      </Frame>
      <Frame label='questionAlign="stretch" — the opening, lined up with what is above it'>
        <ChatTurnRow {...args} turn={turn({ user: "" })} isActiveInput questionAlign="stretch" />
      </Frame>
    </div>
  ),
};

/**
 * A whole agent turn: what it thought, what it ran, and what it answered.
 *
 * Everything below the question is `turn.parts` — the row draws each kind with
 * the component that owns it, and a `SendHandler` streams them in among the
 * answer's prose.
 */
export const AnAgentTurn: Story = {
  render: (args) => (
    <Frame label="reasoning, a tool call, a plan, and the answer">
      <ChatTurnRow
        {...args}
        turn={turn({
          state: "resting",
          ai: ANSWER,
          parts: [
            {
              kind: "reasoning",
              id: "r",
              state: "done",
              duration: 2400,
              text: "The question is about size, and the honest answer is that it does not have one.\n\nBetter to give the mass instead — but check the current figure first.",
            },
            {
              kind: "tool",
              id: "t",
              name: "search_web",
              state: "done",
              summary: "2 results",
              duration: 412,
              input: { query: "higgs boson mass measurement", limit: 3 },
              output: { results: [{ title: "ATLAS and CMS combined", rank: 1 }], took_ms: 412 },
            },
            {
              kind: "tasks",
              id: "p",
              title: "Plan",
              collapsible: true,
              tasks: [
                { id: "look", label: "Look up the current figure", state: "done" },
                { id: "write", label: "Say why size is the wrong question", state: "done" },
              ],
            },
          ],
        })}
      />
    </Frame>
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
