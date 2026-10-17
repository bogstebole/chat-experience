"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { announce } from "../announce/announce";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import { defaultLabels, type VoiceLabels } from "../labels/labels";

/**
 * The microphone, and everything around turning it into text except the part
 * that is a service.
 *
 * The division is the same one the artifact pane settled: the kit owns what is
 * the same in every product and the host owns what differs. Permission,
 * recording, the level of the incoming signal and the states in between are
 * identical wherever this ships — sixty lines every host would otherwise write
 * again, slightly differently. Turning audio into words is a choice between
 * Whisper, Deepgram, a local model and somebody's own endpoint, and a kit that
 * chose one for its consumers would be wrong for most of them.
 *
 * So this records and hands over a `Blob`. What comes back is text. Or, for
 * words that appear while somebody is still talking, it hands over the
 * microphone's stream as it opens and takes back the transcript so far, as
 * often as the host's service has one — `onTranscribeLive`.
 *
 * **What that costs, stated rather than discovered:** the browser's own
 * `SpeechRecognition` cannot be reached through this, because it insists on
 * holding the microphone itself and will not take a recording. It is the only
 * free transcriber there is, and this shuts the door on it. The door stays
 * shut on purpose: a kit that let each host drive the microphone would ship
 * four chats that behave differently and call it flexibility.
 */

export type VoiceState =
  /** No `getUserMedia` — an insecure context, or a browser without it. */
  | "unsupported"
  | "idle"
  /** The browser's permission prompt is up. It owns that dialog, not us. */
  | "requesting"
  | "listening"
  /** Recording is over and the host is working on it. */
  | "transcribing"
  /** Refused. Not an error: the browser will not ask again on its own. */
  | "denied"
  | "failed";

export interface TranscribeContext {
  /** Aborts when the reader cancels, or when the component goes away. */
  signal: AbortSignal;
  /** What the recorder actually produced, which is not the same everywhere. */
  mimeType: string;
}

/**
 * Audio in, words out.
 *
 * Return a string, a promise of one, or an async iterable of **deltas** — the
 * same three shapes `onSend` takes, and deltas accumulate the same way, so a
 * long dictation can appear as it is recognised rather than all at the end.
 */
export type TranscribeHandler = (
  audio: Blob,
  context: TranscribeContext
) => string | Promise<string> | AsyncIterable<string>;

export interface LiveTranscribeContext {
  /** Aborts when the reader cancels, or when the component goes away. */
  signal: AbortSignal;
  /**
   * Resolves when the reader says they are done. Finish there: tell the
   * service the audio has ended, yield the last words it sends back, and end
   * the iterable. The microphone has already stopped by then.
   */
  finished: Promise<void>;
}

/**
 * The microphone in, the words so far out, while the reader is still talking.
 *
 * Called once the browser has handed over the microphone, with its stream —
 * send it to whatever service you use, from the browser or through your own
 * server. Yield the **whole transcript so far** each time rather than what is
 * new: a live recogniser goes back and corrects the words it has just heard,
 * and a delta cannot say that. End the iterable after `finished` resolves.
 */
export type LiveTranscribeHandler = (stream: MediaStream, context: LiveTranscribeContext) => AsyncIterable<string>;

export interface UseVoiceInputOptions {
  onTranscribe?: TranscribeHandler;
  /**
   * Words while they are said. With `onTranscribe` as well, these are what is
   * shown while recording and its answer is the one that is kept — a fast
   * live service for the eye, a careful one for the record.
   */
  onTranscribeLive?: LiveTranscribeHandler;
  /**
   * Called with the transcript so far, every time it grows. Cumulative rather
   * than per-delta: the caller is putting this inside a string it already
   * holds, and giving it the whole run means it does not have to remember
   * where the last one ended.
   */
  onTranscript?: (text: string) => void;
  /** Called once when a recording has been fully transcribed. */
  onDone?: (text: string) => void;
  /**
   * The element the level is written onto, as `--ick-voice-level`, from 0 to 1.
   *
   * A number this component re-rendered on would be sixty renders a second for
   * a decoration. This is the same decision the highlighter's hover made after
   * it cost 28 DOM mutations per crossing: the value the browser needs goes
   * straight to the browser.
   */
  meterRef?: RefObject<HTMLElement | null>;
  /**
   * What is said through the live region, and the errors it reports. English
   * when left out. A hook cannot read a `LabelsProvider` the host renders
   * below it, so `ChatInput` passes its own through here.
   */
  labels?: Partial<VoiceLabels>;
}

export interface VoiceInput {
  state: VoiceState;
  /** Whether a microphone can be asked for at all. */
  supported: boolean;
  /** Why it failed, when it did. Safe to show. */
  error: string | null;
  start: () => void;
  /** Done: keep what was said. While the browser is still asking, a cancel. */
  stop: () => void;
  /** Throw the recording away, whatever it is doing. */
  cancel: () => void;
  toggle: () => void;
  /** Forget a refusal, so the button can be offered again. */
  reset: () => void;
  /**
   * The level of the incoming signal, 0 to 1, smoothed — read it in your own
   * frame loop. Always 0 under reduced motion, where nothing should move
   * with it.
   */
  getLevel: () => number;
  /** The microphone's analyser while it is open, for anything that wants more than the level. */
  getAnalyser: () => AnalyserNode | null;
}

/** Level meter smoothing. Raw RMS jitters enough to read as noise. */
const SMOOTHING = 0.6;
/** Quietest signal that still moves the meter, so a silent room reads as still. */
const FLOOR = 0.02;
/**
 * How long a live transcriber has, after Done, to hand over its last words.
 * Long enough for a service to answer a close; short enough that one which
 * never ends its iterable does not hold the composer.
 */
const LIVE_GRACE_MS = 2500;

/** Support cannot change while the page is open, so there is nothing to watch. */
const subscribeNever = () => () => {};

const canRecord = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof window.MediaRecorder !== "undefined";

/**
 * The first container the recorder will admit to supporting.
 *
 * Left to itself Safari produces mp4 and Chrome webm, and a host posting the
 * blob somewhere has to be told which arrived — that is what `mimeType` in the
 * context is for.
 */
const pickMimeType = (): string | undefined => {
  const wanted = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  const supported = window.MediaRecorder?.isTypeSupported;
  if (!supported) return undefined;
  return wanted.find((type) => window.MediaRecorder.isTypeSupported(type));
};

export function useVoiceInput({
  onTranscribe,
  onTranscribeLive,
  onTranscript,
  onDone,
  meterRef,
  labels,
}: UseVoiceInputOptions): VoiceInput {
  /**
   * Whether a microphone can be asked for, answered once and never again.
   *
   * `useSyncExternalStore` rather than an effect that corrects itself: a
   * server render has no `navigator`, so it must say no, and the client says
   * whatever is true — which is exactly the split this hook is for, and it
   * costs no second render. Written first as `useState("unsupported")` plus an
   * effect, which lint stopped on the right grounds: setting state inside an
   * effect body is a cascading render, and here it was one on every mount.
   */
  const supported = useSyncExternalStore(subscribeNever, canRecord, () => false);
  const [phase, setPhase] = useState<Exclude<VoiceState, "unsupported">>("idle");
  const [error, setError] = useState<string | null>(null);
  // Support is not a phase the machine moves through; it decides whether the
  // machine is on the page at all.
  const state: VoiceState = supported ? phase : "unsupported";

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const frameRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  /** Set while stopping, so the recorder's own stop event knows why. */
  const cancelledRef = useRef(false);
  /**
   * Counts recordings. A press while the browser's prompt was up used to
   * cancel nothing: the grant arrived afterwards and the recording started
   * anyway. Each start takes a number, a cancel moves it on, and a grant for
   * a number that is no longer current hands the microphone straight back.
   */
  const sessionRef = useRef(0);
  const levelRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  /** The live transcriber's run: its words so far, how to finish it, and when it has. */
  const liveRef = useRef<{ text: string; finish: () => void; done: Promise<void>; abort: AbortController } | null>(null);

  // Callbacks are read through a ref so that starting the microphone does not
  // depend on the identity of a function the host recreates every render.
  const handlers = useRef({ onTranscribe, onTranscribeLive, onTranscript, onDone });
  // Read the same way, and for the same reason: a host writes it inline.
  const said = useRef<VoiceLabels>({ ...defaultLabels.voice, ...labels });
  useEffect(() => {
    handlers.current = { onTranscribe, onTranscribeLive, onTranscript, onDone };
    said.current = { ...defaultLabels.voice, ...labels };
  });

  /** Everything that holds hardware or a frame loop, released in one place. */
  const teardown = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    // Suspended rather than closed on older Safari, which throws on a second
    // close. Either way the graph stops running.
    void audioRef.current?.close().catch(() => {});
    audioRef.current = null;
    analyserRef.current = null;
    recorderRef.current = null;
    levelRef.current = 0;
    meterRef?.current?.style.setProperty("--ick-voice-level", "0");
  }, [meterRef]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
      liveRef.current?.abort.abort();
      teardown();
    },
    [teardown]
  );

  /**
   * Writes the incoming level onto the meter element, once per frame.
   *
   * Skipped entirely under reduced motion. The meter is the only thing moving,
   * and a reader who asked for stillness gets a state that says "listening"
   * rather than one that pulses at them.
   */
  const runMeter = useCallback(
    (analyser: AnalyserNode) => {
      if (prefersReducedMotion()) return;
      const buffer = new Uint8Array(analyser.fftSize);
      let smoothed = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) {
          const centred = (sample - 128) / 128;
          sum += centred * centred;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const level = rms < FLOOR ? 0 : Math.min(1, rms * 3);
        smoothed = smoothed * SMOOTHING + level * (1 - SMOOTHING);
        levelRef.current = smoothed;
        meterRef?.current?.style.setProperty("--ick-voice-level", smoothed.toFixed(3));
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
    },
    [meterRef]
  );

  /** Drain whatever the host returned, in any of its three shapes. */
  const consume = useCallback(async (result: ReturnType<TranscribeHandler>) => {
    if (typeof result === "string") return result;
    if (result && typeof (result as AsyncIterable<string>)[Symbol.asyncIterator] === "function") {
      let text = "";
      for await (const delta of result as AsyncIterable<string>) {
        text += delta;
        handlers.current.onTranscript?.(text);
      }
      return text;
    }
    return await (result as Promise<string>);
  }, []);

  /** What happens once the words are in, however they came. */
  const land = useCallback((text: string) => {
    // A recording with nothing in it is not a failure. Saying so out loud
    // is the difference between "it is broken" and "say something".
    if (!text) {
      announce(said.current.nothingHeard);
      setPhase("idle");
      return;
    }
    handlers.current.onTranscript?.(text);
    handlers.current.onDone?.(text);
    announce(said.current.transcriptAdded);
    setPhase("idle");
  }, []);

  const transcribe = useCallback(
    async (audio: Blob, mimeType: string) => {
      const handler = handlers.current.onTranscribe;
      if (!handler) {
        setPhase("idle");
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase("transcribing");
      announce(said.current.transcribing);
      try {
        const text = await consume(handler(audio, { signal: controller.signal, mimeType }));
        if (controller.signal.aborted) return;
        land(text);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : said.current.transcriptFailed);
        setPhase("failed");
        announce(said.current.transcriptFailed, "assertive");
      } finally {
        abortRef.current = null;
      }
    },
    [consume, land]
  );

  /**
   * Done, with only a live transcriber: the microphone goes now, and the
   * service gets a moment to send the last words before they land.
   */
  const finishLive = useCallback(async () => {
    const live = liveRef.current;
    if (!live) return;
    setPhase("transcribing");
    announce(said.current.transcribing);
    teardown();
    live.finish();
    let timer = 0;
    await Promise.race([live.done, new Promise<void>((resolve) => (timer = window.setTimeout(resolve, LIVE_GRACE_MS)))]);
    clearTimeout(timer);
    if (live.abort.signal.aborted || liveRef.current !== live) return;
    liveRef.current = null;
    live.abort.abort();
    land(live.text.trim());
  }, [land, teardown]);

  /** Starts the host's live transcriber on the open stream, and keeps its latest words. */
  const runLive = useCallback((stream: MediaStream) => {
    const handler = handlers.current.onTranscribeLive;
    if (!handler) return;
    const abort = new AbortController();
    let finish = () => {};
    const finished = new Promise<void>((resolve) => (finish = resolve));
    const run = { text: "", finish, abort, done: Promise.resolve() };
    run.done = (async () => {
      try {
        for await (const text of handler(stream, { signal: abort.signal, finished })) {
          if (abort.signal.aborted) return;
          run.text = text;
          handlers.current.onTranscript?.(text);
        }
      } catch {
        // A live service failing is not the recording failing: the words so
        // far stay, and `onTranscribe`, if there is one, still gets the audio.
      }
    })();
    liveRef.current = run;
  }, []);

  const start = useCallback(async () => {
    // Support is not a phase any more — it is read straight from the platform
    // and gates whether this is reachable at all. Nothing to set here.
    if (!canRecord()) return;
    setError(null);
    cancelledRef.current = false;
    const session = ++sessionRef.current;
    setPhase("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      if (session !== sessionRef.current) return;
      const name = (cause as DOMException)?.name;
      // A refusal is a durable state, not a passing error: the browser will
      // not raise its prompt again, so telling the reader to try again would
      // be sending them to a button that can no longer work.
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPhase("denied");
        announce(said.current.refused, "assertive");
      } else {
        setError(name === "NotFoundError" ? said.current.notFound : said.current.couldNotOpen);
        setPhase("failed");
        announce(said.current.couldNotOpen, "assertive");
      }
      return;
    }
    // Cancelled while the browser was asking: the yes that came after it
    // must not start a recording.
    if (session !== sessionRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new Ctor();
      audioRef.current = context;
      const analyser = context.createAnalyser();
      // Two periods of the lowest voice, for anything that wants its pitch.
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      runMeter(analyser);
    } catch {
      // No meter is a lesser thing than no recording. Carry on without it.
    }

    runLive(stream);
    // Live words alone need no recording; `onTranscribe` does.
    if (!handlers.current.onTranscribe) {
      setPhase("listening");
      announce(said.current.listening);
      return;
    }

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const audio = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      teardown();
      // The careful answer replaces the live one, so the live one stops here.
      liveRef.current?.abort.abort();
      liveRef.current = null;
      if (cancelledRef.current || audio.size === 0) {
        setPhase("idle");
        return;
      }
      void transcribe(audio, type);
    };
    recorder.start();
    setPhase("listening");
    announce(said.current.listening);
  }, [runLive, runMeter, teardown, transcribe]);

  const cancel = useCallback(() => {
    sessionRef.current += 1;
    cancelledRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    liveRef.current?.abort.abort();
    liveRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    teardown();
    setPhase("idle");
  }, [teardown]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      announce(said.current.stoppedListening);
      recorder.stop();
      return;
    }
    if (liveRef.current && streamRef.current) {
      announce(said.current.stoppedListening);
      void finishLive();
      return;
    }
    // Nothing recording, so this is a cancel of whatever came after it.
    cancel();
  }, [cancel, finishLive]);

  const toggle = useCallback(() => {
    if (state === "listening" || state === "requesting" || state === "transcribing") stop();
    else if (state === "idle" || state === "failed") void start();
  }, [state, start, stop]);

  const reset = useCallback(() => {
    setError(null);
    if (canRecord()) setPhase("idle");
  }, []);

  // Stable, so a frame loop or an effect can hold them.
  const getLevel = useCallback(() => levelRef.current, []);
  const getAnalyser = useCallback(() => analyserRef.current, []);

  return {
    state,
    supported,
    error,
    start: () => void start(),
    stop,
    cancel,
    toggle,
    reset,
    getLevel,
    getAnalyser,
  };
}
