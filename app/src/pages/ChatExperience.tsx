import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useDialKit } from "dialkit";
import {
  ChatInput,
  type ChatInputState,
  type InlineAnimConfig,
} from "../components/ChatInput/ChatInput";
import "./ChatExperience.css";

/**
 * ChatExperience — vertical conversation with right-aligned bubbles.
 *
 * The model: each turn is the SAME ChatInput cycling through
 *   idle → typing → responding → resting
 *
 * The active turn is always the last turn in the list. When the user
 * presses Enter, the active turn transitions to responding (the input
 * becomes the bubble in place — no new component, no remount). The AI
 * response streams in below it. When the response settles to resting,
 * a fresh idle turn is appended below — that becomes the next input.
 *
 * Everything is right-aligned (input + bubbles); AI text is left-aligned.
 */

const AI_RESPONSE = [
  "Particle physics studies the most fundamental constituents of matter and the forces that act between them.",
  "The Standard Model organises twelve fermions — six quarks and six leptons — plus the force-carrying bosons into a single coherent framework.",
  "The Higgs boson, found at CERN in 2012, completes the picture by giving elementary particles their mass through interaction with the Higgs field.",
];

const HIGGS_SIZE_RESPONSE = [
  "The Higgs boson is a point particle — it has no measurable spatial extent or internal structure at any scale we can currently probe.",
  "Its mass sits at roughly 125 GeV/c², about 133 times heavier than a proton, which corresponds to a length scale of around 1.6 × 10⁻¹⁸ metres.",
  "So 'how big is it' has only one honest answer: it has no size, only mass and quantum numbers.",
];

interface Turn {
  id: string;
  user: string;
  ai: string;
  state: ChatInputState;
}

const newTurn = (): Turn => ({
  id: crypto.randomUUID(),
  user: "",
  ai: "",
  state: "idle",
});

export function ChatExperience() {
  const [turns, setTurns] = useState<Turn[]>([newTurn()]);
  const streamingRef = useRef<number | null>(null);
  const turnCountRef = useRef(0);
  const animConfig = useDialKit("Inline Config", {
    bubble: {
      stiffness: [600,  50,   600,  1    ],
      damping:   [21.5, 5,    60,   0.5  ],
      mass:      [0.2,  0.1,  3,    0.05 ],
    },
    button: {
      stiffness: [380,  50,  600,  1    ],
      damping:   [34,   5,   60,   0.5  ],
      mass:      [0.9,  0.1, 3,    0.05 ],
      stagger:   [0.055, 0,  0.3,  0.005],
    },
    ripple: {
      scaleX:       [1.0,  1,    1.06, 0.001],
      duration:     [0.19, 0.1,  1,    0.01 ],
      pulseDuration:[140,  50,   600,  10   ],
    },
    wrap: {
      nearThreshold:   [0.92, 0.5,  1,    0.01 ],
      exitThreshold:   [0.75, 0.3,  0.99, 0.01 ],
      preExpandHeight: [16,   0,    60,   1    ],
      slideInDelay:    [120,  0,    800,  10   ],
    },
  }) as InlineAnimConfig;

  // Cleanup any in-flight streaming timer on unmount.
  useEffect(() => {
    return () => {
      if (streamingRef.current) clearTimeout(streamingRef.current);
    };
  }, []);

  const updateTurn = (id: string, patch: Partial<Turn>) => {
    setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
  };

  const handleChange = (id: string, value: string) => {
    updateTurn(id, {
      user: value,
      state: value.length > 0 ? "typing" : "idle",
    });
  };

  const handleSubmit = (id: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    updateTurn(id, { user: trimmed, state: "responding" });

    setTimeout(() => {
      document.getElementById(`turn-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);

    const response = turnCountRef.current % 2 === 0 ? AI_RESPONSE : HIGGS_SIZE_RESPONSE;
    turnCountRef.current += 1;
    streamAi(id, response);
  };

  const streamAi = (turnId: string, response: string[]) => {
    const fullText = response.join(" ");
    let i = 0;

    const tick = () => {
      if (i >= fullText.length) {
        finishTurn(turnId);
        return;
      }
      setTurns((t) =>
        t.map((turn) =>
          turn.id === turnId ? { ...turn, ai: fullText.slice(0, i + 1) } : turn
        )
      );
      const char = fullText[i];
      i += 1;
      const delay = char === "." ? 40 : char === "," ? 18 : 3;
      streamingRef.current = window.setTimeout(tick, delay);
    };
    streamingRef.current = window.setTimeout(tick, 300);
  };

  const finishTurn = (turnId: string) => {
    streamingRef.current = null;
    // Settle the responding bubble to resting at its position, then append
    // a fresh idle turn below — that becomes the next input.
    setTurns((t) =>
      t.map((turn) => (turn.id === turnId ? { ...turn, state: "resting" } : turn))
    );
    // Small delay so the resting morph plays cleanly before the new input
    // pops in below.
    window.setTimeout(() => {
      setTurns((t) => [...t, newTurn()]);
    }, 320);
  };

  const handleStop = (turnId: string) => {
    if (streamingRef.current) {
      clearTimeout(streamingRef.current);
      streamingRef.current = null;
    }
    finishTurn(turnId);
  };

  return (
    <div className="chatPage">
      <div className="chatFeed">
        <AnimatePresence initial={false}>
          {turns.map((turn, i) => {
            const isActiveInput = i === turns.length - 1 && (turn.state === "idle" || turn.state === "typing");
            return (
              <motion.article
                key={turn.id}
                id={`turn-${turn.id}`}
                className={`chatTurn${isActiveInput ? " activeInput" : ""}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
              <div className="userRow">
                <ChatInput
                  state={turn.state}
                  value={turn.user}
                  onChange={(v) => handleChange(turn.id, v)}
                  onSubmit={(v) => handleSubmit(turn.id, v)}
                  onStop={() => handleStop(turn.id)}
                  variant="inline"
                  animationConfig={animConfig}
                  placeholder="Ask me about particle physics…"
                />
              </div>
              {turn.ai && <p className="aiText">{turn.ai}</p>}
            </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="bottomBlur" />
    </div>
  );
}
