import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnimatePresence, MotionConfig, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Mic, Plus, Square } from "lucide-react";
import { KitButton } from "../Button/KitButton";
import { MorphGlyph } from "../ChatInput/MorphGlyph";
import composer from "../ChatInput/ChatInput.module.css";
import s from "./voiceOptions.module.css";

/**
 * I4 — pressing the microphone has to feel like something started.
 *
 * The two answers that stay in the composer, drawn in the composer's own
 * classes and driven by a stand-in for `useVoiceInput`: no microphone is
 * asked for, the level is a synthetic voice, and the permission prompt is a
 * pause. Each has a live composer to press and a board of its states frozen
 * side by side. The immersive answers — sand, plane and ripple — are in
 * Cymatics.
 *
 * What both share:
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
  /** Frozen boards draw a level rather than have one written. */
  history?: number[];
  press: () => void;
}

const BARS = 64;
const WORDS = "book a table for two on friday at eight".split(" ");
const PLACEHOLDER = "Ask me anything";
const HALF = "Remind me to call Ana and";

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
}
const MeterContext = createContext<Meter>({});

function useDictationSim(promptMs: number, forceStill: boolean): { view: View; meter: Meter } {
  const reduced = useReducedMotion() ?? false;
  const still = forceStill || reduced;
  const [state, setState] = useState<SimState>("idle");
  const [waiting, setWaiting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const barsEl = useRef<HTMLElement | null>(null);
  // A callback rather than a ref object: a view carrying refs reads, to the
  // compiler, as refs read during render everywhere it is passed.
  const barsRef = useCallback((el: HTMLElement | null) => {
    barsEl.current = el;
  }, []);
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
    const tick = (now: number) => {
      setElapsed(Math.floor((now - started) / 1000));
      if (!still && now - pushed > 55) {
        pushed = now;
        history.shift();
        history.push(speech((now - started) / 1000, Math.random() * 0.04));
        const el = barsEl.current;
        if (el) {
          // The newest at the right, however many bars there are room for.
          const shown = el.children.length;
          for (let i = 0; i < shown; i++) {
            (el.children[i] as HTMLElement).style.setProperty("--v", history[BARS - shown + i].toFixed(3));
          }
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state, still]);

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

  return { view: { state, waiting, elapsed, text, still, press }, meter: { setBars: barsRef } };
}

const frozen = (state: SimState, extra: Partial<View> = {}): View => ({
  state,
  waiting: state === "requesting",
  elapsed: 4,
  text: "",
  still: false,
  history: FROZEN,
  press: () => {},
  ...extra,
});

/* ── Pieces ─────────────────────────────────────────────────────────────── */

/**
 * The level, newest on the right. `count` is how many fit: drawing all 64
 * into the recorder's 46px and clipping the rest left 52 bars cut off for
 * visual QA to find, and nobody to see.
 */
function Bars({ view, className, count = BARS }: { view: View; className?: string; count?: number }) {
  const { setBars } = useContext(MeterContext);
  return (
    <span ref={view.history ? undefined : setBars} className={[s.bars, className].filter(Boolean).join(" ")} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} style={{ "--v": view.still ? 0 : (view.history?.[BARS - count + i] ?? 0) } as CSSProperties} />
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

function Shell({ view, children }: { view: View; children: ReactNode }) {
  return (
    <div className={`${composer.wrap} ${view.still ? s.still : ""}`} style={{ width: "100%" }}>
      <div className={composer.root} style={{ width: "100%" }}>
        <div className={composer.surface} style={{ flexDirection: "column", alignItems: "stretch", justifyContent: "center" }}>
          <div className={s.row}>{children}</div>
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

const labelFor = (view: View) =>
  view.state === "listening"
    ? `Stop listening, ${clock(view.elapsed)}`
    : view.state === "requesting"
      ? "Waiting for microphone access"
      : view.state === "transcribing"
        ? "Cancel transcription"
        : "Dictate a message";

/** The microphone as it is today, plus the held state both options share. */
function MicButton({ view }: { view: View }) {
  const { state } = view;
  return (
    <div className={s.slot}>
      <KitButton
        variant="ghost"
        kitRole="dictate"
        className={state !== "idle" ? s.held : undefined}
        onClick={view.press}
        aria-pressed={state === "listening"}
        aria-busy={state === "requesting" || state === "transcribing"}
        aria-label={labelFor(view)}
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

/* ── Timing shared by A and B ──────────────────────────────────────────── */

/** B's width. */
const GROW = { type: "spring" as const, visualDuration: 0.34, bounce: 0.1 };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
/** In turn, never both: what was there goes first, then what comes in. Two at once read as a smear. */
const LEAVE = { duration: 0.1, ease: EASE_OUT };
const ENTER = { duration: 0.16, delay: 0.09, ease: EASE_OUT };
const INSTANT = { duration: 0 };

/* ── A · The composer becomes the recorder ──────────────────────────────── */

/** As many bars as the line has room for, recounted when it changes width. */
function FitBars({ view }: { view: View }) {
  const [count, setCount] = useState(0);
  const watch = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const fit = () => setCount(Math.max(0, Math.min(BARS, Math.floor((el.clientWidth + 2) / 4))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <span ref={watch} className={s.fit}>
      {count > 0 && <Bars view={view} count={count} />}
    </span>
  );
}

type SurfacePhase = "edit" | "wait" | "live" | "busy";

function OptionA({ view }: { view: View }) {
  const { state, still } = view;
  const phase: SurfacePhase =
    state === "requesting" && view.waiting
      ? "wait"
      : state === "listening"
        ? "live"
        : state === "transcribing" && !view.text
          ? "busy"
          : "edit";
  const blur = still ? undefined : "blur(3px)";
  return (
    <Shell view={view}>
      <div className={composer.editorClip}>
        {/* In turn, as in B: the editor goes, then the recorder comes. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={phase}
            className={s.surfaceBody}
            initial={{ opacity: 0, filter: blur }}
            animate={{ opacity: 1, filter: still ? undefined : "blur(0px)", transition: still ? INSTANT : { ...ENTER, delay: 0 } }}
            exit={{ opacity: 0, filter: blur, transition: still ? INSTANT : LEAVE }}
          >
            {phase === "wait" ? (
              <div className={s.takeover}>
                <span>Waiting for the mic…</span>
              </div>
            ) : phase === "live" ? (
              <div className={s.takeover}>
                <span className={s.dot} />
                <span className={s.timer}>{clock(view.elapsed)}</span>
                <FitBars view={view} />
              </div>
            ) : phase === "busy" ? (
              <div className={s.takeover}>
                <span className={s.shimmer}>Transcribing…</span>
              </div>
            ) : (
              <Editor text={view.text} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={composer.buttonGroup}>
        <MicButton view={view} />
        <Plus_ />
      </div>
    </Shell>
  );
}

/* ── B · The microphone grows into a recorder ───────────────────────────── */

/**
 * One button from the press to the last word, so nothing pops: the first
 * version swapped the microphone for a separate capsule, which appeared at its
 * full width in a single frame and dropped focus on the way. Now the same
 * element widens on one spring, its contents change under a short blur, and
 * the field beside it gives way as it grows.
 *
 * It unrolls to the left: the stop sits where the microphone was, so the
 * thing to press next is under the finger that pressed.
 */

type RecorderPhase = "mic" | "wait" | "live" | "busy";

function Recorder({ view }: { view: View }) {
  const { state, still } = view;
  const phase: RecorderPhase =
    state === "listening" ? "live" : state === "transcribing" ? "busy" : state === "requesting" && view.waiting ? "wait" : "mic";
  const button = useRef<HTMLButtonElement>(null);
  const width = useMotionValue(0);
  const placed = useRef(false);

  // The width of what is about to show, measured after it is in the page and
  // before it is painted. The leaving contents are lifted out of the flow, so
  // they do not count.
  useLayoutEffect(() => {
    const next = button.current?.querySelector<HTMLElement>(`[data-content="${phase}"]`);
    if (!next) return;
    const target = next.offsetWidth;
    if (!placed.current || still) {
      placed.current = true;
      width.set(target);
      return;
    }
    const run = animate(width, target, GROW);
    return () => run.stop();
  }, [phase, still, width]);

  const blur = still ? undefined : "blur(3px)";
  return (
    <motion.button
      ref={button}
      type="button"
      className={s.recorder}
      data-held={state !== "idle" || undefined}
      data-phase={phase}
      onClick={view.press}
      aria-pressed={state === "listening"}
      aria-busy={state === "requesting" || state === "transcribing"}
      aria-label={labelFor(view)}
      style={{ width }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={phase}
          data-content={phase}
          className={s.recorderContent}
          initial={{ opacity: 0, filter: blur }}
          animate={{ opacity: 1, filter: still ? undefined : "blur(0px)", transition: still ? INSTANT : ENTER }}
          exit={{ opacity: 0, filter: blur, transition: still ? INSTANT : LEAVE }}
        >
          {phase === "mic" ? (
            <span className={state === "requesting" ? s.breathe : undefined} style={{ display: "inline-flex" }}>
              <MorphGlyph mode="mic" size={14} />
            </span>
          ) : phase === "wait" ? (
            <>
              <span className={s.breathe} style={{ display: "inline-flex" }}>
                <Mic size={14} strokeWidth={1.8} />
              </span>
              <span>Waiting…</span>
            </>
          ) : phase === "live" ? (
            <>
              <span className={s.dot} />
              <span className={s.timer}>{clock(view.elapsed)}</span>
              <Bars view={view} count={12} />
              <span className={s.recorderStop}>
                <Square size={8} fill="currentColor" strokeWidth={0} />
              </span>
            </>
          ) : (
            <span className={s.spinner} />
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

function OptionB({ view }: { view: View }) {
  return (
    <Shell view={view}>
      <Editor text={view.text} />
      <div className={composer.buttonGroup}>
        <Recorder view={view} />
        <Plus_ />
      </div>
    </Shell>
  );
}

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
      lead="The placeholder gives way to a live count and the level of what it hears, on the composer's own grey. Loudest of the two. The cost: what was already typed is out of sight while it records."
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
      lead="The button itself unrolls to the left into a recorder — count, level, stop — and the whole of it is the stop. The words stay where they are, and the field gives way as it grows. While the words come back it is a spinner the size of the microphone again."
      promptMs={promptFor(a)}
      still={a.reducedMotion}
      liveOnly={a.liveOnly}
    />
  ),
};
