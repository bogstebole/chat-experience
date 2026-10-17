import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatInput, type ChatInputState } from "../ChatInput/ChatInput";
import type { ComposerDictation } from "../ChatInput/Dictation";
import type { LiveTranscribeHandler } from "../voice/useVoiceInput";

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

/**
 * Every state at once, which is the only way to see them next to each other.
 * The fifth is not a state but `busy`: a typing composer while an answer is
 * arriving somewhere else — open to type into, offering a stop, not a send.
 */
export const AllStates: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, width: 420 }}>
      {[...STATES, "busy" as const].map((state) => (
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
            state={state === "busy" ? "typing" : state}
            busy={state === "busy"}
            onStop={state === "busy" ? () => {} : undefined}
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
 * The kit draws the dictating and records; the host attaches the service that
 * turns speech into words. Give it nothing and there is no microphone at all.
 * Two ways to attach one:
 *
 * - **`onTranscribe`** takes the recording when it is done and gives back the
 *   words — posted to your own endpoint, typically.
 * - **`onTranscribeLive`** takes the microphone's stream as it opens and gives
 *   back the transcript so far, while it is still being said.
 *
 * `transcriber` here picks one: the recording handed back as a size in words
 * (`after`), words arriving as they would from a live service (`live`), or
 * Chrome's own recogniser (`chrome`) — free, and Google Chrome only: it sends
 * the audio to Google, and Arc, Brave, Dia, Edge and Firefox do not answer.
 *
 * `dictation` picks how it looks while it listens: the microphone unrolling
 * into a recorder (`recorder`, the default), or the field becoming one
 * (`surface`).
 *
 * Storybook cannot grant a microphone on your behalf, so pressing this asks
 * the browser, and refusing is worth doing once: a refusal is the one state
 * that has to say something in words, because a blocked microphone looks
 * exactly like an idle one and the browser has stopped offering its prompt.
 */
const SPOKEN = "book a table for two on friday at eight somewhere quiet".split(" ");

/** What a live service does, without one: a word every 380ms until Done. */
const simulatedLive: LiveTranscribeHandler = async function* (_stream, { signal, finished }) {
  let done = false;
  void finished.then(() => (done = true));
  for (let said = 1; said <= SPOKEN.length && !done && !signal.aborted; said++) {
    await new Promise((wait) => setTimeout(wait, 380));
    yield SPOKEN.slice(0, said).join(" ");
  }
};

interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/**
 * Chrome's recogniser as a live transcriber — the README's example, as it is
 * there. It opens the microphone itself rather than taking the stream, and
 * Chrome ends it after a long pause, so it starts again keeping what it heard.
 */
const chromeLive =
  (lang: string): LiveTranscribeHandler =>
  async function* (_stream, { signal, finished }) {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    let kept = "";
    let latest = "";
    let stopping = false;
    let ended = false;
    let wake = () => {};
    recognition.onresult = (event) => {
      let all = kept;
      for (let i = 0; i < event.results.length; i++) all += ` ${event.results[i][0].transcript}`;
      latest = all.trim().replace(/\s+/g, " ");
      wake();
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") stopping = true;
    };
    recognition.onend = () => {
      if (stopping || signal.aborted) {
        ended = true;
        wake();
        return;
      }
      kept = latest;
      recognition.start();
    };
    void finished.then(() => {
      stopping = true;
      recognition.stop();
    });
    signal.addEventListener("abort", () => recognition.abort());
    recognition.start();
    // What arrived while the last words were being handed over is not lost:
    // it is checked before waiting again.
    let given = "";
    for (;;) {
      if (latest !== given) {
        yield (given = latest);
        continue;
      }
      if (ended) return;
      await new Promise<void>((resolve) => (wake = resolve));
    }
  };

interface DictationArgs {
  dictation: ComposerDictation;
  transcriber: "after" | "live" | "chrome";
  /** For `chrome`: what language it listens for. */
  language: string;
}

function DictatedChatInput({ dictation, transcriber, language }: DictationArgs) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<ChatInputState>("idle");

  return (
    <div style={{ width: "min(420px, calc(100vw - 32px))" }}>
      <ChatInput
        state={state}
        value={value}
        placeholder="Say something, or type it"
        dictation={dictation}
        onChange={(next) => {
          setValue(next);
          setState(next ? "typing" : "idle");
        }}
        onSubmit={() => {
          setState("responding");
          setTimeout(() => setState("resting"), 1200);
        }}
        onStop={() => setState("resting")}
        onTranscribe={
          transcriber === "after"
            ? async function* (audio, { signal }) {
                const words = `heard ${(audio.size / 1024).toFixed(1)} kB of audio, in pieces`.split(" ");
                for (const word of words) {
                  await new Promise((done) => setTimeout(done, 220));
                  if (signal.aborted) return;
                  yield `${word} `;
                }
              }
            : undefined
        }
        onTranscribeLive={transcriber === "live" ? simulatedLive : transcriber === "chrome" ? chromeLive(language) : undefined}
      />
    </div>
  );
}

export const Dictation: StoryObj<DictationArgs> = {
  args: { dictation: "recorder", transcriber: "live", language: "en-US" },
  argTypes: {
    dictation: { control: "inline-radio", options: ["recorder", "surface"] },
    transcriber: { control: "inline-radio", options: ["after", "live", "chrome"] },
    language: { control: "text" },
  },
  render: (a) => <DictatedChatInput {...a} />,
};
