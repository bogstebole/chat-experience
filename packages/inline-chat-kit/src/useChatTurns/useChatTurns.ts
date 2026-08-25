"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatInputState } from "../ChatInput/ChatInput";

export interface ChatTurn {
  id: string;
  /** What the person asked. */
  user: string;
  /** What has arrived of the answer so far. */
  ai: string;
  state: ChatInputState;
}

export interface SendContext {
  /** Aborted when the reader presses stop, or the component unmounts. */
  signal: AbortSignal;
  turnId: string;
}

/**
 * Produce the reply. Return a string for a complete answer, or an async
 * iterable of deltas to stream one. Whatever an API hands back — an SSE
 * reader, an SDK's stream, a plain fetch — fits one of those two shapes.
 */
export type SendHandler = (
  message: string,
  context: SendContext
) => AsyncIterable<string> | Promise<string> | string;

export interface UseChatTurnsOptions {
  onSend: SendHandler;
  /**
   * Reveal rate for non-streaming replies, in characters per second. Streamed
   * replies are paced by whatever produced them and ignore this.
   */
  revealSpeed?: number;
  /** Pause after a full stop, in ms. Gives read-aloud rhythm to the reveal. */
  sentencePause?: number;
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
}

const DEFAULT_REVEAL_SPEED = 260;
const DEFAULT_SENTENCE_PAUSE = 220;

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 11);

const emptyTurn = (): ChatTurn => ({ id: newId(), user: "", ai: "", state: "idle" });

const isAsyncIterable = (value: unknown): value is AsyncIterable<string> =>
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
}: UseChatTurnsOptions): UseChatTurnsResult {
  const [turns, setTurns] = useState<ChatTurn[]>(() => [emptyTurn()]);
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const rafRef = useRef<number | null>(null);
  // Text that has arrived but not yet been shown. Flushed once per frame.
  const pendingRef = useRef<Map<string, string>>(new Map());
  const editingRef = useRef<{ id: string; user: string } | null>(null);
  const onSendRef = useRef(onSend);
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
    if (pending.size === 0) return;
    const entries = [...pending];
    pending.clear();
    setTurns((current) => {
      const next = current.map((turn) => {
        const text = entries.find(([id]) => id === turn.id)?.[1];
        return text === undefined ? turn : { ...turn, ai: text };
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

  const run = useCallback(
    async (id: string, message: string, wasEdit: boolean) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      patchTurn(id, { user: message, state: "responding", ai: "" });

      try {
        const result = onSendRef.current(message, { signal: controller.signal, turnId: id });

        if (isAsyncIterable(result)) {
          let text = "";
          for await (const chunk of result) {
            if (controller.signal.aborted) break;
            text += chunk;
            publish(id, text);
          }
        } else {
          const text = await result;
          await reveal(id, text ?? "", controller.signal);
        }
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      } finally {
        flush();
        settle(id, wasEdit);
      }
    },
    [flush, patchTurn, publish, reveal, settle]
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

  return { turns, setDraft, submit, stop, beginEdit, cancelEdit, isStreaming };
}
