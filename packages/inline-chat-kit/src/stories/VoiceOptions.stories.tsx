import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { Check, ChevronLeft, ChevronUp, Lock, Mic, Plus, Square, Trash2, X } from "lucide-react";
import { KitButton } from "../Button/KitButton";
import { MorphGlyph } from "../ChatInput/MorphGlyph";
import composer from "../ChatInput/ChatInput.module.css";
import s from "./voiceOptions.module.css";
import { tone } from "./earcons";

/**
 * I4 — pressing the microphone has to feel like something started.
 *
 * Three answers, drawn as mock-ups in the composer's own classes and driven by
 * a stand-in for `useVoiceInput`: no microphone is asked for, the level is a
 * synthetic voice, and the permission prompt is a pause. Each has a live
 * composer to press and a board of its states frozen side by side.
 *
 * What all three share, because the fault is the same whichever is chosen:
 *
 * - **The press lands on the first frame.** The microphone is held down the
 *   moment it is pressed, before anything is known.
 * - **`requesting` never looks like recording.** No red, no timer, no level:
 *   the microphone glyph breathes and the words say what is being waited on.
 *   The words wait 120ms, so a reader who granted access last week does not
 *   see them flash.
 * - **Reduced motion keeps every state legible.** The dot stops pulsing and
 *   the level stops moving; the words and the count still say it is live.
 */
const meta: Meta = {
  title: "Explorations/Dictation feel (I4)",
  parameters: { layout: "centered" },
};

export default meta;

type SimState = "idle" | "requesting" | "listening" | "transcribing";

interface View {
  state: SimState;
  /** `requesting` for long enough that it is worth saying so. */
  waiting: boolean;
  elapsed: number;
  text: string;
  still: boolean;
  /** Heard so far, while still listening — only when the transcriber streams. */
  heard: string;
  /** Throw the recording away. */
  cancel: () => void;
  /** What follows the insertion point, when dictating into the middle of a sentence. Frozen boards only. */
  after?: string;
  /** Frozen boards draw a level rather than have one written. */
  history?: number[];
  press: () => void;
}

const BARS = 64;
const WORDS = "book a table for two on friday at eight".split(" ");
/** Long enough to fill a few lines while somebody is still talking. */
const SPOKEN = "book a table for two on friday at eight somewhere quiet near the river and send the confirmation to Ana".split(" ");
const PLACEHOLDER = "Ask me anything";

/** A voice, roughly: syllables at four a second, phrases with a breath between. */
const speech = (t: number, noise = 0) => {
  const phrase = t % 2.7 < 2.1 ? 1 : 0.04;
  const syllable = (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 3.6 + Math.sin(t * 1.3) * 2)) ** 1.4;
  const swell = 0.5 + 0.5 * Math.sin(t * 0.9 + 1) ** 2;
  return Math.min(1, phrase * syllable * swell * (0.8 + 0.2 * Math.sin(t * 23)) + noise);
};

const FROZEN = Array.from({ length: BARS }, (_, i) => speech(1.1 + i * 0.04));
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Where the live level is written. Its own context rather than part of the
 * view: anything passed to `ref` taints the object it came from, and the view
 * is read during render everywhere.
 */
interface Meter {
  setBars?: (el: HTMLElement | null) => void;
  /** Where the smoothed level goes, as `--level`, for whatever swells with it. */
  setMeter?: (el: HTMLElement | null) => void;
}
const MeterContext = createContext<Meter>({});

function useDictationSim(promptMs: number, forceStill: boolean, streaming = false): { view: View; meter: Meter } {
  const reduced = useReducedMotion() ?? false;
  const still = forceStill || reduced;
  const [state, setState] = useState<SimState>("idle");
  const [waiting, setWaiting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  const barsEl = useRef<HTMLElement | null>(null);
  const levelEl = useRef<HTMLElement | null>(null);
  // Callbacks rather than ref objects: a view carrying refs reads, to the
  // compiler, as refs read during render everywhere it is passed.
  const barsRef = useCallback((el: HTMLElement | null) => {
    barsEl.current = el;
  }, []);
  const levelRef = useCallback((el: HTMLElement | null) => {
    levelEl.current = el;
  }, []);
  const heardRef = useRef("");
  const timers = useRef<number[]>([]);
  const base = useRef("");

  const clear = () => {
    timers.current.forEach((id) => clearTimeout(id));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => clear, []);

  useEffect(() => {
    if (state !== "listening") return;
    const started = performance.now();
    const history = new Array<number>(BARS).fill(0);
    let frame = 0;
    let pushed = 0;
    let smoothed = 0;
    let said = 0;
    const tick = (now: number) => {
      const t = (now - started) / 1000;
      setElapsed(Math.floor(t));
      // A streaming transcriber hands words back while the speaker is still
      // going, about a third of a second behind them.
      if (streaming && t > 0.6 + said * 0.36 && said < SPOKEN.length) {
        said += 1;
        heardRef.current = SPOKEN.slice(0, said).join(" ");
        setHeard(heardRef.current);
      }
      const level = speech(t, Math.random() * 0.04);
      smoothed = smoothed * 0.7 + level * 0.3;
      if (!still) levelEl.current?.style.setProperty("--level", smoothed.toFixed(3));
      if (!still && now - pushed > 55) {
        pushed = now;
        history.shift();
        history.push(level);
        const el = barsEl.current;
        if (el) {
          for (let i = 0; i < el.children.length; i++) {
            (el.children[i] as HTMLElement).style.setProperty("--v", history[i].toFixed(3));
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const meter = levelEl;
    return () => {
      cancelAnimationFrame(frame);
      meter.current?.style.setProperty("--level", "0");
    };
  }, [state, still, streaming]);

  const press = () => {
    clear();
    if (state === "idle") {
      base.current = text;
      setState("requesting");
      setWaiting(false);
      later(() => setWaiting(true), 120);
      later(() => {
        setWaiting(false);
        setElapsed(0);
        setState("listening");
      }, promptMs);
    } else if (state === "requesting") {
      // A second press while the prompt is up is a cancel, and the grant that
      // arrives after it must not start a recording.
      setWaiting(false);
      setState("idle");
    } else if (state === "listening" && streaming) {
      // Most of it is already on screen; the last words are what is left.
      setState("transcribing");
      const lead = base.current && !base.current.endsWith(" ") ? `${base.current} ` : base.current;
      later(() => {
        setText(lead + heardRef.current);
        heardRef.current = "";
        setHeard("");
        setState("idle");
      }, 380);
    } else if (state === "listening") {
      setState("transcribing");
      const lead = base.current && !base.current.endsWith(" ") ? `${base.current} ` : base.current;
      WORDS.forEach((_, i) => later(() => setText(lead + WORDS.slice(0, i + 1).join(" ")), 450 + i * 150));
      later(() => setState("idle"), 450 + WORDS.length * 150 + 80);
    } else {
      setText(base.current);
      setState("idle");
    }
  };

  const cancel = () => {
    clear();
    heardRef.current = "";
    setHeard("");
    setWaiting(false);
    setText(base.current);
    setState("idle");
  };

  return { view: { state, waiting, elapsed, text, still, heard, press, cancel }, meter: { setBars: barsRef, setMeter: levelRef } };
}

const frozen = (state: SimState, extra: Partial<View> = {}): View => ({
  state,
  waiting: state === "requesting",
  elapsed: 4,
  text: "",
  still: false,
  history: FROZEN,
  heard: "",
  press: () => {},
  cancel: () => {},
  ...extra,
});

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function Bars({ view, className }: { view: View; className?: string }) {
  const { setBars } = useContext(MeterContext);
  return (
    <span ref={view.history ? undefined : setBars} className={[s.bars, className].filter(Boolean).join(" ")} aria-hidden>
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} style={{ "--v": view.still ? 0 : (view.history?.[i] ?? 0) } as CSSProperties} />
      ))}
    </span>
  );
}

function Editor({ text, placeholder = PLACEHOLDER }: { text: string; placeholder?: string }) {
  return (
    <div className={composer.editorClip}>
      <div className={composer.editorWrap}>
        <div className={composer.editor} data-placeholder={placeholder}>
          {text}
        </div>
      </div>
    </div>
  );
}

function Shell({ view, children, below, surfaceClass }: { view: View; children: ReactNode; below?: ReactNode; surfaceClass?: string }) {
  return (
    <div className={`${composer.wrap} ${view.still ? s.still : ""}`} style={{ width: "100%" }}>
      <div className={composer.root} style={{ width: "100%" }}>
        <div
          className={`${composer.surface} ${surfaceClass ?? ""}`}
          style={{ flexDirection: "column", alignItems: "stretch", justifyContent: "center" }}
        >
          <div className={s.row}>{children}</div>
          {below}
        </div>
      </div>
    </div>
  );
}

function Plus_() {
  return (
    <div className={s.slot}>
      <KitButton variant="ghost" kitRole="add" aria-label="Add" icon={<Plus size={14} strokeWidth={1.8} />} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}

/** The microphone as it is today, plus the held state every option shares. */
function MicButton({ view }: { view: View }) {
  const { state } = view;
  const held = state !== "idle";
  return (
    <div className={s.slot}>
      <KitButton
        variant="ghost"
        kitRole="dictate"
        className={held ? s.held : undefined}
        onClick={view.press}
        aria-pressed={state === "listening"}
        aria-busy={state === "requesting" || state === "transcribing"}
        aria-label={
          state === "listening"
            ? "Stop listening"
            : state === "requesting"
              ? "Waiting for microphone access"
              : state === "transcribing"
                ? "Cancel transcription"
                : "Dictate a message"
        }
        icon={
          <span className={state === "requesting" ? s.breathe : undefined} style={{ display: "inline-flex" }}>
            <MorphGlyph mode={state === "listening" || state === "transcribing" ? "stop" : "mic"} size={14} />
          </span>
        }
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

/* ── A · The composer becomes the recorder ──────────────────────────────── */

function OptionA({ view }: { view: View }) {
  const { state } = view;
  const live = state === "listening";
  let body: ReactNode;
  if (state === "requesting" && view.waiting) {
    body = (
      <div className={s.takeover}>
        <span>Waiting for microphone access…</span>
      </div>
    );
  } else if (live) {
    body = (
      <div className={s.takeover}>
        <span className={s.dot} />
        <span className={s.timer}>{clock(view.elapsed)}</span>
        <Bars view={view} />
      </div>
    );
  } else if (state === "transcribing" && !view.text) {
    body = (
      <div className={s.takeover}>
        <span className={s.shimmer}>Transcribing…</span>
      </div>
    );
  } else {
    body = <Editor text={view.text} />;
  }
  return (
    <Shell view={view} surfaceClass={live ? s.surfaceLive : undefined}>
      <div className={composer.editorClip}>{body}</div>
      <div className={composer.buttonGroup}>
        <MicButton view={view} />
        <Plus_ />
      </div>
    </Shell>
  );
}

/* ── B · The microphone grows into a recorder ───────────────────────────── */

function Capsule({ view }: { view: View }) {
  const { state } = view;
  const spring = { type: "spring" as const, visualDuration: 0.32, bounce: 0.2 };
  // The first 120ms are the same held microphone as everywhere else; the
  // capsule only grows once there is something to say.
  if (state === "idle" || (state === "requesting" && !view.waiting)) return <MicButton view={view} />;
  const content =
    state === "requesting" ? (
      <motion.span key="wait" className={s.capsuleWaiting} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span className={s.breathe} style={{ display: "inline-flex" }}>
          <Mic size={14} strokeWidth={1.8} />
        </span>
        <span>Waiting for mic</span>
      </motion.span>
    ) : state === "listening" ? (
      <motion.span key="live" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className={s.dot} />
        <span className={s.timer}>{clock(view.elapsed)}</span>
        <Bars view={view} />
        <span className={s.capsuleStop}>
          <Square size={8} fill="currentColor" strokeWidth={0} />
        </span>
      </motion.span>
    ) : (
      <motion.span key="tx" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className={s.shimmer}>Transcribing</span>
        <span className={s.capsuleStop}>
          <Square size={8} fill="currentColor" strokeWidth={0} />
        </span>
      </motion.span>
    );
  return (
    <motion.button
      layout
      transition={spring}
      type="button"
      className={`${s.capsule} ${state === "requesting" ? s.capsuleWaiting : ""}`}
      onClick={view.press}
      aria-pressed={state === "listening"}
      aria-busy={state !== "listening"}
      aria-label={
        state === "listening" ? `Stop listening, ${clock(view.elapsed)}` : state === "requesting" ? "Waiting for microphone access" : "Cancel transcription"
      }
    >
      {content}
    </motion.button>
  );
}

function OptionB({ view }: { view: View }) {
  return (
    <Shell view={view}>
      <Editor text={view.text} />
      <div className={composer.buttonGroup}>
        <Capsule view={view} />
        <Plus_ />
      </div>
    </Shell>
  );
}

/* ── C · A line under the words ─────────────────────────────────────────── */

function OptionC({ view }: { view: View }) {
  const { state } = view;
  const showLine = state === "listening" || state === "transcribing" || (state === "requesting" && view.waiting);
  const line =
    state === "requesting" ? (
      <>
        <span className={s.breathe} style={{ display: "inline-flex" }}>
          <Mic size={12} strokeWidth={1.8} />
        </span>
        <span>Waiting for microphone access</span>
      </>
    ) : state === "listening" ? (
      <>
        <span className={s.dot} />
        <span className={s.statusWord}>Listening</span>
        <span className={s.timer}>{clock(view.elapsed)}</span>
        <Bars view={view} />
      </>
    ) : (
      <span className={s.shimmer}>Transcribing…</span>
    );
  return (
    <Shell
      view={view}
      below={
        <AnimatePresence initial={false}>
          {showLine && (
            <motion.div
              key="line"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={view.still ? { duration: 0 } : { type: "spring", visualDuration: 0.28, bounce: 0 }}
              style={{ overflow: "hidden" }}
            >
              <div className={s.status}>{line}</div>
            </motion.div>
          )}
        </AnimatePresence>
      }
    >
      <Editor text={view.text} />
      <div className={composer.buttonGroup}>
        <MicButton view={view} />
        <Plus_ />
      </div>
    </Shell>
  );
}


/* ══ Round two: immersive ════════════════════════════════════════════════ */

const PRIOR = "Friday works. The places you liked last time were Lumière and the one by the river — both have tables at eight.";

function Stage({ children, height, className }: { children: ReactNode; height: number; className?: string }) {
  return (
    <div className={`${s.stage} ${className ?? ""}`} style={{ height }}>
      <p className={s.prior}>{PRIOR}</p>
      {children}
    </div>
  );
}

/** Words as they arrive. Each one fades up into place, and only once. */
function Words({ view, newest }: { view: View; newest?: boolean }) {
  const words = view.heard ? view.heard.split(" ") : [];
  return (
    <>
      {view.text && <span className={s.typed}>{view.text} </span>}
      {words.map((word, i) => (
        <motion.span
          key={i}
          className={`${s.word} ${newest && i === words.length - 1 && view.state === "listening" ? s.newest : ""}`}
          initial={view.history || view.still ? false : { opacity: 0, y: 4, filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
        >
          {i < words.length - 1 ? `${word} ` : word}
        </motion.span>
      ))}
    </>
  );
}

function Composer({ view, children, surfaceClass, surface }: { view: View; children: ReactNode; surfaceClass?: string; surface?: (el: HTMLElement | null) => void }) {
  return (
    <div className={`${composer.wrap} ${view.still ? s.still : ""}`} style={{ width: "100%" }}>
      <motion.div layout transition={{ type: "spring", visualDuration: 0.34, bounce: 0.12 }} className={composer.root} style={{ width: "100%" }}>
        <div
          ref={surface}
          className={`${composer.surface} ${surfaceClass ?? ""}`}
          style={{ flexDirection: "column", alignItems: "stretch", justifyContent: "center" }}
        >
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function IdleRow({ view }: { view: View }) {
  return (
    <div className={s.row}>
      <Editor text={view.text} />
      <div className={composer.buttonGroup}>
        <MicButton view={view} />
        <Plus_ />
      </div>
    </div>
  );
}

function Done({ view, label = "Done" }: { view: View; label?: string }) {
  return (
    <KitButton
      variant="primary"
      kitRole="dictate"
      size="s"
      loading={view.state === "transcribing"}
      onClick={view.press}
      icon={<Check size={14} strokeWidth={2.2} />}
    >
      {label}
    </KitButton>
  );
}

function Cancel({ view, label = "Cancel" }: { view: View; label?: string }) {
  return (
    <KitButton variant="ghost" kitRole="cancel-edit" size="s" onClick={view.cancel} icon={<X size={14} strokeWidth={1.8} />}>
      {label}
    </KitButton>
  );
}

/* ── D · The composer opens into a voice field ──────────────────────────── */

function OptionD({ view }: { view: View }) {
  const { setMeter } = useContext(MeterContext);
  const { state } = view;
  const open = state === "listening" || state === "transcribing" || (state === "requesting" && view.waiting);
  const live = state === "listening";
  return (
    <Stage height={250}>
      <Composer view={view}>
        {!open ? (
          <IdleRow view={view} />
        ) : (
          <div className={s.field}>
            <p className={s.fieldWords}>
              <span>
                {state === "requesting" ? (
                  <span className={s.hint}>Waiting for microphone access…</span>
                ) : !view.heard && !view.text ? (
                  <span className={s.hint}>Go ahead — it writes as you talk</span>
                ) : (
                  <Words view={view} />
                )}
              </span>
            </p>
            <div className={s.fieldWave} ref={setMeter} data-flat={!live || view.still || undefined} style={view.history && live && !view.still ? ({ "--level": 0.55 } as CSSProperties) : undefined}>
              <Bars view={live ? view : { ...view, still: true }} />
            </div>
            <div className={s.fieldControls}>
              <Cancel view={view} />
              {live && (
                <>
                  <span className={s.dot} />
                  <span className={s.timer}>{clock(view.elapsed)}</span>
                </>
              )}
              <span className={s.spacer} />
              {state !== "requesting" && <Done view={view} />}
            </div>
          </div>
        )}
      </Composer>
    </Stage>
  );
}

/* ── E · The page gives way to the voice ────────────────────────────────── */

function OptionE({ view }: { view: View }) {
  const { setMeter } = useContext(MeterContext);
  const { state } = view;
  const open = state === "listening" || state === "transcribing" || (state === "requesting" && view.waiting);
  const live = state === "listening";
  return (
    <Stage height={340}>
      {/* Out of reach while the voice has the floor: one stop, not two. */}
      <div inert={open || undefined}>
        <Composer view={view}>
          <IdleRow view={view} />
        </Composer>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            key="veil"
            className={`${s.veil} ${view.still ? s.still : ""}`}
            initial={view.history ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              ref={setMeter}
              className={`${s.orbWrap} ${state === "requesting" ? s.breathe : ""}`}
              data-waiting={state === "requesting" || undefined}
              style={view.history && live && !view.still ? ({ "--level": 0.45 } as CSSProperties) : undefined}
              initial={view.history ? false : { scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", visualDuration: 0.4, bounce: 0.3 }}
            >
              <span className={s.orb} />
            </motion.div>
            <p className={s.bigWords}>
              <span>
                {state === "requesting" ? (
                  <span className={s.hint}>Allow the microphone to start</span>
                ) : !view.heard ? (
                  <span className={s.hint}>Listening…</span>
                ) : (
                  <Words view={{ ...view, text: "" }} />
                )}
              </span>
            </p>
            <div className={s.veilControls}>
              <Cancel view={view} />
              {live && <span className={s.timer}>{clock(view.elapsed)}</span>}
              {state !== "requesting" && <Done view={view} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Stage>
  );
}

/* ── F · The words write themselves where they will be ──────────────────── */

function OptionF({ view }: { view: View }) {
  const { setMeter } = useContext(MeterContext);
  const { state } = view;
  const live = state === "listening";
  const writing = state === "listening" || state === "transcribing";
  const waitingNow = state === "requesting" && view.waiting;
  return (
    <Stage height={200}>
      <Composer view={view} surfaceClass={live ? s.glow : undefined} surface={setMeter}>
        <div className={s.row} style={view.history && live && !view.still ? ({ "--level": 0.5 } as CSSProperties) : undefined}>
          <div className={composer.editorClip}>
            <div className={composer.editorWrap}>
              <div className={composer.editor}>
                {waitingNow ? (
                  <span className={s.hint}>Waiting for microphone access…</span>
                ) : writing && (view.heard || view.text) ? (
                  <Words view={view} newest />
                ) : live ? (
                  <span className={s.hint}>Listening…</span>
                ) : view.text ? (
                  view.text
                ) : (
                  <span className={s.hint}>{PLACEHOLDER}</span>
                )}
              </div>
            </div>
          </div>
          <div className={composer.buttonGroup}>
            {live && <span className={s.inlineTimer}>{clock(view.elapsed)}</span>}
            <MicButton view={view} />
            <Plus_ />
          </div>
        </div>
      </Composer>
    </Stage>
  );
}

function ImmersiveBoard({
  Option,
  title,
  lead,
  promptMs,
  still,
  liveOnly,
}: {
  Option: Option;
  title: string;
  lead: string;
  promptMs: number;
  still: boolean;
  liveOnly?: boolean;
}) {
  const said = (n: number) => SPOKEN.slice(0, n).join(" ");
  const rows: [string, View][] = [
    ["idle", frozen("idle")],
    ["requesting — the browser's prompt is up", frozen("requesting")],
    ["listening — words arriving as they are said", frozen("listening", { heard: said(9) })],
    ["listening, into a half-typed sentence", frozen("listening", { text: HALF, heard: said(6) })],
    ["finishing — the last words", frozen("transcribing", { heard: said(13) })],
    ["listening, reduced motion", frozen("listening", { still: true, elapsed: 12, heard: said(9) })],
  ];
  return (
    <MotionConfig reducedMotion="user">
      <div className={s.board}>
        {!liveOnly && (
          <div>
            <div className={s.caption}>{title}</div>
            <p className={s.lead}>{lead}</p>
          </div>
        )}
        <div data-demo="live">
          <div className={s.caption}>live — press the microphone</div>
          <LiveStreaming Option={Option} promptMs={promptMs} still={still} />
        </div>
        {liveOnly
          ? null
          : rows.map(([label, view]) => (
              <div key={label}>
                <div className={s.caption}>{label}</div>
                <Option view={view} />
              </div>
            ))}
      </div>
    </MotionConfig>
  );
}

function LiveStreaming({ Option, promptMs, still }: { Option: Option; promptMs: number; still: boolean }) {
  const { view, meter } = useDictationSim(promptMs, still, true);
  return (
    <MeterContext.Provider value={meter}>
      <Option view={view} />
    </MeterContext.Provider>
  );
}


/* ══ Round three: out of the box ═════════════════════════════════════════
   From the research: Telegram's and WhatsApp's hold-slide-lock, Apple
   Intelligence's edge light, and the kit's own marker. Each plays a sound
   at the two moments that matter — a tick when the press lands, a rising
   pair when the microphone is actually open — and a short buzz on phones
   that have one. A recording carries no sound; press them here. */

function useEarcons(view: View) {
  const prev = useRef(view.state);
  useEffect(() => {
    const was = prev.current;
    prev.current = view.state;
    if (view.history) return;
    if (was === "idle" && view.state === "requesting") tone("tick");
    else if (was === "requesting" && view.state === "listening") tone("start");
    else if (was === "listening" && view.state === "transcribing") tone("stop");
    else if ((was === "listening" || was === "requesting") && view.state === "idle") tone("cancel");
  }, [view.state, view.history]);
}

/* ── G · Hold to talk ───────────────────────────────────────────────────── */

const CANCEL_AT = -90;
const LOCK_AT = -64;

function OptionG({ view }: { view: View }) {
  const { setMeter } = useContext(MeterContext);
  useEarcons(view);
  const { state } = view;
  const [locked, setLocked] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number; at: number } | null>(null);
  const armedStop = useRef(false);
  const [releasedEarly, setReleasedEarly] = useState(false);
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state === "idle") {
      setLocked(false);
      setDrag({ x: 0, y: 0 });
    }
    if (state === "requesting") setReleasedEarly(false);
    // The first time, the browser's prompt takes the press away from the
    // finger: nobody can hold a button through a dialog. If they let go to
    // answer it, they meant to talk — so the recording starts locked.
    if (state === "listening" && releasedEarly) setLocked(true);
  }

  // Frozen boards say which moment they are.
  const frozenLocked = view.history ? view.after === "locked" : locked;
  const frozenDrag = view.history ? (view.after === "cancel" ? { x: -104, y: 0 } : view.after === "lifting" ? { x: 0, y: -40 } : { x: 0, y: 0 }) : drag;

  const active = state !== "idle";
  const holding = active && !frozenLocked && state !== "transcribing";
  const inCancel = frozenDrag.x <= CANCEL_AT;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (state !== "idle") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY, at: performance.now() };
    view.press();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const o = origin.current;
    if (!o) return;
    const x = Math.min(0, e.clientX - o.x);
    const y = Math.min(0, e.clientY - o.y);
    if (y <= LOCK_AT && x > CANCEL_AT) {
      origin.current = null;
      setDrag({ x: 0, y: 0 });
      setLocked(true);
      return;
    }
    setDrag({ x, y });
  };
  const onPointerUp = () => {
    const o = origin.current;
    if (!o) return;
    origin.current = null;
    const quick = performance.now() - o.at < 250;
    const x = drag.x;
    setDrag({ x: 0, y: 0 });
    if (x <= CANCEL_AT) view.cancel();
    else if (quick) setLocked(true); // A tap is hands-free: the accessible way in.
    else if (state === "requesting") setReleasedEarly(true);
    else view.press();
  };

  // Motion owns the blob's transform, so the drag goes in as its x and y.
  const blobStyle = {
    x: frozenDrag.x,
    y: frozenDrag.y,
    ...(view.history && state === "listening" && !view.still ? { "--level": 0.5 } : {}),
  } as CSSProperties & { x: number; y: number };

  return (
    <Stage height={250} className={s.stageTall}>
      <Composer view={view}>
        <div className={s.row}>
          <div className={composer.editorClip}>
            <div className={composer.editorWrap}>
              <div className={composer.editor}>
                {state === "requesting" ? (
                  <span className={s.hint}>Waiting for microphone access…</span>
                ) : (state === "listening" || state === "transcribing") && (view.heard || view.text) ? (
                  <Words view={view} />
                ) : state === "listening" ? (
                  <span className={s.hint}>Listening…</span>
                ) : view.text ? (
                  view.text
                ) : (
                  <span className={s.hint}>Hold the microphone and talk</span>
                )}
              </div>
            </div>
          </div>
          <div className={composer.buttonGroup}>
            {frozenLocked && state === "listening" && (
              <>
                <KitButton variant="ghost" kitRole="cancel-edit" aria-label="Discard" onClick={view.cancel} icon={<Trash2 size={13} strokeWidth={1.8} />} />
                <span className={s.inlineTimer} style={{ margin: "0 6px" }}>{clock(view.elapsed)}</span>
              </>
            )}
            <div className={`${s.slot} ${s.holdSlot}`}>
              {/* Over the end of the line rather than in the row: in the row it
                  took the field's width, and on a phone the words stacked one
                  to a line. */}
              {holding && state === "listening" && (
                <span className={s.slideHint} style={{ opacity: Math.max(0, 1 + frozenDrag.x / 90) }}>
                  <ChevronLeft size={12} /> slide to cancel
                </span>
              )}
              {frozenLocked || state === "transcribing" ? (
                <KitButton
                  variant="ghost"
                  kitRole="dictate"
                  className={s.lockedStop}
                  loading={state === "transcribing"}
                  aria-label="Stop and keep it"
                  onPointerDown={() => {
                    armedStop.current = true;
                  }}
                  onClick={(e) => {
                    // The finger that lifted into the lock lets go over this
                    // button, which arrives here as a click. Only a press that
                    // began on it is one — or a keyboard's, which has no detail.
                    if (e.detail !== 0 && !armedStop.current) return;
                    armedStop.current = false;
                    view.press();
                  }}
                  icon={<Square size={9} fill="currentColor" strokeWidth={0} />}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <KitButton
                  variant="ghost"
                  kitRole="dictate"
                  className={active ? s.held : undefined}
                  aria-label={state === "requesting" ? "Waiting for microphone access" : state === "listening" ? "Release to keep it" : "Hold to dictate, or tap for hands-free"}
                  aria-pressed={state === "listening"}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && state === "idle") {
                      e.preventDefault();
                      setLocked(true);
                      view.press();
                    }
                  }}
                  icon={<Mic size={14} strokeWidth={1.8} />}
                  style={{ width: "100%", height: "100%" }}
                />
              )}
              <AnimatePresence>
                {holding && (
                  <motion.div
                    key="blob"
                    ref={setMeter}
                    className={s.blob}
                    data-waiting={state === "requesting" || undefined}
                    data-cancel={inCancel || undefined}
                    style={blobStyle}
                    initial={view.history ? false : { scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.3, opacity: 0 }}
                    transition={{ type: "spring", visualDuration: 0.3, bounce: 0.35 }}
                  >
                    <span className={`${s.blobInner} ${state === "requesting" ? s.breathe : ""}`}>
                      {inCancel ? <Trash2 size={20} strokeWidth={1.8} /> : <Mic size={22} strokeWidth={1.8} />}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              {holding && state === "listening" && !inCancel && (
                <div className={s.lockRail} style={{ transform: `translateY(${Math.max(frozenDrag.y, -30) / 2}px)` }}>
                  <Lock size={12} strokeWidth={1.8} />
                  <ChevronUp size={12} strokeWidth={1.8} />
                </div>
              )}
            </div>
            <Plus_ />
          </div>
        </div>
      </Composer>
    </Stage>
  );
}

/* ── H · The room goes quiet ────────────────────────────────────────────── */

function OptionH({ view }: { view: View }) {
  const { setMeter } = useContext(MeterContext);
  useEarcons(view);
  const { state } = view;
  const live = state === "listening";
  const waitingNow = state === "requesting" && view.waiting;
  const quiet = live || state === "transcribing" ? "live" : waitingNow ? "waiting" : undefined;
  return (
    <div className={view.still ? s.still : undefined} style={{ width: "100%" }}>
      <div className={s.stage} style={{ height: 300 }}>
        <div className={s.room} data-quiet={quiet}>
          <div className={s.bubble}>Any good places for Friday?</div>
          <p className={s.prior} style={{ margin: 0 }}>{PRIOR}</p>
        </div>
        <div
          ref={setMeter}
          className={s.edge}
          data-on={live || state === "transcribing" || undefined}
          data-waiting={waitingNow || undefined}
          style={view.history && live && !view.still ? ({ "--level": 0.55 } as CSSProperties) : undefined}
        />
        <div className={quiet ? s.lifted : undefined} style={{ position: "relative", zIndex: 3 }}>
          <Composer view={view}>
            <div className={s.row}>
              <div className={composer.editorClip}>
                <div className={composer.editorWrap}>
                  <div className={composer.editor}>
                    {waitingNow ? (
                      <span className={s.hint}>Waiting for microphone access…</span>
                    ) : (live || state === "transcribing") && (view.heard || view.text) ? (
                      <Words view={view} />
                    ) : live ? (
                      <span className={s.hint}>Listening…</span>
                    ) : view.text ? (
                      view.text
                    ) : (
                      <span className={s.hint}>{PLACEHOLDER}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className={composer.buttonGroup}>
                {live && <span className={s.inlineTimer}>{clock(view.elapsed)}</span>}
                <MicButton view={view} />
                <Plus_ />
              </div>
            </div>
          </Composer>
        </div>
      </div>
    </div>
  );
}

/* ── I · The caret listens ──────────────────────────────────────────────── */

const GLYPHS = "▖▗▘▝▚▞░▒";
const K = [0.5, 0.95, 0.7, 1, 0.55];

type Phase = "scramble" | "ink" | "fading" | "plain";

function Decoding({ word, phase: fixed, still, trailing }: { word: string; phase?: Phase; still: boolean; trailing: boolean }) {
  const [phase, setPhase] = useState<Phase>(fixed ?? (still ? "ink" : "scramble"));
  const [shown, setShown] = useState(fixed && fixed !== "scramble" ? word : still ? word : "");
  useEffect(() => {
    if (fixed) return;
    const timers: number[] = [];
    if (!still) {
      const steps = 6;
      for (let n = 0; n <= steps; n++) {
        timers.push(
          window.setTimeout(() => {
            const keep = Math.floor((n / steps) * word.length);
            setShown(word.slice(0, keep) + Array.from(word.slice(keep), (_, i) => GLYPHS[(i * 7 + n * 3 + word.length) % GLYPHS.length]).join(""));
            if (n === steps) setPhase("ink");
          }, n * 42)
        );
      }
    }
    timers.push(window.setTimeout(() => setPhase(still ? "plain" : "fading"), still ? 1200 : 1500));
    return () => timers.forEach(clearTimeout);
  }, [fixed, still, word]);
  const text = fixed === "scramble" ? word.slice(0, 2) + Array.from(word.slice(2), (_, i) => GLYPHS[(i * 5 + 3) % GLYPHS.length]).join("") : shown;
  const settled = fixed ? fixed !== "scramble" : phase !== "scramble";
  return (
    <>
      <span
        className={
          phase === "ink" || fixed === "ink" ? s.inked : phase === "fading" && !fixed ? s.inkFaded : undefined
        }
      >
        {settled ? text : Array.from(text, (ch, i) => (
          <span key={i} className={i >= text.length - Array.from(text).filter((c) => GLYPHS.includes(c)).length ? s.glyph : undefined}>
            {ch}
          </span>
        ))}
      </span>
      {trailing ? " " : ""}
    </>
  );
}

function CaretWave({ view }: { view: View }) {
  const { setMeter } = useContext(MeterContext);
  return (
    <span
      ref={setMeter}
      className={s.caretWave}
      aria-hidden
      style={view.history && !view.still ? ({ "--level": 0.6 } as CSSProperties) : view.still ? ({ "--level": 0.45 } as CSSProperties) : undefined}
    >
      {K.map((k, i) => (
        <span key={i} style={{ "--k": k } as CSSProperties} />
      ))}
    </span>
  );
}

function OptionI({ view }: { view: View }) {
  useEarcons(view);
  const { state } = view;
  const live = state === "listening";
  const writing = live || state === "transcribing";
  const waitingNow = state === "requesting" && view.waiting;
  const words = view.heard ? view.heard.split(" ") : [];
  const lead = view.text ? `${view.text} ` : "";
  return (
    <Stage height={200}>
      <Composer view={view}>
        <div className={s.row}>
          <div className={composer.editorClip}>
            <div className={composer.editorWrap}>
              <div className={composer.editor}>
                {writing || waitingNow ? (
                  <>
                    {lead && <span>{lead}</span>}
                    {words.map((w, i) => (
                      <Decoding
                        key={i}
                        word={w}
                        still={view.still}
                        trailing={i < words.length - 1}
                        phase={
                          view.history
                            ? i === words.length - 1 && live && !view.still
                              ? "scramble"
                              : i >= words.length - (view.still ? 1 : 3)
                                ? "ink"
                                : "plain"
                            : undefined
                        }
                      />
                    ))}
                    {waitingNow ? (
                      <>
                        <span className={s.caretWaiting} />
                        <span className={s.hint}>waiting for microphone access</span>
                      </>
                    ) : live ? (
                      <>
                        {words.length > 0 ? " " : ""}
                        <CaretWave view={view} />
                        {!words.length && !view.text && !view.after && <span className={s.hint}> talk — it writes here</span>}
                      </>
                    ) : null}
                    {view.after && <span> {view.after}</span>}
                  </>
                ) : view.text ? (
                  view.text
                ) : (
                  <span className={s.hint}>{PLACEHOLDER}</span>
                )}
              </div>
            </div>
          </div>
          <div className={composer.buttonGroup}>
            {live && <span className={s.inlineTimer}>{clock(view.elapsed)}</span>}
            <MicButton view={view} />
            <Plus_ />
          </div>
        </div>
      </Composer>
    </Stage>
  );
}

function OutOfTheBoxBoard({
  Option,
  title,
  lead,
  promptMs,
  still,
  liveOnly,
  rows,
}: {
  Option: Option;
  title: string;
  lead: string;
  promptMs: number;
  still: boolean;
  liveOnly?: boolean;
  rows: [string, View][];
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className={s.board}>
        {!liveOnly && (
          <div>
            <div className={s.caption}>{title}</div>
            <p className={s.lead}>{lead}</p>
          </div>
        )}
        <div data-demo="live">
          <div className={s.caption}>live — {Option === OptionG ? "hold the microphone (or tap it)" : "press the microphone"} · sound on</div>
          <LiveStreaming Option={Option} promptMs={promptMs} still={still} />
        </div>
        {liveOnly
          ? null
          : rows.map(([label, view]) => (
              <div key={label}>
                <div className={s.caption}>{label}</div>
                <Option view={view} />
              </div>
            ))}
      </div>
    </MotionConfig>
  );
}

const said = (n: number) => SPOKEN.slice(0, n).join(" ");

/* ── Stories ────────────────────────────────────────────────────────────── */

type Option = (props: { view: View }) => ReactNode;

function Live({ Option, promptMs, still }: { Option: Option; promptMs: number; still: boolean }) {
  const { view, meter } = useDictationSim(promptMs, still);
  return (
    <MeterContext.Provider value={meter}>
      <Option view={view} />
    </MeterContext.Provider>
  );
}

const HALF = "Remind me to call Ana and";

function Board({
  Option,
  title,
  lead,
  promptMs,
  still,
  liveOnly,
}: {
  Option: Option;
  title: string;
  lead: string;
  promptMs: number;
  still: boolean;
  liveOnly?: boolean;
}) {
  const rows: [string, View][] = [
    ["idle", frozen("idle")],
    ["requesting — the press, before 120ms", frozen("requesting", { waiting: false })],
    ["requesting — the browser's prompt is up", frozen("requesting")],
    ["listening", frozen("listening")],
    ["listening, into a half-typed sentence", frozen("listening", { text: HALF })],
    ["transcribing, words arriving", frozen("transcribing", { text: `${HALF} book a table` })],
    ["listening, reduced motion", frozen("listening", { still: true, elapsed: 12 })],
  ];
  return (
    <MotionConfig reducedMotion="user">
      <div className={s.board}>
        {!liveOnly && (
          <div>
            <div className={s.caption}>{title}</div>
            <p className={s.lead}>{lead}</p>
          </div>
        )}
        <div data-demo="live">
          <div className={s.caption}>live — press the microphone</div>
          <Live Option={Option} promptMs={promptMs} still={still} />
        </div>
        {liveOnly ? null : rows.map(([label, view]) => (
          <div key={label}>
            <div className={s.caption}>{label}</div>
            <Option view={view} />
          </div>
        ))}
      </div>
    </MotionConfig>
  );
}

interface Args {
  permission: "prompt" | "granted";
  reducedMotion: boolean;
  /** Just the composer you can press, for recording it. */
  liveOnly: boolean;
}

type Story = StoryObj<Args>;

const argTypes = {
  permission: { control: "inline-radio", options: ["prompt", "granted"] },
  reducedMotion: { control: "boolean" },
  liveOnly: { control: "boolean" },
} as const;

const args: Args = { permission: "prompt", reducedMotion: false, liveOnly: false };
const promptFor = (a: Args) => (a.permission === "prompt" ? 1800 : 60);

export const A_Surface: Story = {
  name: "A · The composer becomes the recorder",
  args,
  argTypes,
  render: (a) => (
    <Board
      Option={OptionA}
      title="A · the composer becomes the recorder"
      lead="The placeholder gives way to a live count and the level of what it hears, on a surface washed in the marker. Loudest of the three. The cost: what was already typed is out of sight while it records."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
    />
  ),
};

export const B_Capsule: Story = {
  name: "B · The microphone grows into a recorder",
  args,
  argTypes,
  render: (a) => (
    <Board
      Option={OptionB}
      title="B · the microphone grows into a recorder"
      lead="The button itself becomes a capsule — count, level, stop — and the whole capsule is the stop. The words stay where they are. The cost: it takes width from the line being typed, which a phone feels."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
    />
  ),
};

export const C_Line: Story = {
  name: "C · A line under the words",
  args,
  argTypes,
  render: (a) => (
    <Board
      Option={OptionC}
      title="C · a line under the words"
      lead="A second line opens inside the composer and says, in words, what is happening: waiting on the browser, listening and for how long, transcribing. Nothing typed moves. The cost: the composer grows a line, and it is the quietest of the three."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
    />
  ),
};

export const D_Field: Story = {
  name: "D · The composer opens into a voice field",
  args,
  argTypes,
  render: (a) => (
    <ImmersiveBoard
      Option={OptionD}
      title="D · the composer opens into a voice field"
      lead="Pressing the microphone opens the composer upward into a field: the words as they are said, a wide level with the marker swelling behind it, and Cancel and Done. What was typed stays at the head of it. It is still the composer — the conversation stays in view."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
    />
  ),
};

export const E_Orb: Story = {
  name: "E · The page gives way to the voice",
  args,
  argTypes,
  render: (a) => (
    <ImmersiveBoard
      Option={OptionE}
      title="E · the page gives way to the voice"
      lead="The chat frosts over and an orb in the marker breathes with the voice, the words large beneath it. The most immersive by a distance, and the one that reads as a mode: you are talking now, not typing. Waiting for the browser is the same orb, hollow."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
    />
  ),
};

export const F_InPlace: Story = {
  name: "F · The words write themselves",
  args,
  argTypes,
  render: (a) => (
    <ImmersiveBoard
      Option={OptionF}
      title="F · the words write themselves where they will be"
      lead="Nothing opens. The composer's edge glows in the marker with the voice and the words land in the field as they are said, the newest one highlighted. Immersive by speed rather than by size: what you see is already the message."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
    />
  ),
};

export const G_Hold: Story = {
  name: "G · Hold to talk",
  args,
  argTypes,
  render: (a) => (
    <OutOfTheBoxBoard
      Option={OptionG}
      title="G · hold to talk — the press is the recording"
      lead="Telegram's gesture, made of the marker. Press and a blob swells out from under the finger and breathes with the voice; let go and the words are kept. Slide left onto the field to throw it away, up to lock it hands-free. A tap is hands-free from the start — the way in for a keyboard and a screen reader. The first time, the browser's prompt takes the press away, so letting go to answer it starts the recording locked."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
      rows={[
        ["idle", frozen("idle")],
        ["pressed — waiting for the browser", frozen("requesting")],
        ["held — listening", frozen("listening", { heard: said(6) })],
        ["held — lifting toward the lock", frozen("listening", { heard: said(6), after: "lifting" })],
        ["held — slid onto the field: let go to discard", frozen("listening", { heard: said(6), after: "cancel" })],
        ["locked — hands-free", frozen("listening", { heard: said(9), after: "locked" })],
        ["held, reduced motion", frozen("listening", { heard: said(6), still: true })],
      ]}
    />
  ),
};

export const H_Room: Story = {
  name: "H · The room goes quiet",
  args,
  argTypes,
  render: (a) => (
    <OutOfTheBoxBoard
      Option={OptionH}
      title="H · the room goes quiet"
      lead="Apple Intelligence's edge light, brought to the conversation. Pressing pushes everything else back — smaller, softer, out of focus — and lifts the composer forward as the one lit thing. The edge of the conversation turns into a ring of marker that swells with the voice. Waiting for the browser is the same move half made, in grey."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
      rows={[
        ["idle", frozen("idle")],
        ["waiting for the browser — half receded, grey ring", frozen("requesting")],
        ["listening", frozen("listening", { heard: said(9) })],
        ["listening, into a half-typed sentence", frozen("listening", { text: HALF, heard: said(5) })],
        ["listening, reduced motion — no blur, no travel", frozen("listening", { heard: said(9), still: true })],
      ]}
    />
  ),
};

export const I_Caret: Story = {
  name: "I · The caret listens",
  args,
  argTypes,
  render: (a) => (
    <OutOfTheBoxBoard
      Option={OptionI}
      title="I · the caret listens"
      lead="No panel, no orb: the caret itself becomes the microphone — five bars standing where the next word will land, moving with the voice. Each word comes out of it as noise, resolves into letters, and is swept with the marker for a moment before it settles. Dictating into the middle of a sentence happens in the middle of the sentence."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
      rows={[
        ["idle", frozen("idle")],
        ["waiting for the browser — a grey caret, breathing", frozen("requesting")],
        ["listening — a word resolving out of the caret", frozen("listening", { heard: said(7) })],
        ["into the middle of a sentence", frozen("listening", { text: "Remind me to call Ana", heard: "on friday", after: "about the deposit" })],
        ["listening, reduced motion — words land already settled", frozen("listening", { heard: said(7), still: true })],
      ]}
    />
  ),
};
