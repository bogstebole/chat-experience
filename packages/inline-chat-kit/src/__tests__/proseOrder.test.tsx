import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import { ChatExperience } from "../ChatExperience/ChatExperience";
import { TextHighlighter } from "../TextHighlighter/TextHighlighter";
import { useChatTurns, type ChatTurn, type SendHandler } from "../useChatTurns/useChatTurns";
import type { TurnPart } from "../turnParts/turnParts";

/**
 * The answer in the order it was sent.
 *
 * Prose is one string and parts are a list, and the row used to draw the list
 * first and the string after it — so "I suggest this change:" landed under the
 * change it introduced. A part now remembers how much prose had arrived when
 * it did, and is drawn at that point.
 */

const LEAD = "Predlažem ovu izmenu:";
const TAIL = " Javi ako je u redu.";

const stream: SendHandler = async function* () {
  yield LEAD;
  yield { kind: "custom", id: "change", type: "plan-diff", data: { status: "proposed" } };
  yield TAIL;
};

describe("where a part lands", () => {
  const setup = (send: SendHandler) =>
    renderHook(() => useChatTurns({ onSend: send, announcements: false }));

  const answer = async (result: { current: ReturnType<typeof useChatTurns> }) => {
    act(() => result.current.submit(result.current.turns[0].id, "Izmeni plan"));
    await waitFor(() => expect(result.current.turns[0].state).toBe("resting"));
    return result.current.turns[0];
  };

  it("is stamped with how much prose had arrived when it did", async () => {
    const { result } = setup(stream);
    const turn = await answer(result);
    expect(turn.ai).toBe(LEAD + TAIL);
    expect(turn.parts[0]).toMatchObject({ id: "change", at: LEAD.length });
  });

  it("stays where it landed when it is updated", async () => {
    const { result } = setup(stream);
    const turn = await answer(result);
    act(() =>
      result.current.updatePart(turn.id, { kind: "custom", id: "change", data: { status: "applied" } })
    );
    await waitFor(() =>
      expect(result.current.turns[0].parts[0]).toMatchObject({ data: { status: "applied" } })
    );
    expect(result.current.turns[0].parts[0].at).toBe(LEAD.length);
  });

  it("goes at the end when a host adds it after the answer", async () => {
    const { result } = setup(stream);
    const turn = await answer(result);
    act(() => result.current.updatePart(turn.id, { kind: "notice", id: "later", text: "Dodato." }));
    await waitFor(() => expect(result.current.turns[0].parts).toHaveLength(2));
    expect(result.current.turns[0].parts[1].at).toBe((LEAD + TAIL).length);
  });

  it("keeps a position the host gave it", async () => {
    const placed: SendHandler = async function* () {
      yield LEAD;
      yield { kind: "notice", id: "first", text: "Na vrhu.", at: 0 };
    };
    const { result } = setup(placed);
    const turn = await answer(result);
    expect(turn.parts[0].at).toBe(0);
  });
});

/** The visible order: each child of the answer's body, as what it is. Prose
    is read off its words, not the block — the block also holds the keyboard
    hint a screen reader gets, which is not part of what the answer says. */
const order = (container: HTMLElement) => {
  const body = container.querySelector("article")!.children[1] as HTMLElement;
  return [...body.children].map((el) =>
    el.getAttribute("data-part") === "custom"
      ? "card"
      : (el.querySelector("[class*='tokens']")?.textContent ?? el.textContent ?? "").trim()
  );
};

const turn = (over: Partial<ChatTurn>): ChatTurn => ({
  id: "t",
  user: "Izmeni plan",
  ai: LEAD + TAIL,
  parts: [],
  state: "resting",
  ...over,
});

const card: TurnPart = { kind: "custom", id: "change", type: "plan-diff", data: {} };
const renderPart = () => <span>kartica</span>;

describe("drawing the answer in that order", () => {
  it("puts the sentence before the card it introduces, and the rest after", () => {
    const { container } = render(
      <ChatTurnRow
        turn={turn({ parts: [{ ...card, at: LEAD.length }] })}
        renderPart={renderPart}
        answerActions={false}
      />
    );
    expect(order(container)).toEqual([LEAD, "card", TAIL.trim()]);
  });

  it("draws a part with no position before the prose, as it always has", () => {
    const { container } = render(
      <ChatTurnRow turn={turn({ parts: [card] })} renderPart={renderPart} answerActions={false} />
    );
    expect(order(container)).toEqual(["card", (LEAD + TAIL).trim()]);
  });

  it("keeps the markdown whole on each side of the cut", () => {
    const ai = "Prvo **ovo**:\n\n- jedan\n- dva";
    const { container } = render(
      <ChatTurnRow
        turn={turn({ ai, parts: [{ ...card, at: "Prvo **ovo**:".length }] })}
        renderPart={renderPart}
        answerActions={false}
      />
    );
    expect(container.querySelector("strong")).toHaveTextContent("ovo");
    expect(container.querySelectorAll("li")).toHaveLength(2);
    expect(order(container)[1]).toBe("card");
  });
});

describe("the row of actions", () => {
  it("sits under the last sentence when the answer ends in prose", () => {
    const { container } = render(
      <ChatTurnRow
        turn={turn({ parts: [{ ...card, at: LEAD.length }] })}
        renderPart={renderPart}
        onRegenerate={() => {}}
      />
    );
    const copy = screen.getByRole("button", { name: "Copy answer" });
    const blocks = [...container.querySelector("article")!.children[1].children];
    expect(blocks[blocks.length - 1].contains(copy)).toBe(true);
    expect(blocks[blocks.length - 1].textContent).toContain(TAIL.trim());
  });

  /* It lived inside the prose block, so an answer made only of parts had no
     regenerate and no thumbs at all. */
  it("is there for an answer made only of parts, without a copy of nothing", () => {
    render(
      <ChatTurnRow
        turn={turn({ ai: "", parts: [card] })}
        renderPart={renderPart}
        onRegenerate={() => {}}
        onFeedback={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Regenerate" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Good answer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy answer" })).toBeNull();
  });

  it("waits for the answer to settle", () => {
    render(
      <ChatTurnRow
        turn={turn({ ai: "", parts: [card], state: "responding" })}
        renderPart={renderPart}
        onRegenerate={() => {}}
      />
    );
    expect(screen.queryByRole("button", { name: "Regenerate" })).toBeNull();
  });
});

describe("prose that is not marked", () => {
  it("is text, not a span per word", () => {
    const { container } = render(
      <TextHighlighter text="Četiri rečenice. Ovo je druga. I treća. Poslednja." marking={false} />
    );
    expect(container.querySelectorAll("[data-index]")).toHaveLength(0);
    expect(container.textContent).toBe("Četiri rečenice. Ovo je druga. I treća. Poslednja.");
  });

  it("is still a span per word when it is", () => {
    const { container } = render(<TextHighlighter text="Četiri rečenice." />);
    expect(container.querySelectorAll("[data-index]").length).toBeGreaterThan(0);
  });
});

describe('fill="container"', () => {
  it("is off by default, and on when asked", () => {
    const { container, rerender } = render(<ChatExperience onSend={() => ""} />);
    expect(container.querySelector("[data-fill]")).toBeNull();
    rerender(<ChatExperience onSend={() => ""} fill="container" />);
    expect(container.querySelector('[data-fill="container"]')).not.toBeNull();
  });

  /* The geometry is CSS and jsdom has no layout; the story is where it is
     measured. What is checked here is that neither box keeps the window's
     height once it is embedded. */
  it("takes the parent's height for both the workspace and the page", () => {
    const css = readFileSync(
      join(import.meta.dirname, "../ChatExperience/ChatExperience.module.css"),
      "utf8"
    );
    const rule = (selector: string) => {
      const at = css.indexOf(`${selector} {`);
      expect(at, `${selector} is missing`).toBeGreaterThan(-1);
      return css.slice(at, css.indexOf("}", at));
    };
    expect(rule('.workspace[data-fill="container"]')).toMatch(/height: 100%/);
    expect(rule(".fitted")).toMatch(/height: 100%/);
    expect(rule(".fitted")).toMatch(/min-height: 0/);
  });
});
