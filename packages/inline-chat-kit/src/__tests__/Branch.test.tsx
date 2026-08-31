import { describe, it, expect, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Branch } from "../Branch/Branch";
import { useChatTurns } from "../useChatTurns/useChatTurns";

describe("the control", () => {
  /** One answer is not a branch. "1 of 1" offers to take you nowhere. */
  it("draws nothing for a turn with one answer", () => {
    const { container } = render(<Branch total={1} index={0} onSelect={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says where you are, in words and in numbers", () => {
    render(<Branch total={3} index={1} onSelect={() => {}} />);
    expect(screen.getByRole("group", { name: "Answer 2 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("group")).toHaveTextContent("2/3");
  });

  it("walks", async () => {
    const onSelect = vi.fn();
    render(<Branch total={3} index={1} onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: "Previous answer" }));
    expect(onSelect).toHaveBeenCalledWith(0);
    await userEvent.click(screen.getByRole("button", { name: "Next answer" }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  /** The ends stop rather than wrap: there is no answer zero. */
  it.each([
    [0, "Previous answer"],
    [2, "Next answer"],
  ])("disables the arrow with nothing behind it at %s", (index, name) => {
    render(<Branch total={3} index={index} onSelect={() => {}} />);
    expect(screen.getByRole("button", { name })).toBeDisabled();
  });

  /** An index out of range is a caller's bug, not a reason to crash. */
  it.each([-4, 9])("clamps an index of %s rather than falling over", (index) => {
    render(<Branch total={3} index={index} onSelect={() => {}} />);
    expect(screen.getByRole("group")).toBeInTheDocument();
  });

  /** In an answer this sits on the highlighter's surface. */
  it("does not let a click on it start a marker", async () => {
    let started = false;
    render(
      <div onPointerDown={() => (started = true)}>
        <Branch total={2} index={0} onSelect={() => {}} />
      </div>
    );
    await userEvent.click(screen.getByRole("button", { name: "Next answer" }));
    expect(started).toBe(false);
  });
});

/**
 * The model under it.
 *
 * Regenerating used to overwrite `ai` and `parts`, which threw away the answer
 * being compared against — and comparing is the only reason to regenerate.
 */
describe("a turn's answers", () => {
  /* `revealSpeed` high and no sentence pause, so the typewriter finishes
     inside the same tick rather than leaving the answer half-written. The
     existing `useChatTurns` tests drive it the same way. */
  const setup = (onSend: Parameters<typeof useChatTurns>[0]["onSend"]) =>
    renderHook(() => useChatTurns({ onSend, revealSpeed: 100000, sentencePause: 0 }));

  const send = (text: string) => async function* () { yield text; };

  const rest = async (view: { result: { current: { turns: { state: string }[] } } }) =>
    waitFor(() => expect(view.result.current.turns[0].state).toBe("resting"));

  const answer = async (
    view: { result: { current: ReturnType<typeof useChatTurns> } },
    id: string,
    text: string
  ) => {
    act(() => view.result.current.setDraft(id, text));
    act(() => view.result.current.submit(id));
    await rest(view);
  };

  it("keeps every attempt instead of overwriting the last", async () => {
    let n = 0;
    const onSend = async function* () {
      n += 1;
      yield `answer ${n}`;
    };
    const view = setup(onSend);
    const id = view.result.current.turns[0].id;

    await answer(view, id, "a question");
    expect(view.result.current.turns[0].versions).toHaveLength(1);
    expect(view.result.current.turns[0].ai).toBe("answer 1");

    // Regenerating is the same submit on a turn that already has an answer.
    act(() => view.result.current.submit(id));
    await rest(view);

    const turn = view.result.current.turns[0];
    expect(turn.versions).toHaveLength(2);
    expect(turn.versionIndex).toBe(1);
    expect(turn.ai).toBe("answer 2");
    expect(turn.versions?.[0].ai).toBe("answer 1");
  });

  it("puts an earlier one back on screen", async () => {
    let n = 0;
    const onSend = async function* () {
      n += 1;
      yield `answer ${n}`;
    };
    const view = setup(onSend);
    const id = view.result.current.turns[0].id;

    await answer(view, id, "a question");
    act(() => view.result.current.submit(id));
    await rest(view);

    act(() => view.result.current.showVersion(id, 0));
    expect(view.result.current.turns[0].ai).toBe("answer 1");
    expect(view.result.current.turns[0].versionIndex).toBe(0);

    act(() => view.result.current.showVersion(id, 1));
    expect(view.result.current.turns[0].ai).toBe("answer 2");
  });

  /**
   * Out of range is ignored rather than clamped: a caller asking for version 7
   * of a turn with two has a bug, and quietly showing them the last one hides
   * it.
   */
  it("ignores a version that is not there", async () => {
    const view = setup(send("only one"));
    const id = view.result.current.turns[0].id;
    await answer(view, id, "a question");

    act(() => view.result.current.showVersion(id, 4));
    expect(view.result.current.turns[0].ai).toBe("only one");
    expect(view.result.current.turns[0].versionIndex).toBe(0);
  });

  /**
   * `ai` and `parts` are the answer on screen and `versions[versionIndex]` is
   * the same answer filed. Two writers for one fact is how they drift, so
   * there is one — and this is what says so.
   */
  it("keeps the shown answer and the filed one identical", async () => {
    const onSend = async function* () {
      yield { kind: "tool", id: "t", name: "search_web", state: "done" } as never;
      yield "an answer";
    };
    const view = setup(onSend);
    const id = view.result.current.turns[0].id;
    await answer(view, id, "a question");

    const turn = view.result.current.turns[0];
    expect(turn.versions?.[turn.versionIndex ?? 0].ai).toBe(turn.ai);
    expect(turn.versions?.[turn.versionIndex ?? 0].parts).toEqual(turn.parts);
    expect(turn.parts).toHaveLength(1);
  });
});
