import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatInput, type ChatInputState } from "../ChatInput/ChatInput";

const meta: Meta<typeof ChatInput> = {
  title: "Components/ChatInput",
  component: ChatInput,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof ChatInput>;

/** Type into it. The morph out of the input is the whole point of the thing. */
/** A component, not an inline render function — hooks belong in one. */
function LiveChatInput() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<ChatInputState>("idle");

  return (
    <div style={{ width: 420 }}>
      <ChatInput
        state={state}
        value={value}
        placeholder="Ask me anything"
        onChange={(next) => {
          setValue(next);
          setState(next ? "typing" : "idle");
        }}
        onSubmit={() => {
          setState("responding");
          setTimeout(() => setState("resting"), 1200);
        }}
        onStop={() => setState("resting")}
        onEdit={() => setState("typing")}
      />
    </div>
  );
}

export const Interactive: Story = {
  render: () => <LiveChatInput />,
};

const STATES: ChatInputState[] = ["idle", "typing", "responding", "resting"];

/** Every state at once, which is the only way to see them next to each other. */
export const AllStates: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, width: 420 }}>
      {STATES.map((state) => (
        <div key={state}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--ick-font-mono)",
              color: "var(--ick-ink-faint)",
              marginBottom: 8,
            }}
          >
            {state}
          </div>
          <ChatInput
            state={state}
            value={state === "idle" ? "" : "What is a quark?"}
            placeholder="Ask me anything"
            onChange={() => {}}
            onSubmit={() => {}}
          />
        </div>
      ))}
    </div>
  ),
};

/**
 * Dictation.
 *
 * `onTranscribe` is the whole switch: given, the composer offers a microphone
 * where the send glyph would be while there is nothing to send; left out,
 * there is no microphone at all.
 *
 * The handler here does what a real one does — takes the recording, takes its
 * time, yields the words in pieces — without a service behind it, so the
 * states are the real ones and the sentence is not. A real handler posts the
 * blob somewhere and yields what comes back.
 *
 * Storybook cannot grant a microphone on your behalf, so pressing this asks
 * the browser, and refusing is worth doing once: a refusal is the one state
 * that has to say something in words, because a blocked microphone looks
 * exactly like an idle one and the browser has stopped offering its prompt.
 */
function DictatedChatInput() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<ChatInputState>("idle");

  return (
    <div style={{ width: 420 }}>
      <ChatInput
        state={state}
        value={value}
        placeholder="Say something, or type it"
        onChange={(next) => {
          setValue(next);
          setState(next ? "typing" : "idle");
        }}
        onSubmit={() => {
          setState("responding");
          setTimeout(() => setState("resting"), 1200);
        }}
        onStop={() => setState("resting")}
        onTranscribe={async function* (audio, { signal }) {
          const words = `heard ${(audio.size / 1024).toFixed(1)} kB of audio, in pieces`.split(" ");
          for (const word of words) {
            await new Promise((done) => setTimeout(done, 220));
            if (signal.aborted) return;
            yield `${word} `;
          }
        }}
      />
    </div>
  );
}

export const Dictation: Story = {
  render: () => <DictatedChatInput />,
};
