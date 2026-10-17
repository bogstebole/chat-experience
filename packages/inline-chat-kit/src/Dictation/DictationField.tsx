"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { DictationEnd, DictationSnapshot } from "../ChatInput/Dictation";
import { useLabels } from "../labels/labels";
import styles from "./DictationField.module.css";

/**
 * The voice, drawn above its own words: `sand`, `plane` or `ripple`.
 *
 * When the microphone is pressed the conversation steps back, the composer
 * narrows to a pill — the count, Cancel and Done — and above it a figure
 * opens: grains of sand gathering on the lines of a vibrating plate, or water
 * standing in the same figures. The voice's tone, followed over seconds
 * rather than syllables, picks the figure: low and steady is simple, a
 * question climbing is intricate. Its level is how hard the plate is driven.
 * The words come up between the figure and the composer as they are said,
 * the newest one marked; when it is done they leave, and then they arrive in
 * the composer — in turn, never both at once.
 *
 * The figure is WebGL, loaded the first time it is needed. Where there is no
 * WebGL, `ChatExperience` draws the recorder instead.
 */
export type FieldLook = "sand" | "plane" | "ripple";

type Engine = import("./field").Field;
type FieldModule = typeof import("./field");

let loading: Promise<FieldModule> | null = null;
const load = () => (loading ??= import("./field"));

let webgl: boolean | null = null;
/** Whether a figure can be drawn here at all. Asked once. */
export const fieldSupported = () => {
  if (webgl != null) return webgl;
  try {
    webgl = typeof document !== "undefined" && !!document.createElement("canvas").getContext("webgl");
  } catch {
    webgl = false;
  }
  return webgl;
};

/** The same spring as the composer narrowing, so the two settle together. */
const SPRING = { type: "spring", stiffness: 320, damping: 32, mass: 1 } as const;
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export interface DictationFieldProps {
  look: FieldLook;
  /** What the composer's dictation is doing; `null` when it is not. */
  snapshot: DictationSnapshot | null;
  /** How the last one ended: kept words go down toward the composer, discarded ones up. */
  ended: DictationEnd;
}

export function DictationField({ look, snapshot, ended }: DictationFieldProps) {
  const text = useLabels("input");
  const still = useReducedMotion() ?? false;
  const open = snapshot != null;
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const mod = useRef<FieldModule | null>(null);
  const [wordsBottom, setWordsBottom] = useState(96);
  const snap = useRef(snapshot);
  useLayoutEffect(() => {
    snap.current = snapshot;
  });

  /**
   * How far the figure has opened, on Motion's clock rather than the loop's:
   * the composer narrowing is a Motion animation that starts after React
   * commits, and a figure on its own clock ran two frames ahead of it.
   */
  const openness = useMotionValue(0);
  useEffect(() => {
    const run = animate(openness, open ? 1 : 0, still ? { duration: 0 } : SPRING);
    return () => run.stop();
  }, [open, still, openness]);

  /**
   * Where the figure stands — whole, above the words, above the composer —
   * and the microphone it opens out of. Measured from the composer itself,
   * which marks itself while it dictates.
   */
  const place = useCallback(() => {
    const root = rootRef.current;
    const e = engine.current;
    if (!root) return;
    const box = root.getBoundingClientRect();
    const composer = root.parentElement?.querySelector<HTMLElement>("[data-ick-dictating]");
    if (!composer) return;
    const at = composer.getBoundingClientRect();
    const top = at.top - box.top;
    setWordsBottom(box.bottom - at.top + 22);
    if (!e || !mod.current) return;
    // A fifth of the width, and never more than 150: at 40% the sand ran under
    // the words and the composer on a phone.
    const radius = Math.min(box.width * 0.21, (box.height - 160) * 0.21, 150);
    e.radius = radius * mod.current.REACH[look];
    // Room for three lines of words at the composer's own size, which is 12px
    // on a desktop and 16px on a phone.
    const type = parseFloat(getComputedStyle(composer).fontSize) || 14;
    const words = 22 + 3 * 1.6 * type + 10;
    e.center = { x: box.width / 2, y: top - words - radius * 1.15 - 12 };
    const mic = composer.querySelector<HTMLElement>('[data-ick-role="cancel-edit"]')?.getBoundingClientRect();
    e.mic = mic ? { x: mic.left - box.left + mic.width / 2, y: mic.top - box.top + mic.height / 2 } : { ...e.center };
  }, [look]);

  // The engine, once: loaded ahead, in an idle moment, so the first press
  // does not wait on a download.
  useEffect(() => {
    let cancelled = false;
    const idle = (window as unknown as { requestIdleCallback?: (fn: () => void) => number }).requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 200));
    idle(() => {
      void load().then((m) => {
        const canvas = canvasRef.current;
        if (cancelled || !canvas || engine.current) return;
        mod.current = m;
        try {
          engine.current = m.createField(canvas, look);
        } catch {
          engine.current = null;
        }
        place();
      });
    });
    const onResize = () => place();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [look, place]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // One loop, alive while the figure is open or closing.
  useEffect(() => {
    const epoch = performance.now();
    const drive = { level: 0, live: 0, open: 0 };
    let tracker: InstanceType<FieldModule["ToneTracker"]> | null = null;
    let shownBand = -1;
    let variant = 0;
    let pitchAt = 0;
    let lastFigureAt = 0;
    let wasOpen = false;
    let dirty = true;
    let buffer: Float32Array<ArrayBuffer> | null = null;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const m = mod.current;
      const e = engine.current;
      if (!m || !e) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = snap.current;
      const listening = s?.state === "listening";
      // Every dictation learns its speaker afresh, and starts in the middle.
      if (s && !wasOpen) {
        wasOpen = true;
        place();
        tracker = new m.ToneTracker();
        pitchAt = 0;
        shownBand = tracker.band;
        lastFigureAt = now;
        const first = m.modeForOrder(tracker.band / (m.BANDS - 1));
        if (still) e.setModeNow(first);
        else e.setMode(first);
      } else if (!s) {
        wasOpen = false;
      }
      const before = { ...drive };
      if (still) {
        drive.open = s ? 1 : 0;
        drive.live = listening ? 1 : 0;
        drive.level = listening ? 0.6 : 0;
      } else {
        drive.open = Math.min(1.02, Math.max(0, openness.get()));
        drive.live += ((listening ? 1 : 0) - drive.live) * (1 - Math.exp(-dt * 5));
        let level = 0;
        const analyser = listening ? s.getAnalyser() : null;
        if (analyser && tracker) {
          if (!buffer || buffer.length !== analyser.fftSize) buffer = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          for (const v of buffer) sum += v * v;
          level = Math.min(1, Math.sqrt(sum / buffer.length) * 5);
          // Pitch twenty times a second is plenty for something followed over
          // a second, and a third of the cost.
          if (now - pitchAt > 50) {
            const since = pitchAt ? (now - pitchAt) / 1000 : 0.05;
            pitchAt = now;
            tracker.push(m.detectPitch(buffer, analyser.context.sampleRate), since);
          }
        }
        // Followed over most of a second, not per syllable: the voice swells
        // the figure, it does not make it flicker.
        drive.level += (level - drive.level) * (1 - Math.exp(-dt / 0.8));
      }
      if (listening && tracker) {
        const band = tracker.band;
        // A voice that holds one pitch — or one the tracker cannot hear —
        // still moves the figure on: after a few seconds on the same band,
        // the next figure near it.
        const monotone = drive.level > 0.06 && now - lastFigureAt > 4500;
        if (band !== shownBand || monotone) {
          shownBand = band;
          lastFigureAt = now;
          variant += 1;
          const mode = m.modeForOrder(band / (m.BANDS - 1), variant);
          if (still) e.setModeNow(mode);
          else e.setMode(mode);
          dirty = true;
        }
      }
      const changed = before.open !== drive.open || before.live !== drive.live || before.level !== drive.level;
      // The sand's stream outlives the spring; keep drawing while it runs.
      const running = "active" in e && (e as { active: boolean }).active;
      if ((drive.open > 0.001 || running || changed || dirty) && (!still || changed || dirty)) {
        // Seconds since this opened, so the shader never sees a time large
        // enough to lose precision.
        e.draw({ time: still ? 0.9 : (now - epoch) / 1000, level: drive.level, live: drive.live, open: drive.open });
        dirty = false;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [still, openness, place]);

  const words = snapshot?.transcript ? snapshot.transcript.split(" ").filter(Boolean) : [];
  const listening = snapshot?.state === "listening";

  return (
    <div ref={rootRef} className={styles.field} data-look={look} data-open={open || undefined} aria-hidden>
      <canvas ref={canvasRef} className={styles.canvas} />
      {/* The words come up one by one. When it is over the block leaves in
          one piece, toward the composer if kept, up and away if not, under
          a blur — and only then do the words arrive in the composer. */}
      <AnimatePresence custom={ended}>
        {open && snapshot.state !== "requesting" && (
          <motion.p
            key="words"
            className={styles.words}
            style={{ bottom: wordsBottom, x: "-50%", transformOrigin: "50% 100%" }}
            custom={ended}
            initial={false}
            animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
            variants={{
              gone: (how: DictationEnd) =>
                still
                  ? { opacity: 0, transition: { duration: 0.12 } }
                  : { scale: 0.96, y: how === "done" ? 6 : -6, opacity: 0, filter: "blur(4px)", transition: { duration: 0.16, ease: EASE_OUT } },
            }}
            exit="gone"
          >
            <span>
              {words.length === 0 ? (
                <span className={styles.hint}>{text.goAhead}</span>
              ) : (
                words.map((word, i) => (
                  <Fragment key={i}>
                    {i > 0 && " "}
                    <motion.span
                      className={`${styles.word} ${i === words.length - 1 && listening ? styles.newest : ""}`}
                      // Rising out of a slot rather than fading in. The clip
                      // reaches past the box so the marker's edge is not cut.
                      initial={still ? false : { y: "0.55em", clipPath: "inset(100% -4px -4px -4px)" }}
                      animate={{ y: 0, clipPath: "inset(-4px -4px -4px -4px)" }}
                      transition={SPRING}
                    >
                      {word}
                    </motion.span>
                  </Fragment>
                ))
              )}
            </span>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
