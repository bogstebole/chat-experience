import { useEffect, useRef, useState } from "react";
import "./App.css";
import { ChatInput, type ChatInputState } from "./components/ChatInput/ChatInput";

const STATES: { id: ChatInputState; title: string; desc: string }[] = [
  {
    id: "idle",
    title: "Default state",
    desc: "Regular input, should behave like a regular input.",
  },
  {
    id: "typing",
    title: "Typing state",
    desc: "While user is typing text and button become active.",
  },
  {
    id: "responding",
    title: "Chat bubble state",
    desc: "When users press enter, the input morphs into this chat bubble. While the AI agent is responding, Stop CTA should persist.",
  },
  {
    id: "resting",
    title: "Chat bubble resting state",
    desc: "When reply is finished, the input goes to its resting state.",
  },
];

function App() {
  const [state, setState] = useState<ChatInputState>("idle");
  const [value, setValue] = useState("");
  const stopTimer = useRef<number | null>(null);

  // When typing begins from idle, transition to typing state.
  useEffect(() => {
    if (state === "idle" && value.length > 0) setState("typing");
    if (state === "typing" && value.length === 0) setState("idle");
  }, [value, state]);

  // Simulated agent response: after 2.4s of "responding", drop to "resting".
  useEffect(() => {
    if (state === "responding") {
      stopTimer.current = window.setTimeout(() => setState("resting"), 2400);
    }
    return () => {
      if (stopTimer.current) {
        clearTimeout(stopTimer.current);
        stopTimer.current = null;
      }
    };
  }, [state]);

  const handleSubmit = (v: string) => {
    if (!v.trim()) return;
    setValue(v.trim());
    setState("responding");
  };

  const handleStop = () => setState("resting");

  const reset = () => {
    setValue("");
    setState("idle");
  };

  return (
    <main className="page">
      <header>
        <h1>Chat input</h1>
        <p>
          Single morphing element across four states. The pill, leading icon,
          editor, and trailing button persist as the same DOM nodes — only their
          layout, fill, and shadow change. Animations use spring physics for a
          continuous, fluid feel rather than fades between variants.
        </p>
      </header>

      <nav className="rail" aria-label="States">
        {STATES.map((s) => (
          <button
            key={s.id}
            className={`railItem ${state === s.id ? "active" : ""}`}
            onClick={() => {
              // Rail clicks always show the canonical sample for that state,
              // matching the design spec.
              if (s.id === "idle") setValue("");
              if (s.id === "typing") setValue("I am typing");
              if (s.id === "responding" || s.id === "resting") setValue("Hello there");
              setState(s.id);
            }}
          >
            <span>{s.title}</span>
            <kbd>{s.id}</kbd>
            <span className="desc">{s.desc}</span>
          </button>
        ))}
      </nav>

      <section className="stage">
        <div className="stageHeader">{stageHeaderFor(state)}</div>
        <div className="stageBox">
          <ChatInput
            state={state}
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            onStop={handleStop}
          />
        </div>

        <div className="controls">
          <button onClick={reset}>Reset</button>
          <button
            onClick={() => {
              setValue("Hello there");
              setState("responding");
            }}
            disabled={state === "responding"}
          >
            Simulate send
          </button>
          <button
            onClick={() => setState("resting")}
            disabled={state !== "responding"}
          >
            Force stop
          </button>
        </div>

        <p className="note">
          Try it: focus the input and start typing — the send button morphs in.
          Press Enter to submit; the pill morphs into a glass bubble with a stop
          control. After the response settles, the bubble drops to its resting
          state.
        </p>
      </section>
    </main>
  );
}

function stageHeaderFor(s: ChatInputState) {
  switch (s) {
    case "idle":
      return "Default";
    case "typing":
      return "Typing";
    case "responding":
      return "Chat bubble — responding";
    case "resting":
      return "Chat bubble — resting";
  }
}

export default App;
