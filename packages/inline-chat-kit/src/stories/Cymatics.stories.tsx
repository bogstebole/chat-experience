import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnimatePresence, animate, motion, MotionConfig, useMotionValue, useReducedMotion } from "motion/react";
import { Check, Mic, Plus, X } from "lucide-react";
import { KitButton } from "../Button/KitButton";
import composer from "../ChatInput/ChatInput.module.css";
import { Cymatics, modeForOrder } from "./cymatics";
import { BANDS, ToneTracker, detectPitch, simulatedTone } from "./voiceTone";
import { LOOKS } from "./water";
import { SAND_DEFAULTS, Sand } from "./sand";
import { DialRoot, useDialKitController } from "dialkit";
import "dialkit/styles.css";

/** Sand first: grains on an invisible plate. The rest are the water shaders, kept to compare. */
const LOOK_NAMES = ["sand", ...Object.keys(LOOKS)] as ("sand" | keyof typeof LOOKS)[];
type Look = (typeof LOOK_NAMES)[number];

const makeField = (canvas: HTMLCanvasElement, look: Look) => (look === "sand" ? new Sand(canvas) : new Cymatics(canvas, LOOKS[look]));
import { tone, warmEarcons } from "./earcons";
import s from "./cymatics.module.css";

/**
 * J · Cymatics — round four of I4, from the sketch.
 *
 * The composer does not grow. Pressing the microphone pulls the reader in:
 * the page falls back, dims and blurs, and a dish of water opens out of the
 * microphone over all of it. The voice shakes the water; each word it hears
 * stands the water up in a different shape, and the words are written large
 * beneath the dish. Done drops them into the composer.
 *
 * - **Waiting on the browser is still water.** The dish opens, the drop sits
 *   in the middle, nothing moves. The water only starts to stand up once the
 *   microphone is open — which is the moment the start sound plays.
 * - **Reduced motion:** the page dims without travelling, the dish appears
 *   rather than opening, and each word's shape is a still frame.
 * - **`source: microphone`** uses your real microphone for the level, and the
 *   browser's own recogniser (Chrome, Safari) for the words, so the shapes
 *   follow what you actually say. The kit itself would take its words from
 *   the host's transcriber.
 */
const meta: Meta = {
  title: "Explorations/Dictation feel (I4)/Cymatics",
  parameters: { layout: "fullscreen" },
};

export default meta;

type Phase = "idle" | "requesting" | "listening" | "finishing";

const SPOKEN = "book a table for two on friday at eight somewhere quiet near the river and send the confirmation to Ana".split(" ");
const PRIOR =
  "Friday works. The places you liked last time were Lumière and the one by the river — both have tables at eight, and Lumière holds a window table if you ask before noon.";

const speech = (t: number) => {
  const phrase = t % 2.7 < 2.1 ? 1 : 0.04;
  const syllable = (0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 3.6 + Math.sin(t * 1.3) * 2)) ** 1.4;
  const swell = 0.5 + 0.5 * Math.sin(t * 0.9 + 1) ** 2;
  return Math.min(1, phrase * syllable * swell * (0.8 + 0.2 * Math.sin(t * 23)));
};

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

interface Recogniser {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror?: ((event: { error: string }) => void) | null;
  onend?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/** Told once it has said its last; set here, outside a component, where assigning a handler is not a render. */
const whenEnded = (recogniser: Recogniser, fn: () => void) => {
  recogniser.onend = fn;
};

const recogniserFor = (): Recogniser | null => {
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => Recogniser }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => Recogniser }).webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
};

/**
 * Why the browser's recogniser gave no words, said on the page: with no
 * handler for its errors it failed silently, and the sand moving to the
 * voice made it look as though only the words were broken.
 */
const recogniserTrouble = (error: string, lang: string): string | null => {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "This browser won't let the page use its speech recogniser. In Safari, Dictation must be on (System Settings → Keyboard); Chrome needs the microphone allowed for this site.";
    case "network":
      return "This browser has no speech service behind its recogniser — Arc, Brave, Dia, Electron and other Chromium builds without Google's keys don't. Try Chrome or Safari.";
    case "language-not-supported":
      return `This browser cannot recognise ${lang}. Pick another language in the controls.`;
    case "audio-capture":
      return "The recogniser could not get the microphone.";
    default:
      // "no-speech" and "aborted" are a pause and a stop, not trouble.
      return null;
  }
};

interface Geometry {
  /** From the bottom of the page: the words sit just above the composer. */
  wordsBottom: number;
  /** The composer's full width, so it can narrow from it and back to it. */
  full: number;
}

/**
 * One spring for the whole move. The composer narrowing, its buttons
 * turning into Cancel and Done, the conversation stepping back and the
 * figure opening out of the microphone all start on the same frame and
 * settle together — which is what makes them read as one gesture instead of
 * five animations that happen to overlap.
 */
const SPRING = { stiffness: 320, damping: 32, mass: 1 } as const;
const SPRING_T = { type: "spring", ...SPRING } as const;
/** A strong ease-out, for what enters and leaves (Emil Kowalski's curve). */
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/**
 * An icon that becomes another in place. No cross-fade — two icons half
 * there at once is the overlap that made the press read as several things
 * happening. The old one is simply gone; the new one turns into place.
 */
function SwapIcon({ name, children, still }: { name: string; children: ReactNode; still: boolean }) {
  return (
    <motion.span
      key={name}
      style={{ display: "inline-grid", placeItems: "center", width: 14, height: 14 }}
      initial={still ? false : { scale: 0.4, rotate: -60 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={SPRING_T}
    >
      {children}
    </motion.span>
  );
}

/**
 * Every number the sand, the tone and the layout run on, on a DialKit panel,
 * kept across reloads. "Reset" brings back these defaults; "Copy values"
 * puts the current ones on the clipboard as JSON, to paste back here once
 * they are right. The id carries a version: bump it when the defaults move,
 * or the values saved in a browser keep overriding them.
 */
const DIAL_ID = "i4-sand-v2";

function useSandDials(onAction: (path: string) => void) {
  const d = SAND_DEFAULTS;
  return useDialKitController(
    "Dictation · sand",
    {
      Movement: {
        gather: [d.gather, 0.2, 4, 0.05],
        speedSpread: [d.speedSpread, 0, 1.5, 0.05],
        kick: [d.kick, 0, 0.4, 0.005],
        jostle: [d.jostle, 0, 0.5, 0.01],
        idle: [d.idle, 0, 1, 0.01],
        dust: [d.dust, 0, 0.5, 0.01],
        refresh: [d.refresh, 0, 0.3, 0.01],
      },
      Figures: {
        hold: [d.hold, 0.3, 6, 0.1],
        monotoneSeconds: [4.5, 1, 12, 0.5],
      },
      Grains: {
        density: [d.density, 0.1, 2.5, 0.02],
        maxGrains: [d.maxGrains, 5000, 80000, 1000],
        grainSize: [d.grainSize, 0.6, 4, 0.1],
        strength: [d.strength, 0.1, 1, 0.01],
        waiting: [d.waiting, 0, 1, 0.01],
      },
      Edge: {
        edgeFrom: [d.edgeFrom, 0, 1.2, 0.01],
        edgeTo: [d.edgeTo, 0.4, 1.6, 0.01],
      },
      Sprinkle: {
        pourOut: [d.pourOut, 0.1, 4, 0.05],
        pourBack: [d.pourBack, 0.1, 3, 0.05],
      },
      Tone: {
        follow: [0.6, 0.1, 3, 0.05],
        learn: [8, 1, 30, 0.5],
        range: [3.5, 1, 9, 0.25],
        margin: [0.045, 0, 0.2, 0.005],
        levelSmoothing: [0.8, 0.05, 2, 0.05],
      },
      Layout: {
        size: [0.21, 0.1, 0.5, 0.005],
        maxRadius: [150, 60, 400, 1],
        lift: [12, -120, 200, 1],
      },
      reset: { type: "action", label: "Reset to defaults" },
      copy: { type: "action", label: "Copy values" },
    },
    { id: DIAL_ID, persist: true, onAction }
  );
}

type SandDials = ReturnType<typeof useSandDials>["values"];

function CymaticsDemo({
  source,
  promptMs,
  still: forceStill,
  look,
  language,
}: {
  source: "simulated" | "microphone";
  promptMs: number;
  still: boolean;
  look: Look;
  /** A BCP 47 tag for the browser's recogniser, or "browser" for the browser's own language. */
  language: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const still = forceStill || reduced;
  const dialsRef = useRef<SandDials | null>(null);
  const resetRef = useRef<() => void>(() => {});
  const controller = useSandDials((path) => {
    if (path === "reset") resetRef.current();
    if (path === "copy") {
      const v = dialsRef.current;
      if (v) void navigator.clipboard?.writeText(JSON.stringify(v, null, 2));
    }
  });
  const dials = controller.values;
  // Read by the frame loop and by place(), which run outside render.
  useEffect(() => {
    dialsRef.current = dials;
    resetRef.current = controller.resetValues;
  });
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [heard, setHeard] = useState("");
  /**
   * The words of the last recording, still as words: each one keeps the
   * layout id it had above the composer, so it travels from there into the
   * field instead of disappearing up there and appearing down here.
   */
  /** Counts arrivals in the field: a new one slides the field's text in from its top edge. */
  const [arrival, setArrival] = useState(0);
  /** How the last recording ended: kept words go down into the composer, discarded ones up and away. */
  const [leaving, setLeaving] = useState<"done" | "cancel">("done");
  /** Between the transcript going and the text arriving: the field holds still and says nothing. */
  const [landing, setLanding] = useState(false);
  const [radius, setRadius] = useState(22);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [geo, setGeo] = useState<Geometry>({ wordsBottom: 96, full: 358 });
  const [gl] = useState(() => Cymatics.supported());

  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  /** When this page opened, set once mounted. */
  const epoch = useRef(0);
  const engine = useRef<Cymatics | Sand | null>(null);
  const drive = useRef({ level: 0, live: 0, open: 0 });
  /**
   * How far the field has opened, on Motion's clock rather than the loop's:
   * the composer and the conversation are Motion animations that start after
   * React commits, and a field on its own clock ran two frames ahead of them.
   */
  const openness = useMotionValue(0);
  const phaseRef = useRef<Phase>("idle");
  const heardRef = useRef("");
  const timers = useRef<number[]>([]);
  const media = useRef<{ stream: MediaStream; ctx: AudioContext; analyser: AnalyserNode; recogniser: Recogniser | null } | null>(null);
  const startedAt = useRef(0);
  /** The voice's tone, followed slowly; it, not the words, picks the figure. */
  const tracker = useRef(new ToneTracker());
  const shownBand = useRef(-1);
  /** Counts the figures shown, so returning to a band brings a new figure, not the last one. */
  const variant = useRef(0);
  const pitchAt = useRef(0);
  /** Pitch readings that found a voice in this recording: whether anyone has spoken yet. */
  const voiced = useRef(0);
  const [toneReading, setToneReading] = useState<{ tone: number; band: number; hz: number | null; level: number; grains: number | null } | null>(null);
  const readAt = useRef(0);
  const lastFigureAt = useRef(0);
  const dirty = useRef(true);
  /** Set on the way out; the microphone is inert until the dish has closed. */
  const returnFocus = useRef(false);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    dirty.current = true;
    setPhase(next);
  }, []);

  /**
   * Where the figure stands — whole, above the words, above the composer —
   * and the microphone it opens out of. No dish: past its radius it melts
   * into the page.
   */
  const place = useCallback(() => {
    const page = pageRef.current;
    const e = engine.current;
    if (!page || !e) return;
    const box = page.getBoundingClientRect();
    const dock = dockRef.current?.getBoundingClientRect();
    const dockTop = dock ? dock.top - box.top : box.height - 64;
    // A third smaller than it was: at 40% of the width the sand ran under
    // the words and the composer on a phone. 104px of radius there.
    const L = dialsRef.current?.Layout ?? { size: 0.21, maxRadius: 150, lift: 12 };
    const radius = Math.min(box.width * L.size, (box.height - 160) * L.size, L.maxRadius);
    e.radius = radius;
    // The last loose grains reach about 1.15 radii; they stop just above a
    // transcript of three lines. Measured from the composer's own type, which
    // is 12px on a desktop and 16px on a phone.
    const editor = dockRef.current?.querySelector<HTMLElement>("[data-placeholder]");
    const type = editor ? parseFloat(getComputedStyle(editor).fontSize) : 14;
    const words = 22 + 3 * 1.6 * type + 10;
    e.center = { x: box.width / 2, y: dockTop - words - radius * 1.15 - L.lift };
    const mic = micRef.current?.getBoundingClientRect();
    e.mic = mic ? { x: mic.left - box.left + mic.width / 2, y: mic.top - box.top + mic.height / 2 } : { ...e.center };
    setGeo({ wordsBottom: dock ? box.bottom - dock.top + 22 : 96, full: dock ? dock.width : 358 });
    // Motion keeps a corner round while it scales the box only if it knows
    // the radius as a number; the token gives a string.
    const r = surfaceRef.current ? parseFloat(getComputedStyle(surfaceRef.current).borderTopLeftRadius) : NaN;
    if (Number.isFinite(r)) setRadius(r);
    dirty.current = true;
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!gl) return;
    engine.current = makeField(canvas, look);
    // For poking at from the console while this is an exploration.
    (window as unknown as { __cymatics?: unknown }).__cymatics = { engine: engine.current, drive: drive.current };
    place();
    const onResize = () => place();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [place, gl, look]);

  useEffect(() => warmEarcons(), []);

  // The layout dials move the figure; the rest are read by the frame loop.
  const { size, maxRadius, lift } = dials.Layout;
  useEffect(() => {
    place();
  }, [size, maxRadius, lift, place]);

  const isOpen = phase !== "idle";
  useEffect(() => {
    const controls = animate(openness, isOpen ? 1 : 0, still ? { duration: 0 } : SPRING_T);
    return () => controls.stop();
  }, [isOpen, still, openness]);

  // One loop, alive while the field is open or closing.
  useEffect(() => {
    if (!epoch.current) epoch.current = performance.now();
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const d = drive.current;
      const p = phaseRef.current;
      const openTarget = p === "idle" ? 0 : 1;
      const liveTarget = p === "listening" ? 1 : 0;
      const before = { ...d };
      if (still) {
        d.open = openTarget;
        d.live = liveTarget;
        d.level = liveTarget ? 0.6 : 0;
      } else {
        d.open = Math.min(1.02, Math.max(0, openness.get()));
        d.live += (liveTarget - d.live) * (1 - Math.exp(-dt * 5));
        let level = 0;
        if (p === "listening") {
          const m = media.current;
          const t = (now - startedAt.current) / 1000;
          if (m) {
            const buf = new Float32Array(m.analyser.fftSize);
            m.analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (const v of buf) sum += v * v;
            level = Math.min(1, Math.sqrt(sum / buf.length) * 5);
            // Pitch twenty times a second is plenty for something followed
            // over a second, and a third of the cost.
            if (now - pitchAt.current > 50) {
              const since = pitchAt.current ? (now - pitchAt.current) / 1000 : 0.05;
              pitchAt.current = now;
              const hz = detectPitch(buf, m.ctx.sampleRate);
              if (hz != null) voiced.current += 1;
              tracker.current.push(hz, since);
            }
          } else {
            level = speech(t);
            // The simulated speaker only has a tone while they are talking.
            if (level > 0.08) tracker.current.setTone(simulatedTone(t));
          }
        }
        // Followed over about half a second, not per syllable: the voice
        // swells the figure, it does not make it flicker.
        d.level += (level - d.level) * (1 - Math.exp(-dt / (dialsRef.current?.Tone.levelSmoothing ?? 0.8)));
      }
      if (p === "listening") {
        setElapsed(Math.floor((now - startedAt.current) / 1000));
        const band = tracker.current.band;
        // A voice that holds one pitch — or one the tracker cannot hear —
        // still moves the figure on: after a few seconds of talking on the
        // same band, the next figure near it.
        const monotone = d.level > 0.06 && now - lastFigureAt.current > (dialsRef.current?.Figures.monotoneSeconds ?? 4.5) * 1000;
        if ((band !== shownBand.current || monotone) && engine.current) {
          shownBand.current = band;
          lastFigureAt.current = now;
          variant.current += 1;
          const mode = modeForOrder(band / (BANDS - 1), variant.current);
          if (still) engine.current.setModeNow(mode);
          else engine.current.setMode(mode);
          dirty.current = true;
        }
        const hz = tracker.current.heard;
        // Ten times a second: a re-render every frame was itself a cost.
        if (now - readAt.current > 100) {
          readAt.current = now;
          const grains = engine.current instanceof Sand ? engine.current.grains : null;
          setToneReading({ tone: Math.round(tracker.current.tone * 100) / 100, band, hz: hz == null ? null : Math.round(hz), level: Math.round(d.level * 100) / 100, grains });
        }
      }
      // The panel's values, every frame: cheap, and a slider moves the sand
      // while it is on screen.
      const v = dialsRef.current;
      if (v) {
        if (engine.current instanceof Sand) {
          Object.assign(engine.current.tune, v.Movement, v.Grains, v.Edge, v.Sprinkle, { hold: v.Figures.hold });
        }
        const tr = tracker.current;
        tr.follow = v.Tone.follow;
        tr.learn = v.Tone.learn;
        tr.range = v.Tone.range;
        tr.margin = v.Tone.margin;
      }
      const changed = before.open !== d.open || before.live !== d.live || before.level !== d.level;
      // The sand's stream outlives the composer's spring; keep drawing while it runs.
      const running = engine.current instanceof Sand && engine.current.active;
      if (engine.current && (d.open > 0.001 || running || changed || dirty.current) && (!still || changed || dirty.current)) {
        // Seconds since this page opened, so the shader never sees a time
        // large enough to lose precision.
        engine.current.draw({ time: still ? 0.9 : (now - epoch.current) / 1000, level: d.level, live: d.live, open: d.open }, now);
        dirty.current = false;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [still, openness]);

  const release = () => {
    const m = media.current;
    media.current = null;
    if (!m) return;
    m.recogniser?.abort();
    m.stream.getTracks().forEach((track) => track.stop());
    void m.ctx.close().catch(() => {});
  };

  const begin = () => {
    startedAt.current = performance.now();
    heardRef.current = "";
    setHeard("");
    setElapsed(0);
    // Every recording learns its speaker afresh, and starts in the middle.
    tracker.current = new ToneTracker();
    pitchAt.current = 0;
    voiced.current = 0;
    shownBand.current = tracker.current.band;
    lastFigureAt.current = performance.now();
    const first = modeForOrder(tracker.current.band / (BANDS - 1));
    if (still) engine.current?.setModeNow(first);
    else engine.current?.setMode(first);
    go("listening");
    tone("start");
  };

  const start = async () => {
    clearTimers();
    setNote(null);
    place();
    go("requesting");
    tone("tick");
    // The microphone becomes Cancel in place, so focus is already there.
    if (source === "simulated") {
      later(() => {
        if (phaseRef.current !== "requesting") return;
        begin();
        SPOKEN.forEach((_, i) =>
          later(() => {
            if (phaseRef.current !== "listening") return;
            heardRef.current = SPOKEN.slice(0, i + 1).join(" ");
            setHeard(heardRef.current);
          }, 600 + i * 380)
        );
      }, promptMs);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Pressed again while the browser was asking: that was a cancel, and the
      // yes that came after it must not start a recording.
      if (phaseRef.current !== "requesting") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      // 2048 samples: two periods of the lowest voice, for the pitch.
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const recogniser = recogniserFor();
      if (recogniser) {
        recogniser.continuous = true;
        recogniser.interimResults = true;
        // Unset, it recognises the page's language — English here — and a
        // sentence in Serbian came back as nothing at all.
        recogniser.lang = language === "browser" ? navigator.language : language;
        /** What earlier sessions heard: Chrome ends one after a long pause, and the next starts with no results. */
        let kept = "";
        let broken = false;
        recogniser.onresult = (event) => {
          let all = kept;
          // Chrome starts each later result with a space and Safari doesn't.
          for (let i = 0; i < event.results.length; i++) all += ` ${event.results[i][0].transcript}`;
          heardRef.current = all.trim().replace(/\s+/g, " ");
          setHeard(heardRef.current);
        };
        recogniser.onerror = (event) => {
          const trouble = recogniserTrouble(event.error, recogniser.lang);
          if (!trouble) return;
          broken = true;
          setNote(trouble);
        };
        // Until Done replaces this, an end is the browser stopping on its own
        // after a pause: start again, keeping what it heard.
        recogniser.onend = () => {
          if (broken || phaseRef.current !== "listening" || media.current?.recogniser !== recogniser) return;
          kept = heardRef.current;
          try {
            recogniser.start();
          } catch {
            // Already starting again.
          }
        };
        try {
          recogniser.start();
        } catch {
          // Some browsers refuse a second recogniser; the level still works.
        }
        // A Chromium build without Google's speech service can fail with no
        // error at all: it hears nothing and says nothing. Five seconds of a
        // voice and not one word is that.
        later(() => {
          if (broken || phaseRef.current !== "listening" || media.current?.recogniser !== recogniser) return;
          // About a second of voice, so silence alone does not set it off.
          if (heardRef.current || voiced.current < 15) return;
          setNote(
            "Five seconds of your voice and no words from this browser's recogniser. Chromium browsers other than Chrome (Arc, Dia, Brave) may ship it without a working speech service — try Chrome or Safari."
          );
        }, 5000);
      } else {
        setNote("This browser has no speech recogniser (Firefox doesn't). The sand still follows your voice; the words won't come.");
      }
      media.current = { stream, ctx, analyser, recogniser };
      begin();
    } catch {
      go("idle");
      setNote("The microphone was refused. It can be allowed again from the site settings.");
      tone("cancel");
    }
  };

  const finish = () => {
    clearTimers();
    tone("stop");
    // One commit, one direction. The transcript slides down and goes under
    // its own bottom edge; the same text slides down into the composer from
    // the composer's top edge. Words flying one by one crossed each other
    // as the lines re-wrapped — a block moving once does not.
    const land = () => {
      const said = heardRef.current.trim();
      heardRef.current = "";
      setLeaving("done");
      setHeard("");
      go("idle");
      returnFocus.current = true;
      if (!said) return;
      // In turn, not at once: the transcript blurs away first, then the text
      // appears in the composer. Two states seen together read as two things.
      setLanding(true);
      later(() => {
        setLanding(false);
        setText((t) => (t && !t.endsWith(" ") ? `${t} ${said}` : t + said));
        setArrival((n) => n + 1);
      }, 170);
    };
    const recogniser = media.current?.recogniser;
    if (!recogniser) {
      release();
      land();
      return;
    }
    // The browser's recogniser hands over its last words after it is told to
    // stop, not before. Wait for them, but not for long.
    go("finishing");
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      release();
      land();
    };
    whenEnded(recogniser, end);
    try {
      recogniser.stop();
    } catch {
      end();
    }
    later(end, 900);
  };

  const cancel = () => {
    clearTimers();
    setLeaving("cancel");
    release();
    heardRef.current = "";
    setHeard("");
    if (phaseRef.current !== "idle") tone("cancel");
    go("idle");
    returnFocus.current = true;
  };

  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
      // Enter on a focused button is that button's; only a free Enter finishes.
      else if (e.key === "Enter" && phaseRef.current === "listening" && !(e.target instanceof HTMLButtonElement)) finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // The handlers read refs; re-binding per phase is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase !== "idle" || !returnFocus.current) return;
    returnFocus.current = false;
    micRef.current?.focus();
  }, [phase]);

  useEffect(() => () => {
    clearTimers();
    release();
  }, []);

  const open = phase !== "idle";
  const words = heard ? heard.split(" ").filter(Boolean) : [];

  const statusLine =
    phase === "requesting" ? "Waiting for microphone…" : phase === "finishing" ? "Writing it down…" : `Listening · ${clock(elapsed)}`;

  return (
    <div ref={pageRef} className={s.page} data-open={open || undefined} data-still={still || undefined}>
      {/* The conversation steps back on the same spring. */}
      <motion.div
        className={s.thread}
        aria-hidden={open || undefined}
        animate={open ? { scale: still ? 1 : 0.96, opacity: 0.28, filter: still ? "blur(0px)" : "blur(2px)" } : { scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={still ? { duration: 0.15 } : SPRING_T}
      >
        <div className={s.bubble}>Any good places for Friday?</div>
        <p className={s.answer}>{PRIOR}</p>
        <div className={s.bubble}>Which one is quieter?</div>
        <p className={s.answer}>The one by the river. It is smaller, and the tables are further apart.</p>
      </motion.div>

      <canvas ref={canvasRef} className={s.canvas} aria-hidden />

      {/* The words come up one by one. When it is over the block leaves in
          one piece: down under its own bottom edge toward the composer if
          kept, up and away if discarded. Clipped, never faded. */}
      <AnimatePresence custom={leaving}>
        {open && phase !== "requesting" && (
          <motion.p
            key="words"
            className={s.words}
            style={{ bottom: geo.wordsBottom, x: "-50%", transformOrigin: "50% 100%" }}
            aria-live="polite"
            custom={leaving}
            initial={false}
            animate={{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)" }}
            // Gathers toward the composer and blurs away; blur is what makes
            // the leaving read as one thing changing, not a box vanishing.
            variants={{
              gone: (how: "done" | "cancel") =>
                still
                  ? { opacity: 0, transition: { duration: 0.12 } }
                  : {
                      scale: 0.96,
                      y: how === "done" ? 6 : -6,
                      opacity: 0,
                      filter: "blur(4px)",
                      transition: { duration: 0.16, ease: EASE_OUT },
                    },
            }}
            exit="gone"
          >
            <span>
              {words.length === 0 ? (
                <span className={s.hint}>Go ahead — I'm listening</span>
              ) : (
                words.map((word, i) => (
                  <Fragment key={i}>
                    {i > 0 && " "}
                    <motion.span
                      className={`${s.word} ${i === words.length - 1 && phase === "listening" ? s.newest : ""}`}
                      // Rising out of a slot rather than fading in. The clip
                      // reaches past the box so the marker's edge is not cut.
                      initial={still ? false : { y: "0.55em", clipPath: "inset(100% -4px -4px -4px)" }}
                      animate={{ y: 0, clipPath: "inset(-4px -4px -4px -4px)" }}
                      transition={SPRING_T}
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

      {/* The composer does not go anywhere. It narrows, its placeholder
          gives way to the state, and its two buttons become Cancel and Done
          — the same pill, transformed. Its width moves by layout, so what is
          inside it is laid out at the width it is going to, and the words
          landing in it head for where they will actually stay. */}
      <div ref={dockRef} className={s.dock} role={open ? "group" : undefined} aria-label={open ? "Dictation" : undefined}>
        <div className={composer.root} style={{ width: "auto", maxWidth: "100%" }}>
          <motion.div
            ref={surfaceRef}
            layout
            className={composer.surface}
            // While it listens it is only as wide as what it holds: the state
            // and its two buttons, nothing between them.
            style={{ width: open ? "auto" : geo.full, maxWidth: "100%", borderRadius: radius, flexDirection: "column", alignItems: "stretch", justifyContent: "center" }}
            transition={still ? { duration: 0 } : SPRING_T}
          >
            <div className={s.row}>
              <div className={composer.editorClip}>
                {/* Its own box clips — which is what lets the text slide in
                    from the top edge instead of fading up. */}
                <div className={composer.editorWrap}>
                  {open ? (
                    <motion.div layout="position" className={composer.editor} transition={SPRING_T}>
                      <span className={s.status} data-live={phase === "listening" || undefined}>
                        {statusLine}
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key={arrival}
                      layout="position"
                      className={composer.editor}
                      data-placeholder={landing ? "" : "Ask me anything"}
                      // Arrives once the transcript is gone — never both at once —
                      // out of the same blur it left in.
                      initial={arrival ? (still ? { opacity: 0 } : { opacity: 0, y: 4, filter: "blur(4px)" }) : false}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.22, ease: EASE_OUT }}
                    >
                      {text}
                    </motion.div>
                  )}
                </div>
              </div>
              <motion.div layout="position" className={composer.buttonGroup} transition={SPRING_T}>
                {/* One button that is the microphone, then Cancel: the same
                    element, so focus is already on the way out. */}
                <div className={s.slot}>
                  <KitButton
                    ref={micRef}
                    variant="ghost"
                    kitRole={open ? "cancel-edit" : "dictate"}
                    aria-label={open ? "Cancel dictation" : "Dictate a message"}
                    onClick={() => (open ? cancel() : void start())}
                    icon={
                      <SwapIcon name={open ? "cancel" : "mic"} still={still}>
                        {open ? <X size={14} strokeWidth={1.8} /> : <Mic size={14} strokeWidth={1.8} />}
                      </SwapIcon>
                    }
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
                {/* The plus becomes Done, right beside Cancel: it turns into
                    place, it does not fade over the plus. */}
                <div className={s.slot}>
                  {open ? (
                    <motion.div
                      key="done"
                      className={s.fill}
                      initial={still ? false : { scale: 0.5, rotate: -60 }}
                      animate={{ scale: 1, rotate: 0, opacity: phase === "requesting" ? 0.4 : 1 }}
                      transition={SPRING_T}
                    >
                      <KitButton
                        variant="primary"
                        kitRole="dictate"
                        aria-label="Done — put it in the message"
                        disabled={phase === "requesting"}
                        loading={phase === "finishing"}
                        onClick={finish}
                        icon={<Check size={14} strokeWidth={2.2} />}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </motion.div>
                  ) : (
                    <motion.div key="add" className={s.fill} initial={still ? false : { scale: 0.5, rotate: 60 }} animate={{ scale: 1, rotate: 0 }} transition={SPRING_T}>
                      <KitButton variant="ghost" kitRole="add" aria-label="Add" icon={<Plus size={14} strokeWidth={1.8} />} style={{ width: "100%", height: "100%" }} />
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {note && (
        <p className={s.note} role="status">
          {note}
        </p>
      )}

      {!gl && open && <div className={s.fallback}>This browser cannot draw the water.</div>}

      {/* For the exploration only: what the voice's tone is doing. */}
      {open && toneReading && (
        <div className={s.readout} data-tone={toneReading.tone} data-band={toneReading.band}>
          {toneReading.hz == null ? "— Hz" : `${toneReading.hz} Hz`} · level {toneReading.level.toFixed(2)} · tone {toneReading.tone.toFixed(2)} · figure {toneReading.band + 1}/{BANDS}
          {toneReading.grains != null && ` · ${toneReading.grains.toLocaleString("en")} grains`}
        </div>
      )}
    </div>
  );
}

interface Args {
  look: Look;
  /** The tuning panel. Closed to a button on a narrow screen, where open it covers the composer. */
  panel: boolean;
  source: "simulated" | "microphone";
  /** For the browser's recogniser, with the microphone. */
  language: "sr-RS" | "en-US" | "browser";
  permission: "prompt" | "granted";
  reducedMotion: boolean;
}

export const J_Cymatics: StoryObj<Args> = {
  name: "J · Cymatics",
  args: { look: "sand", panel: true, source: "simulated", language: "sr-RS", permission: "prompt", reducedMotion: false },
  argTypes: {
    look: { control: "inline-radio", options: LOOK_NAMES },
    panel: { control: "boolean" },
    source: { control: "inline-radio", options: ["simulated", "microphone"] },
    language: { control: "inline-radio", options: ["sr-RS", "en-US", "browser"] },
    permission: { control: "inline-radio", options: ["prompt", "granted"] },
    reducedMotion: { control: "boolean" },
  },
  render: (a) => (
    <MotionConfig reducedMotion="user">
      {a.panel && <DialRoot defaultOpen={typeof window === "undefined" || window.innerWidth >= 720} />}
      <CymaticsDemo
        key={a.look}
        look={a.look}
        source={a.source}
        promptMs={a.permission === "prompt" ? 1800 : 60}
        still={a.reducedMotion}
        language={a.language}
      />
    </MotionConfig>
  ),
};

/* ── The vocabulary: what each word stands the water up as ─────────────── */

/** The six figures, from the bottom of a speaker's range to the top. */
const TONE_LABELS = ["lowest", "low", "lower middle", "upper middle", "high", "highest"];

/**
 * One WebGL context for the whole grid, copied out into plain canvases: a
 * dozen contexts is past what some browsers keep alive, and the first ones
 * were lost before the last were made.
 */
function Vocabulary({ look }: { look: Look }) {
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = grid.current;
    if (!root || !Cymatics.supported()) return;
    const offscreen = document.createElement("canvas");
    offscreen.style.cssText = "position:fixed;left:-9999px;width:220px;height:160px";
    root.appendChild(offscreen);
    const dish = makeField(offscreen, look);
    // The whole figure, centred in each cell.
    dish.center = { x: 110, y: 80 };
    dish.mic = { x: 110, y: 80 };
    dish.radius = 72;
    const draw = () => {
      for (const cell of Array.from(root.querySelectorAll<HTMLCanvasElement>("canvas[data-band]"))) {
        dish.setModeNow(modeForOrder(Number(cell.dataset.band) / (BANDS - 1)));
        dish.draw({ time: 0.9, level: 0.75, live: 1, open: 1 });
        cell.width = offscreen.width;
        cell.height = offscreen.height;
        cell.getContext("2d")?.drawImage(offscreen, 0, 0);
      }
    };
    draw();
    // Picks up a change of theme without a loop running for it.
    const id = window.setInterval(draw, 800);
    return () => {
      clearInterval(id);
      dish.dispose();
      offscreen.remove();
    };
  }, [look]);
  return (
    <div ref={grid} className={s.grid}>
      {TONE_LABELS.map((label, band) => (
        <div key={label} className={s.cell}>
          <canvas data-band={band} className={s.cellCanvas} aria-hidden />
          {label}
        </div>
      ))}
    </div>
  );
}

export const J_Vocabulary: StoryObj<{ look: Look }> = {
  name: "J · Cymatics — one figure per tone",
  parameters: { layout: "centered" },
  args: { look: "sand" },
  argTypes: { look: { control: "inline-radio", options: LOOK_NAMES } },
  render: (a) => <Vocabulary key={a.look} look={a.look} />,
};
