import { useCallback, useRef, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Conversation } from "../Conversation/Conversation";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import { useChatTurns } from "../useChatTurns/useChatTurns";
import type { ChatInputHandle } from "../ChatInput/ChatInput";

const meta: Meta<typeof Conversation> = {
  title: "Components/Conversation",
  component: Conversation,
  parameters: { layout: "padded" },
  args: { follow: true, scrollButton: true, threshold: 64 },
};

export default meta;
type Story = StoryObj<typeof Conversation>;

const Box = ({ children, label }: { children: React.ReactNode; label: string }) => (
  <div style={{ maxWidth: 620 }}>
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
    <div
      style={{
        height: 320,
        display: "flex",
        border: "1px dashed var(--ick-border)",
        borderRadius: 12,
        background: "var(--ick-surface)",
      }}
    >
      {children}
    </div>
  </div>
);

const Line = ({ i }: { i: number }) => (
  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--ick-ink-soft)" }}>
    {i}. The Standard Model organises twelve fermions — six quarks and six leptons — plus the
    force-carrying bosons into a single coherent framework.
  </p>
);

/**
 * An answer arriving. The view keeps up on its own; scroll up with the wheel
 * and it lets go at once, and the button appears offering the way back.
 */
function Growing(args: React.ComponentProps<typeof Conversation>) {
  const [lines, setLines] = useState(4);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggle = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = setInterval(() => setLines((n) => (n > 40 ? 4 : n + 1)), 500);
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        style={{
          marginBottom: 12,
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid var(--ick-border)",
          background: "var(--ick-surface)",
          color: "var(--ick-ink)",
          font: "inherit",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        start / stop the answer
      </button>
      <Box label="scroll up while it grows — it should stop following you">
        <Conversation {...args}>
          {Array.from({ length: lines }, (_, i) => (
            <Line key={i} i={i + 1} />
          ))}
        </Conversation>
      </Box>
    </div>
  );
}

export const Growing_: Story = { name: "Growing", render: (args) => <Growing {...args} /> };

/**
 * The case that decides the design. This box has a screen-height pad below the
 * content — the demo carries one so a turn can be pulled to the top — and
 * scrolling to the container's bottom would put the answer off the top of the
 * screen, in front of a blank space. It follows the end of the *content*.
 */
export const WithPaddingBelow: Story = {
  render: (args) => (
    <Box label="240px of padding under the content; the end of the text still sits at the edge">
      <Conversation {...args} viewportClassName="sb-padded">
        <style>{`.sb-padded { padding-bottom: 240px; }`}</style>
        {Array.from({ length: 12 }, (_, i) => (
          <Line key={i} i={i + 1} />
        ))}
      </Conversation>
    </Box>
  ),
};

/**
 * The other anchor, and the one this kit is built around: a turn held at the
 * top while its answer grows underneath.
 *
 * Press the button to "send" a message. The view goes to it and stays there —
 * what is on screen is the question and its answer, rather than the whole
 * conversation shoved up from below with the composer ending past the fold.
 */
function Anchored(args: React.ComponentProps<typeof Conversation>) {
  const [turns, setTurns] = useState([{ id: 1, lines: 3 }]);
  const anchor = turns[turns.length - 1].id;

  const send = () => {
    const id = anchor + 1;
    setTurns((t) => [...t, { id, lines: 0 }]);
    let n = 0;
    const grow = setInterval(() => {
      n += 1;
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, lines: n } : turn)));
      if (n >= 5) clearInterval(grow);
    }, 500);
  };

  return (
    <div>
      <button
        type="button"
        onClick={send}
        style={{
          marginBottom: 12,
          padding: "6px 12px",
          borderRadius: 999,
          border: "1px solid var(--ick-border)",
          background: "var(--ick-surface)",
          color: "var(--ick-ink)",
          font: "inherit",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        send a message
      </button>
      <Box label="the newest turn is held at the top; the answer grows below it">
        <Conversation {...args} anchorId={`turn-${anchor}`} viewportClassName="sb-roomy">
          <style>{`.sb-roomy { padding-bottom: 90%; }`}</style>
          {turns.map((turn) => (
            <div key={turn.id} id={`turn-${turn.id}`} style={{ display: "grid", gap: 16 }}>
              <div style={{ justifySelf: "end", padding: "8px 16px", borderRadius: 999, background: "var(--ick-surface-sunken)", fontSize: 13 }}>
                Question {turn.id}
              </div>
              {Array.from({ length: turn.lines }, (_, i) => (
                <Line key={i} i={i + 1} />
              ))}
            </div>
          ))}
        </Conversation>
      </Box>
    </div>
  );
}

export const AnchoredToATurn: Story = { render: (args) => <Anchored {...args} /> };

/** Switched off, it is a plain scroll container and nothing moves by itself. */
export const NotFollowing: Story = {
  render: (args) => (
    <Box label="follow={false}">
      <Conversation {...args} follow={false}>
        {Array.from({ length: 20 }, (_, i) => (
          <Line key={i} i={i + 1} />
        ))}
      </Conversation>
    </Box>
  ),
};

/** What it is for: a real conversation, streaming into it. */
function Live(args: React.ComponentProps<typeof Conversation>) {
  const activeInput = useRef<ChatInputHandle>(null);
  const onSend = useCallback(async function* () {
    const answer =
      "Particle physics studies the most fundamental constituents of matter and the forces that " +
      "act between them. The **Standard Model** organises them:\n\n- twelve fermions\n- the bosons\n" +
      "- the Higgs, which gives the rest their mass\n\nThe Higgs boson, found at CERN in 2012, " +
      "completes the picture by giving elementary particles their mass.";
    for (const word of answer.split(/(\s+)/)) {
      await new Promise((r) => setTimeout(r, 26));
      yield word;
    }
  }, []);

  const { turns, setDraft, submit, stop, beginEdit, cancelEdit } = useChatTurns({ onSend });

  return (
    <Box label="ask something, then scroll up while the answer arrives">
      <Conversation {...args}>
        {turns.map((turn, i) => {
          const isActive = i === turns.length - 1 && (turn.state === "idle" || turn.state === "typing");
          return (
            <ChatTurnRow
              key={turn.id}
              turn={turn}
              isActiveInput={isActive}
              inputRef={isActive ? activeInput : null}
              placeholder="Ask me about particle physics…"
              onDraft={setDraft}
              onSubmit={submit}
              onStop={stop}
              onEdit={beginEdit}
              onCancelEdit={cancelEdit}
            />
          );
        })}
      </Conversation>
    </Box>
  );
}

export const InAConversation: Story = { render: (args) => <Live {...args} /> };
