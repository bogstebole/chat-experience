import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useChatTurns, type UseChatTurnsOptions } from "../useChatTurns/useChatTurns";

/**
 * The live region itself is covered in announce.test.ts. What matters here is
 * *when* the hook speaks — above all that a streamed answer is announced once
 * on arrival and not on every delta. A live region rewritten per frame makes a
 * screen reader restart the whole answer each time, which is worse than saying
 * nothing.
 */
vi.mock("../announce/announce", () => ({ announce: vi.fn() }));
import { announce } from "../announce/announce";

const spoken = () => (announce as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);

beforeEach(() => (announce as ReturnType<typeof vi.fn>).mockClear());

const setup = (options: UseChatTurnsOptions) =>
  renderHook(() => useChatTurns({ revealSpeed: 100000, sentencePause: 0, ...options }));

const send = (result: { current: { setDraft: (id: string, v: string) => void; submit: (id: string) => void; turns: { id: string }[] } }) => {
  const id = result.current.turns[0].id;
  act(() => result.current.setDraft(id, "a question"));
  act(() => result.current.submit(id));
};

describe("useChatTurns — announcements", () => {
  it("says a request is under way, then reads the answer", async () => {
    const { result } = setup({ onSend: () => "the complete answer" });
    send(result);

    await waitFor(() => expect(spoken()).toContain("the complete answer"));
    expect(spoken()).toEqual(["Generating response", "the complete answer"]);
  });

  it("reads a streamed answer once, not once per delta", async () => {
    async function* fifty() {
      for (let i = 0; i < 50; i++) yield "x";
    }
    const { result } = setup({ onSend: () => fifty() });
    send(result);

    await waitFor(() => expect(result.current.turns[0].state).toBe("resting"));
    expect(spoken()).toEqual(["Generating response", "x".repeat(50)]);
  });

  it("reads out what arrived when the reader stops it early", async () => {
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

    const { result } = setup({ onSend: () => stream });
    send(result);

    await act(async () => {
      push("half an ");
      await Promise.resolve();
    });
    await act(async () => {
      result.current.stop();
      close();
    });

    await waitFor(() => expect(spoken()).toContain("half an "));
  });

  it("says nothing at all when announcements are switched off", async () => {
    const { result } = setup({ onSend: () => "an answer", announcements: false });
    send(result);

    await waitFor(() => expect(result.current.turns[0].state).toBe("resting"));
    expect(announce).not.toHaveBeenCalled();
  });

  /** The strings are English by default; a consumer must be able to replace them. */
  it("takes the consumer's own wording", async () => {
    const { result } = setup({
      onSend: () => "the answer",
      announcements: {
        responding: "Generiše se odgovor",
        answer: (text) => `Odgovor: ${text}`,
      },
    });
    send(result);

    await waitFor(() => expect(spoken()).toContain("Odgovor: the answer"));
    expect(spoken()).toEqual(["Generiše se odgovor", "Odgovor: the answer"]);
  });

  it("stays quiet on a moment the consumer nulls out", async () => {
    const { result } = setup({
      onSend: () => "the answer",
      announcements: { responding: null },
    });
    send(result);

    await waitFor(() => expect(spoken()).toContain("the answer"));
    expect(spoken()).toEqual(["the answer"]);
  });
});
