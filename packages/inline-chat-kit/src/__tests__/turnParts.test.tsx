import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { renderHook, waitFor } from "@testing-library/react";
import { mergeParts, type TurnPart } from "../turnParts/turnParts";
import { useChatTurns } from "../useChatTurns/useChatTurns";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import type { ChatTurn } from "../useChatTurns/useChatTurns";

describe("merging a part", () => {
  it("appends one it has not seen", () => {
    const out = mergeParts([], { kind: "reasoning", id: "r1", text: "hm" });
    expect(out).toHaveLength(1);
  });

  /* The whole reason streaming one of these is bearable: send the state
     change on its own and the text that arrived before it is still there. */
  it("keeps the fields an update left out", () => {
    const first: TurnPart = { kind: "reasoning", id: "r1", text: "two numbers", state: "thinking" };
    const out = mergeParts([first], { kind: "reasoning", id: "r1", state: "done", duration: 900 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ text: "two numbers", state: "done", duration: 900 });
  });

  it("leaves the others alone, and keeps the order they arrived in", () => {
    const parts: TurnPart[] = [
      { kind: "reasoning", id: "r1", text: "hm" },
      { kind: "tool", id: "t1", name: "search_web" },
    ];
    const out = mergeParts(parts, { kind: "tool", id: "t1", name: "search_web", state: "done" });
    expect(out.map((p) => p.id)).toEqual(["r1", "t1"]);
    expect(out[0]).toBe(parts[0]);
  });
});

describe("a turn carrying parts", () => {
  it("starts with none", () => {
    const { result } = renderHook(() => useChatTurns({ onSend: () => "" }));
    expect(result.current.turns[0].parts).toEqual([]);
  });

  it("collects what the stream sends alongside the prose", async () => {
    const onSend = async function* () {
      yield { kind: "reasoning", id: "r1", text: "two numbers", state: "thinking" } as TurnPart;
      yield { kind: "tool", id: "t1", name: "search_web", state: "running" } as TurnPart;
      yield "The Higgs ";
      yield { kind: "tool", id: "t1", name: "search_web", state: "done", duration: 412 } as TurnPart;
      yield { kind: "reasoning", id: "r1", state: "done" } as TurnPart;
      yield "weighs 125 GeV.";
    };

    const { result } = renderHook(() => useChatTurns({ onSend }));
    await act(async () => {
      result.current.submit(result.current.turns[0].id, "How big is it?");
    });

    await waitFor(() => expect(result.current.turns[0].ai).toBe("The Higgs weighs 125 GeV."));
    const parts = result.current.turns[0].parts;
    expect(parts.map((p) => p.id)).toEqual(["r1", "t1"]);
    expect(parts[0]).toMatchObject({ text: "two numbers", state: "done" });
    expect(parts[1]).toMatchObject({ state: "done", duration: 412 });
  });

  /* Regenerating replaces the answer, and the tool calls that produced the old
     one are not evidence for the new one. */
  it("clears them when a turn is answered again", async () => {
    let run = 0;
    const onSend = async function* () {
      run += 1;
      if (run === 1) yield { kind: "tool", id: "t1", name: "search_web" } as TurnPart;
      yield "an answer";
    };

    const { result } = renderHook(() => useChatTurns({ onSend }));
    const id = result.current.turns[0].id;
    await act(async () => {
      result.current.submit(id, "ask");
    });
    await waitFor(() => expect(result.current.turns[0].parts).toHaveLength(1));

    await act(async () => {
      result.current.submit(id);
    });
    await waitFor(() => expect(result.current.turns[0].parts).toEqual([]));
  });

  /* A question the assistant asked is answered by the person reading it, not
     by the stream — so there has to be a way in from outside. */
  it("takes a part from outside the stream", async () => {
    const { result } = renderHook(() => useChatTurns({ onSend: () => "" }));
    const id = result.current.turns[0].id;

    await act(async () => {
      result.current.updatePart(id, { kind: "tasks", id: "p1", tasks: [{ id: "a", label: "One" }] });
    });
    await waitFor(() => expect(result.current.turns[0].parts).toHaveLength(1));

    await act(async () => {
      result.current.updatePart(id, {
        kind: "tasks",
        id: "p1",
        tasks: [{ id: "a", label: "One", state: "done" }],
      });
    });
    await waitFor(() =>
      expect(result.current.turns[0].parts[0]).toMatchObject({
        tasks: [{ id: "a", label: "One", state: "done" }],
      })
    );
  });
});

describe("the row drawing them", () => {
  const turn = (over: Partial<ChatTurn> = {}): ChatTurn => ({
    id: "t1",
    user: "How big is it?",
    ai: "",
    parts: [],
    state: "responding",
    ...over,
  });

  it("draws each kind with the component that owns it", () => {
    render(
      <ChatTurnRow
        turn={turn({
          parts: [
            { kind: "reasoning", id: "r1", text: "two numbers", state: "done", duration: 900 },
            { kind: "tool", id: "t1", name: "search_web", state: "done", summary: "3 results" },
            { kind: "tasks", id: "p1", title: "Plan", tasks: [{ id: "a", label: "Read it" }] },
          ],
        })}
      />
    );
    expect(screen.getByText("Thought for 900ms")).toBeInTheDocument();
    expect(screen.getByText("search_web")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Read it")).toBeInTheDocument();
  });

  it("reports an answer to a question it asked, rather than keeping it", () => {
    const onAnswerQuestion = vi.fn();
    render(
      <ChatTurnRow
        onAnswerQuestion={onAnswerQuestion}
        turn={turn({
          parts: [
            {
              kind: "question",
              id: "q1",
              activeIndex: 0,
              questions: [
                {
                  id: "household",
                  type: "single",
                  title: "Who else lives there?",
                  shortTitle: "Household",
                  options: [{ id: "alone", title: "They live alone" }],
                },
              ],
            },
          ],
        })}
      />
    );
    screen.getByRole("button", { name: /They live alone/ }).click();
    return vi.waitFor(() =>
      expect(onAnswerQuestion).toHaveBeenCalledWith("t1", "q1", "household", {
        optionId: "alone",
      })
    );
  });

  /* The loader stands in for an answer that has not started. Once a tool call
     or a block of reasoning is on screen, something visibly is happening. */
  it("drops the loader once a part has arrived", () => {
    const { container, rerender } = render(<ChatTurnRow turn={turn()} />);
    expect(container.querySelector("[aria-hidden='true']")).not.toBeNull();

    rerender(
      <ChatTurnRow turn={turn({ parts: [{ kind: "tool", id: "t1", name: "search_web" }] })} />
    );
    expect(screen.getByText("search_web")).toBeInTheDocument();
  });
});
