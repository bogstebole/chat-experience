import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ChatInput,
  type ChatInputState,
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
  "The Standard Model is the framework that organises everything we currently know about elementary particles.",
  "It contains twelve fermions — six quarks and six leptons — that make up all the matter we observe.",
  "Quarks combine into hadrons: protons and neutrons are each built from three of them, bound together by gluons.",
  "The Higgs boson, discovered in 2012 at CERN, completes the model — its associated field gives elementary particles their mass.",
  "Antimatter is the mirror image of ordinary matter — every particle has an antiparticle with opposite charge but identical mass.",
  "When a particle meets its antiparticle they annihilate, converting their combined mass entirely into energy via E = mc².",
  "The universe contains far more matter than antimatter today, and explaining that asymmetry is one of the biggest unsolved problems in physics.",
  "Neutrinos are produced in colossal numbers by the Sun — roughly 65 billion pass through every square centimetre of your skin each second.",
  "They interact so weakly with matter that a light-year of lead would stop only about half of them.",
  "Quantum chromodynamics, or QCD, describes how quarks are bound by the strong force — the force actually gets stronger as quarks are pulled apart.",
  "Trying to separate two quarks produces enough energy to create a new quark-antiquark pair, so isolated free quarks have never been observed.",
  "Virtual particles are a consequence of the uncertainty principle — they borrow energy from the vacuum for an instant too short for it to be measured.",
  "The Casimir effect is a measurable force between two uncharged metal plates caused by the pressure of virtual particles in the vacuum between them.",
  "String theory proposes that all particles are actually tiny vibrating strings of energy, with different vibration modes producing different particles.",
];

const HIGGS_SIZE_RESPONSE = [
  "The Higgs boson has no measurable size in the way a proton does — it is a point particle, meaning it has no known internal structure or spatial extent.",
  "Its mass, however, is well measured: roughly 125 GeV/c², about 133 times heavier than a proton.",
  "In natural units, that mass corresponds to a length scale of around 1.6 × 10⁻¹⁸ metres — far smaller than a proton, which is about 10⁻¹⁵ metres across.",
  "So when physicists ask how 'big' the Higgs is, the honest answer is: point-like at every scale we can currently probe, with its identity defined by mass and quantum numbers, not by volume.",
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
          {turns.map((turn) => {
            return (
              <motion.article
                key={turn.id}
                id={`turn-${turn.id}`}
                className="chatTurn"
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
