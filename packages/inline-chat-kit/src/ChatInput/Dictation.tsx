"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Mic, Square } from "lucide-react";
import { MorphGlyph } from "./MorphGlyph";
import styles from "./Dictation.module.css";

/**
 * What the composer looks like while it is listening.
 *
 * Two answers, both inside the composer. `recorder` — the default — is the
 * microphone unrolling to the left into a recorder: a count, the level, a
 * stop where the microphone was. What was typed stays in view, and the words
 * land at the caret. `surface` is the field itself becoming the recorder: the
 * count and the level across the whole line, louder, at the cost of what was
 * typed being out of sight until it is done. `field` is the composer
 * narrowing to a pill — the count, Cancel and Done — while something above it
 * draws the voice: what `ChatExperience` uses for `sand`, `plane` and
 * `ripple`, and hands over to `onDictation` for anyone else.
 *
 * Both change what they show **in turn**: what was there leaves under a short
 * blur, then what comes in arrives. Two at once read as a smear.
 */
export type ComposerDictation = "recorder" | "surface" | "field";

/**
 * What a dictation in `field` is doing, for whatever draws the field above
 * the composer — `ChatExperience`, for `sand`, `plane` and `ripple`. Handed
 * over every time it changes; `null` once it is over.
 */
export interface DictationSnapshot {
  state: "requesting" | "listening" | "transcribing";
  /** The words so far, from `onTranscribeLive`. Empty with only `onTranscribe`. */
  transcript: string;
  /** Seconds since it started listening. */
  elapsed: number;
  /** The level, 0 to 1. Read it in a frame loop. */
  getLevel: () => number;
  /** The microphone's analyser, for the voice's pitch. */
  getAnalyser: () => AnalyserNode | null;
}

/** How a dictation ended: kept, or thrown away. */
export type DictationEnd = "done" | "cancel";

/** Which of its faces the recorder is showing. */
export type DictationPhase = "mic" | "wait" | "live" | "busy";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const LEAVE = { duration: 0.1, ease: EASE_OUT };
const ENTER = { duration: 0.16, delay: 0.09, ease: EASE_OUT };
const INSTANT = { duration: 0 };
/** The recorder's width, on one spring that does not overshoot a control. */
export const RECORDER_GROW = { type: "spring" as const, visualDuration: 0.34, bounce: 0.1 };

/** The level's history: one bar per 55ms, so a breath is a gap you can see. */
const HISTORY = 64;
const STEP_MS = 55;

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * The level as it was over the last few seconds, newest on the right.
 *
 * Written straight onto the bars once every 55ms and never through React —
 * the same reason `useVoiceInput` writes `--ick-voice-level` rather than
 * returning it. `count` is how many there is room for: drawing more and
 * clipping them left bars cut off that nobody would see. With `fit`, the
 * count follows the width of the line it stands in.
 */
function LevelBars({ getLevel, count, fit, still }: { getLevel: () => number; count?: number; fit?: boolean; still: boolean }) {
  const barsRef = useRef<HTMLSpanElement | null>(null);
  const [fitted, setFitted] = useState(0);
  const shown = fit ? fitted : (count ?? 12);
  const measure = useCallback(
    (el: HTMLSpanElement | null) => {
      if (!el || !fit) return;
      const update = () => setFitted(Math.max(0, Math.min(HISTORY, Math.floor((el.clientWidth + 2) / 4))));
      update();
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    },
    [fit]
  );

  useEffect(() => {
    if (still) return;
    const history = new Array<number>(HISTORY).fill(0);
    let frame = 0;
    let pushed = 0;
    const tick = (now: number) => {
      if (now - pushed >= STEP_MS) {
        pushed = now;
        history.shift();
        // Speech sits low on the meter — a tenth to a half — so it is drawn on
        // a square root: a quiet voice still stands up, a loud one does not
        // flatten against the top.
        history.push(Math.min(1, Math.sqrt(getLevel()) * 1.1));
        const el = barsRef.current;
        if (el) {
          const n = el.children.length;
          for (let i = 0; i < n; i++) (el.children[i] as HTMLElement).style.setProperty("--v", history[HISTORY - n + i].toFixed(3));
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [getLevel, still]);

  return (
    <span ref={measure} className={fit ? styles.fit : undefined}>
      <span ref={barsRef} className={styles.bars} aria-hidden>
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} />
        ))}
      </span>
    </span>
  );
}

/** The seconds since listening began, ticking only while it does. */
export function useElapsed(listening: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!listening) return;
    const started = performance.now();
    const id = window.setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 250);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
  }, [listening]);
  return elapsed;
}

/**
 * The browser's prompt, but only once it has been up long enough to say so:
 * a reader who granted access last week should not see "Waiting" flash.
 */
export function useWaited(requesting: boolean, ms = 120) {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!requesting) return;
    const id = window.setTimeout(() => setWaited(true), ms);
    return () => {
      clearTimeout(id);
      setWaited(false);
    };
  }, [requesting, ms]);
  return requesting && waited;
}

const swap = (still: boolean) => ({
  initial: { opacity: 0, filter: still ? undefined : "blur(3px)" },
  animate: { opacity: 1, filter: still ? undefined : "blur(0px)", transition: still ? INSTANT : ENTER },
  exit: { opacity: 0, filter: still ? undefined : "blur(3px)", transition: still ? INSTANT : LEAVE },
});

interface FaceProps {
  phase: DictationPhase;
  elapsed: number;
  getLevel: () => number;
  waitingText: string;
}

/**
 * `recorder`: what the microphone button holds. It is the same button from
 * the press to the last word, so focus stays where it was and nothing pops;
 * `ChatInput` springs its width to what the face about to show measures, and
 * the face reports that width as it arrives.
 */
export function RecorderFace({ phase, elapsed, getLevel, onWidth }: Omit<FaceProps, "waitingText"> & { onWidth: (width: number) => void }) {
  const still = useReducedMotion() ?? false;
  const current = useRef(phase);
  useLayoutEffect(() => {
    current.current = phase;
  });
  // The width of the face about to show, measured once it is in the page.
  // The one leaving is lifted out of the flow, so it does not count.
  const watch = useCallback(
    (el: HTMLSpanElement | null) => {
      if (!el) return;
      if (el.dataset.face === phase) onWidth(el.offsetWidth);
      const ro = new ResizeObserver(() => {
        if (el.dataset.face === current.current) onWidth(el.offsetWidth);
      });
      ro.observe(el);
      return () => ro.disconnect();
    },
    [onWidth, phase]
  );
  const s = swap(still);
  return (
    <span className={styles.recorder} data-face={phase}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={phase} ref={watch} data-face={phase} className={styles.face} {...s}>
          {phase === "mic" ? (
            <MorphGlyph mode="mic" size={14} />
          ) : phase === "wait" ? (
            /* The held microphone, breathing, and no wider. Saying it in
               words took a line's width on a phone, at 16px, and pushed a
               placeholder onto a second line — while the browser's own
               prompt was saying the same thing on top of it. The button's
               name says it for a screen reader. */
            <span className={styles.breathe}>
              <Mic size={14} strokeWidth={1.8} />
            </span>
          ) : phase === "live" ? (
            <>
              <span className={styles.dot} />
              <span className={styles.timer}>{clock(elapsed)}</span>
              <LevelBars getLevel={getLevel} count={12} still={still} />
              <span className={styles.stop}>
                <Square size={8} fill="currentColor" strokeWidth={0} />
              </span>
            </>
          ) : (
            <span className={styles.spinner} />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * `surface`: laid over the field while it listens. The field stays where it
 * is underneath — a contenteditable that unmounted would lose what was typed
 * and where the caret was — and comes back when this goes.
 */
export function SurfaceFace({ phase, elapsed, getLevel, waitingText, transcribingText }: FaceProps & { transcribingText: string }) {
  const still = useReducedMotion() ?? false;
  const s = swap(still);
  return (
    <AnimatePresence mode="wait" initial={false}>
      {phase !== "mic" && (
        <motion.div key={phase} className={styles.surface} {...s}>
          {phase === "wait" ? (
            <span>{waitingText}</span>
          ) : phase === "live" ? (
            <>
              <span className={styles.dot} />
              <span className={styles.timer}>{clock(elapsed)}</span>
              <LevelBars getLevel={getLevel} fit still={still} />
            </>
          ) : (
            <span className={styles.shimmer}>{transcribingText}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
