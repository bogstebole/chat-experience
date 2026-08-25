import { describe, it, expect, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useChatTurns, type SendHandler } from "../useChatTurns/useChatTurns";

const setup = (onSend: SendHandler, options = {}) =>
  renderHook(() => useChatTurns({ onSend, revealSpeed: 100000, sentencePause: 0, ...options }));

const firstId = (result: { current: { turns: { id: string }[] } }) => result.current.turns[0].id;

describe("useChatTurns — shape", () => {
  it("starts with one empty turn, ready for input", () => {
    const { result } = setup(() => "");
    expect(result.current.turns).toHaveLength(1);
    expect(result.current.turns[0]).toMatchObject({ user: "", ai: "", state: "idle" });
  });

  it("tracks typing through the draft", () => {
    const { result } = setup(() => "");
    act(() => result.current.setDraft(firstId(result), "hello"));
    expect(result.current.turns[0]).toMatchObject({ user: "hello", state: "typing" });
  });

  it("falls back to idle when the draft is emptied", () => {
    const { result } = setup(() => "");
    const id = firstId(result);
    act(() => result.current.setDraft(id, "hello"));
    act(() => result.current.setDraft(id, ""));
    expect(result.current.turns[0].state).toBe("idle");
  });
});

describe("useChatTurns — sending", () => {
  it("hands the message to the host app", async () => {
    const onSend = vi.fn().mockResolvedValue("an answer");
    const { result } = setup(onSend);
    const id = firstId(result);

    act(() => result.current.setDraft(id, "a question"));
    act(() => result.current.submit(id));

    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(onSend.mock.calls[0][0]).toBe("a question");
    expect(onSend.mock.calls[0][1]).toMatchObject({ turnId: id });
  });

  it("trims before sending, and refuses whitespace", () => {
    const onSend = vi.fn().mockResolvedValue("");
    const { result } = setup(onSend);
    const id = firstId(result);

    act(() => result.current.setDraft(id, "   "));
    act(() => result.current.submit(id));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows the answer and settles the turn", async () => {
    const { result } = setup(() => "the complete answer");
    const id = firstId(result);

    act(() => result.current.setDraft(id, "q"));
    act(() => result.current.submit(id));

    await waitFor(() => {
      expect(result.current.turns[0].ai).toBe("the complete answer");
      expect(result.current.turns[0].state).toBe("resting");
    });
  });

  it("opens a fresh turn once an answer completes", async () => {
    const { result } = setup(() => "done");
    const id = firstId(result);

    act(() => result.current.setDraft(id, "q"));
    act(() => result.current.submit(id));

    await waitFor(() => expect(result.current.turns).toHaveLength(2));
    expect(result.current.turns[1]).toMatchObject({ user: "", ai: "", state: "idle" });
  });
});

describe("useChatTurns — streaming", () => {
  async function* chunks() {
    yield "Particle ";
    yield "physics ";
    yield "is fun.";
  }

  it("accumulates deltas from an async iterable", async () => {
    const { result } = setup(() => chunks());
    const id = firstId(result);

    act(() => result.current.setDraft(id, "q"));
    act(() => result.current.submit(id));

    await waitFor(() => expect(result.current.turns[0].ai).toBe("Particle physics is fun."));
  });

  it("marks the turn as responding while the answer is in flight", async () => {
    let release!: (value: string) => void;
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    const { result } = setup(() => pending);
    const id = firstId(result);

    act(() => result.current.setDraft(id, "q"));
    act(() => result.current.submit(id));

    await waitFor(() => expect(result.current.turns[0].state).toBe("responding"));
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      release("finally");
    });
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
  });
});

describe("useChatTurns — stopping", () => {
  it("signals the host app to abort", async () => {
    const seen: AbortSignal[] = [];
    const { result } = setup((_msg, ctx) => {
      seen.push(ctx.signal);
      return new Promise<string>(() => {}); // never settles
    });
    const id = firstId(result);

    act(() => result.current.setDraft(id, "q"));
    act(() => result.current.submit(id));
    await waitFor(() => expect(seen).toHaveLength(1));

    act(() => result.current.stop());

    expect(seen[0].aborted).toBe(true);
  });

  it("keeps what already arrived rather than discarding it", async () => {
    let push!: (chunk: string) => void;
    let close!: () => void;
    const stream = {
      async *[Symbol.asyncIterator]() {
        const queue: string[] = [];
        let done = false;
        let wake: (() => void) | null = null;
        push = (c) => {
          queue.push(c);
          wake?.();
        };
        close = () => {
          done = true;
          wake?.();
        };
        while (!done || queue.length) {
          if (queue.length) yield queue.shift()!;
          else await new Promise<void>((r) => (wake = r));
        }
      },
    };

    const { result } = setup(() => stream);
    const id = firstId(result);
    act(() => result.current.setDraft(id, "q"));
    act(() => result.current.submit(id));

    await act(async () => {
      push("half an ");
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.turns[0].ai).toBe("half an "));

    await act(async () => {
      result.current.stop();
      close();
    });

    await waitFor(() => expect(result.current.turns[0].state).toBe("resting"));
    expect(result.current.turns[0].ai).toBe("half an ");
  });
});

describe("useChatTurns — editing", () => {
  it("restores the original text when an edit is cancelled", async () => {
    const { result } = setup(() => "answer");
    const id = firstId(result);

    act(() => result.current.setDraft(id, "original"));
    act(() => result.current.submit(id));
    await waitFor(() => expect(result.current.turns[0].state).toBe("resting"));

    act(() => result.current.beginEdit(id));
    act(() => result.current.setDraft(id, "changed my mind"));
    act(() => result.current.cancelEdit(id));

    expect(result.current.turns[0].user).toBe("original");
    expect(result.current.turns[0].state).toBe("resting");
  });

  it("regenerates in place without opening a second input", async () => {
    const { result } = setup(() => "answer");
    const id = firstId(result);

    act(() => result.current.setDraft(id, "first"));
    act(() => result.current.submit(id));
    await waitFor(() => expect(result.current.turns).toHaveLength(2));

    act(() => result.current.submit(id, "revised"));
    await waitFor(() => expect(result.current.turns[0].state).toBe("resting"));

    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[0].user).toBe("revised");
  });
});

describe("useChatTurns — render cost", () => {
  /**
   * The reason this hook exists rather than a README snippet. Updating one
   * turn must leave the others referentially untouched, so a memoised row can
   * skip rendering. Without it, every character of every answer re-renders the
   * whole conversation, and the cost grows with its length.
   */
  it("leaves untouched turns referentially identical across an update", async () => {
    const { result } = setup(() => "answer");
    const first = firstId(result);

    act(() => result.current.setDraft(first, "q1"));
    act(() => result.current.submit(first));
    await waitFor(() => expect(result.current.turns).toHaveLength(2));

    const settledTurn = result.current.turns[0];
    const secondId = result.current.turns[1].id;

    act(() => result.current.setDraft(secondId, "typing into the next one"));

    expect(result.current.turns[0]).toBe(settledTurn);
  });

  it("coalesces a burst of deltas instead of rendering each one", async () => {
    async function* burst() {
      for (let i = 0; i < 50; i++) yield "x";
    }
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useChatTurns({ onSend: () => burst() });
    });
    const id = firstId(result);

    act(() => result.current.setDraft(id, "q"));
    const before = renders;
    act(() => result.current.submit(id));
    await waitFor(() => expect(result.current.turns[0].ai).toHaveLength(50));

    // 50 deltas must not mean 50 renders; they are flushed by frame.
    expect(renders - before).toBeLessThan(50);
  });
});
