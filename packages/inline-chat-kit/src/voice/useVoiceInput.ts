"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { announce } from "../announce/announce";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";

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
 * So this records and hands over a `Blob`. What comes back is text.
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

export interface UseVoiceInputOptions {
  onTranscribe?: TranscribeHandler;
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
}

export interface VoiceInput {
  state: VoiceState;
  /** Whether a microphone can be asked for at all. */
  supported: boolean;
  /** Why it failed, when it did. Safe to show. */
  error: string | null;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  /** Forget a refusal, so the button can be offered again. */
  reset: () => void;
}

/** Level meter smoothing. Raw RMS jitters enough to read as noise. */
const SMOOTHING = 0.6;
/** Quietest signal that still moves the meter, so a silent room reads as still. */
const FLOOR = 0.02;

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
  onTranscript,
  onDone,
  meterRef,
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

  // Callbacks are read through a ref so that starting the microphone does not
  // depend on the identity of a function the host recreates every render.
  const handlers = useRef({ onTranscribe, onTranscript, onDone });
  useEffect(() => {
    handlers.current = { onTranscribe, onTranscript, onDone };
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
    recorderRef.current = null;
    meterRef?.current?.style.setProperty("--ick-voice-level", "0");
  }, [meterRef]);

  useEffect(
    () => () => {
      cancelledRef.current = true;
      abortRef.current?.abort();
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
      announce("Transcribing.");
      try {
        const text = await consume(handler(audio, { signal: controller.signal, mimeType }));
        if (controller.signal.aborted) return;
        // A recording with nothing in it is not a failure. Saying so out loud
        // is the difference between "it is broken" and "say something".
        if (!text) {
          announce("Nothing was heard.");
          setPhase("idle");
          return;
        }
        handlers.current.onTranscript?.(text);
        handlers.current.onDone?.(text);
        announce("Transcript added.");
        setPhase("idle");
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "The transcript could not be made.");
        setPhase("failed");
        announce("The transcript could not be made.", "assertive");
      } finally {
        abortRef.current = null;
      }
    },
    [consume]
  );

  const start = useCallback(async () => {
    // Support is not a phase any more — it is read straight from the platform
    // and gates whether this is reachable at all. Nothing to set here.
    if (!canRecord()) return;
    setError(null);
    cancelledRef.current = false;
    setPhase("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (cause) {
      const name = (cause as DOMException)?.name;
      // A refusal is a durable state, not a passing error: the browser will
      // not raise its prompt again, so telling the reader to try again would
      // be sending them to a button that can no longer work.
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPhase("denied");
        announce("Microphone access was refused.", "assertive");
      } else {
        setError(name === "NotFoundError" ? "No microphone was found." : "The microphone could not be opened.");
        setPhase("failed");
        announce("The microphone could not be opened.", "assertive");
      }
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new Ctor();
      audioRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      runMeter(analyser);
    } catch {
      // No meter is a lesser thing than no recording. Carry on without it.
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
      if (cancelledRef.current || audio.size === 0) {
        setPhase("idle");
        return;
      }
      void transcribe(audio, type);
    };
    recorder.start();
    setPhase("listening");
    announce("Listening.");
  }, [runMeter, teardown, transcribe]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      announce("Stopped listening.");
      recorder.stop();
      return;
    }
    // Nothing recording, so this is a cancel of whatever came after it.
    abortRef.current?.abort();
    abortRef.current = null;
    teardown();
    setPhase("idle");
  }, [teardown]);

  const toggle = useCallback(() => {
    if (state === "listening" || state === "requesting" || state === "transcribing") stop();
    else if (state === "idle" || state === "failed") void start();
  }, [state, start, stop]);

  const reset = useCallback(() => {
    setError(null);
    if (canRecord()) setPhase("idle");
  }, []);

  return {
    state,
    supported,
    error,
    start: () => void start(),
    stop,
    toggle,
    reset,
  };
}
