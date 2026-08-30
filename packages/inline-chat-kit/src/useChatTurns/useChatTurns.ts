"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatInputState } from "../ChatInput/ChatInput";
import { announce } from "../announce/announce";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import { mergeParts, type TurnPart, type TurnPartUpdate } from "../turnParts/turnParts";

export interface ChatTurn {
  id: string;
  /** What the person asked. */
  user: string;
  /** What has arrived of the answer so far. */
  ai: string;
  /**
   * Everything the answer is made of that is not its prose — reasoning, tool
   * calls, a plan, a question being asked. Merged by id as they arrive. See
   * `TurnPart`.
   */
  parts: TurnPart[];
  state: ChatInputState;
}

export interface SendContext {
  /** Aborted when the reader presses stop, or the component unmounts. */
  signal: AbortSignal;
  turnId: string;
}

/**
 * Produce the reply.
 *
 * Return a string for a complete answer, or an async iterable to stream one.
 * Whatever an API hands back — an SSE reader, an SDK's stream, a plain fetch —
 * fits one of those two shapes.
 *
 * A streamed item is either a **delta of the answer's prose** (a string, which
 * is appended) or a **`TurnPart`** (which is merged into the turn by its id).
 * That is what carries a model's thinking, its tool calls and its plan through
 * to the components that draw them; a stream of strings alone has nowhere to
 * put any of it.
 */
export type SendHandler = (
  message: string,
  context: SendContext
) => AsyncIterable<string | TurnPartUpdate> | Promise<string> | string;

/**
 * What a screen reader is told, and in which language.
 *
 * An answer that appears silently is an answer a blind reader never learns
 * about, so this is on by default. It is spoken once, when the answer settles
 * — never per character. A live region updated on every frame makes a screen
 * reader restart the whole answer on every frame, which is worse than silence.
 */
export interface ChatAnnouncements {
  /** Spoken when a request starts. `null` for silence. */
  responding?: string | null;
  /** Spoken when the answer settles. Return `null` for silence. */
  answer?: (text: string) => string | null;
}

export interface UseChatTurnsOptions {
  onSend: SendHandler;
  /**
   * Reveal rate for non-streaming replies, in characters per second. Streamed
   * replies are paced by whatever produced them and ignore this.
   */
  revealSpeed?: number;
  /** Pause after a full stop, in ms. Gives read-aloud rhythm to the reveal. */
  sentencePause?: number;
  /** Override the spoken strings, or pass `false` to say nothing at all. */
  announcements?: ChatAnnouncements | false;
}

export interface UseChatTurnsResult {
  turns: ChatTurn[];
  /** Report the person's editing of a turn's input. */
  setDraft: (id: string, value: string) => void;
  submit: (id: string, value?: string) => void;
  /** Abort the answer in flight and settle the turn where it stands. */
  stop: () => void;
  beginEdit: (id: string) => void;
  cancelEdit: (id: string) => void;
  isStreaming: boolean;
  /**
   * Merge a part into a turn from outside the stream.
   *
   * The stream is not the only thing that changes a part: a question the
   * assistant asked is answered by the person reading it, and that answer has
   * to land somewhere. Same merge-by-id as a streamed part.
   */
  updatePart: (turnId: string, part: TurnPartUpdate) => void;
}

const DEFAULT_REVEAL_SPEED = 260;
const DEFAULT_SENTENCE_PAUSE = 220;
const DEFAULT_RESPONDING = "Generating response";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

const emptyTurn = (): ChatTurn => ({ id: newId(), user: "", ai: "", parts: [], state: "idle" });

const isAsyncIterable = (value: unknown): value is AsyncIterable<string | TurnPartUpdate> =>
  typeof value === "object" && value !== null && Symbol.asyncIterator in value;

/**
 * Timing for a typewriter reveal, precomputed once per answer.
 *
 * Index i holds the moment character i should appear. Deriving visible length
 * from elapsed time rather than stepping a timer per character means the
 * reveal runs at the same speed on any display and survives a dropped frame
 * without falling behind.
 */
const revealSchedule = (text: string, speed: number, pause: number): number[] => {
  const perChar = 1000 / speed;
  const times = new Array<number>(text.length);
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    t += perChar;
    const c = text[i];
    if (c === "." || c === "!" || c === "?") t += pause;
    else if (c === "," || c === ";" || c === ":") t += pause * 0.35;
    times[i] = t;
  }
  return times;
};

/**
 * Owns the turn list, the request in flight, and the reveal.
 *
 * The reason this is a hook in the package rather than an example in the
 * README: writing it correctly means never updating state faster than the
 * display can show it, and leaving finished turns referentially untouched so
 * they can bail out of rendering. Both are easy to get wrong, and getting them
 * wrong is invisible until a conversation grows long.
 */
export function useChatTurns({
  onSend,
  revealSpeed = DEFAULT_REVEAL_SPEED,
  sentencePause = DEFAULT_SENTENCE_PAUSE,
  announcements,
}: UseChatTurnsOptions): UseChatTurnsResult {
  const [turns, setTurns] = useState<ChatTurn[]>(() => [emptyTurn()]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  // Text that has arrived but not yet been shown. Flushed once per frame.
  const pendingRef = useRef<Map<string, string>>(new Map());
  /* Parts wait for the same animation frame the text does. A stream that sends
     a part per token would otherwise re-render the row per token, which is the
     cost the frame batching exists to avoid. A queue rather than a map: two
     updates to one part in a single frame both have to be folded, in order. */
  const pendingPartsRef = useRef<Map<string, TurnPartUpdate[]>>(new Map());
  const editingRef = useRef<{ id: string; user: string } | null>(null);
  const onSendRef = useRef(onSend);
  // Consumers write this as an object literal, so it is a new object on every
  // render. Held in a ref rather than a dependency, or every callback below
  // would be rebuilt each render and the memoised rows would stop skipping.
  const announcementsRef = useRef(announcements);
  // A live mirror of `turns`. Reading state inside a setState updater and
  // acting on it there makes the updater impure: React is free to call it
  // twice — StrictMode does, in development — and any work scheduled from
  // inside lands a render late. Both matter here. The morph out of the input
  // is driven by `state`, so a render's delay shows up as the text lagging
  // behind the transition.
  const turnsRef = useRef(turns);

  useEffect(() => {
    onSendRef.current = onSend;
    turnsRef.current = turns;
    announcementsRef.current = announcements;
  });

  /**
   * Rewrite exactly one turn. Every other turn keeps its object identity, so a
   * memoised row sees the same props and skips rendering entirely — which is
   * what keeps the cost of streaming flat as the conversation grows.
   */
  const patchTurn = useCallback((id: string, patch: Partial<ChatTurn>) => {
    setTurns((current) => {
      let changed = false;
      const next = current.map((turn) => {
        if (turn.id !== id) return turn;
        changed = true;
        return { ...turn, ...patch };
      });
      if (!changed) return current;
      turnsRef.current = next;
      return next;
    });
  }, []);

  const flush = useCallback(() => {
    rafRef.current = null;
    const pending = pendingRef.current;
    const pendingParts = pendingPartsRef.current;
    if (pending.size === 0 && pendingParts.size === 0) return;

    const entries = [...pending];
    const partEntries = [...pendingParts];
    pending.clear();
    pendingParts.clear();

    setTurns((current) => {
      const next = current.map((turn) => {
        const text = entries.find(([id]) => id === turn.id)?.[1];
        const incoming = partEntries.find(([id]) => id === turn.id)?.[1];
        if (text === undefined && !incoming) return turn;

        return {
          ...turn,
          ...(text === undefined ? null : { ai: text }),
          ...(incoming ? { parts: incoming.reduce(mergeParts, turn.parts) } : null),
        };
      });
      turnsRef.current = next;
      return next;
    });
  }, []);

  const schedule = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(flush);
  }, [flush]);

  const publish = useCallback(
    (id: string, text: string) => {
      pendingRef.current.set(id, text);
      schedule();
    },
    [schedule]
  );

  const publishPart = useCallback(
    (id: string, part: TurnPartUpdate) => {
      const queue = pendingPartsRef.current.get(id);
      if (queue) queue.push(part);
      else pendingPartsRef.current.set(id, [part]);
      schedule();
    },
    [schedule]
  );

  const updatePart = useCallback(
    (turnId: string, part: TurnPartUpdate) => {
      publishPart(turnId, part);
    },
    [publishPart]
  );

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      abortRef.current?.abort();
    },
    []
  );

  const settle = useCallback(
    (id: string, wasEdit: boolean) => {
      setIsStreaming(false);
      abortRef.current = null;
      patchTurn(id, { state: "resting" });
      // An edited turn already has an input beneath it; a fresh answer needs one.
      if (!wasEdit) {
        setTurns((current) => {
          if (current.some((t) => t.state === "idle" && t.ai === "" && t.user === "")) {
            return current;
          }
          const next = [...current, emptyTurn()];
          turnsRef.current = next;
          return next;
        });
      }
    },
    [patchTurn]
  );

  const reveal = useCallback(
    (id: string, text: string, signal: AbortSignal) =>
      new Promise<void>((resolve) => {
        // A typewriter is an animation, and this reader has asked for fewer of
        // them. The answer arrives whole.
        if (prefersReducedMotion()) {
          publish(id, text);
          resolve();
          return;
        }

        const times = revealSchedule(text, revealSpeed, sentencePause);
        const start = performance.now();
        let shown = 0;

        const step = () => {
          if (signal.aborted) {
            // Stopping shows everything received rather than truncating it —
            // the answer arrived, only the theatre was cut short.
            publish(id, text);
            resolve();
            return;
          }
          const elapsed = performance.now() - start;
          while (shown < text.length && times[shown] <= elapsed) shown++;
          publish(id, text.slice(0, shown));
          if (shown >= text.length) {
            resolve();
            return;
          }
          requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      }),
    [publish, revealSpeed, sentencePause]
  );

  /** Route one of the two spoken moments through the live region. */
  const speak = useCallback((moment: "responding" | "answer", text = "") => {
    const config = announcementsRef.current;
    if (config === false) return;

    if (moment === "responding") {
      // `in` rather than `??`, so an explicit `null` can mean silence.
      const message = config && "responding" in config ? config.responding : DEFAULT_RESPONDING;
      if (message) announce(message);
      return;
    }

    const message = config?.answer ? config.answer(text) : text;
    if (message) announce(message);
  }, []);

  const run = useCallback(
    async (id: string, message: string, wasEdit: boolean) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      // Parts go with the old answer: regenerating a turn should not leave
      // the tool calls from the answer it replaced sitting above the new one.
      patchTurn(id, { user: message, state: "responding", ai: "", parts: [] });
      speak("responding");

      // Held out here so the announcement can read it in `finally`, whether
      // the answer completed, was stopped, or threw partway through.
      let answer = "";
      try {
        const result = onSendRef.current(message, { signal: controller.signal, turnId: id });

        if (isAsyncIterable(result)) {
          for await (const chunk of result) {
            if (controller.signal.aborted) break;
            if (typeof chunk === "string") {
              answer += chunk;
              publish(id, answer);
            } else {
              publishPart(id, chunk);
            }
          }
        } else {
          answer = (await result) ?? "";
          await reveal(id, answer, controller.signal);
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      } finally {
        flush();
        settle(id, wasEdit);
        speak("answer", answer);
      }
    },
    [flush, patchTurn, publish, publishPart, reveal, settle, speak]
  );

  const setDraft = useCallback(
    (id: string, value: string) => {
      patchTurn(id, { user: value, state: value.length > 0 ? "typing" : "idle" });
    },
    [patchTurn]
  );

  const submit = useCallback(
    (id: string, value?: string) => {
      const turn = turnsRef.current.find((t) => t.id === id);
      if (!turn) return;
      const message = (value ?? turn.user).trim();
      if (!message) return;

      // Re-submitting a turn that already has an answer regenerates it in
      // place; it must not spawn a second input below.
      const wasEdit = turn.ai.length > 0;
      editingRef.current = null;
      // Synchronous, so the turn enters `responding` in the same update as the
      // keystroke that sent it and the morph starts with the text already set.
      void run(id, message, wasEdit);
    },
    [run]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const beginEdit = useCallback(
    (id: string) => {
      const turn = turnsRef.current.find((t) => t.id === id);
      if (turn) editingRef.current = { id, user: turn.user };
      patchTurn(id, { state: "typing" });
    },
    [patchTurn]
  );

  const cancelEdit = useCallback(
    (id: string) => {
      const snapshot = editingRef.current;
      editingRef.current = null;
      patchTurn(id, {
        state: "resting",
        ...(snapshot && snapshot.id === id ? { user: snapshot.user } : {}),
      });
    },
    [patchTurn]
  );

  return { turns, setDraft, submit, stop, beginEdit, cancelEdit, isStreaming, updatePart };
}
