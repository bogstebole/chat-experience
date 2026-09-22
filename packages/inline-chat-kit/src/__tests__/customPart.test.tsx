import { describe, it, expect, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { ChatExperience } from "../ChatExperience/ChatExperience";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import { mergeParts, type CustomPart, type TurnPart } from "../turnParts/turnParts";
import {
  useChatTurns,
  type ChatTurn,
  type SendHandler,
  type UseChatTurnsResult,
} from "../useChatTurns/useChatTurns";

/**
 * The host's own card, inside an answer.
 *
 * Everything else a turn carries is a component in this package. A `custom`
 * part is the one that is not: the kit keeps it in order, merges it by id and
 * hands it to `renderPart`, and draws whatever comes back where the part sits.
 */

type Plan = { status: "proposed" | "applied"; rows: number };

/* A card with nothing in it the test could mistake for anything else. */
const card = (part: CustomPart) => {
  const data = part.data as Plan;
  return (
    <div data-testid={`card-${part.id}`} data-status={data.status}>
      {part.type}: {data.status}
    </div>
  );
};

/* Prose, then a part, then the custom one between two others, then prose. */
const stream: SendHandler = async function* () {
  yield "Predlažem ";
  yield { kind: "reasoning", id: "r", text: "Dva reda se menjaju.", state: "done", duration: 1 };
  yield {
    kind: "custom",
    id: "plan",
    type: "plan-diff",
    data: { status: "proposed", rows: 2 } satisfies Plan,
  };
  yield { kind: "tool", id: "t", name: "read_plan", state: "done", duration: 1 };
  yield "ove izmene.";
};

/** Holds the conversation the way a host would, and hands it out. */
function Host({
  renderPart,
  onChat,
}: {
  renderPart: (part: CustomPart, context: { turnId: string }) => React.ReactNode;
  onChat: (chat: UseChatTurnsResult) => void;
}) {
  const chat = useChatTurns({ onSend: stream, announcements: false });
  useEffect(() => {
    onChat(chat);
  });
  return <ChatExperience chat={chat} renderPart={renderPart} headerActions={false} />;
}

const setup = () => {
  const renderPart = vi.fn<(part: CustomPart, context: { turnId: string }) => React.ReactNode>(card);
  let chat!: UseChatTurnsResult;
  const view = render(<Host renderPart={renderPart} onChat={(c) => (chat = c)} />);
  const ask = async (message: string) => {
    const id = chat.turns[chat.turns.length - 1].id;
    act(() => chat.submit(id, message));
    await waitFor(() =>
      expect(chat.turns.find((t) => t.id === id)?.state).toBe("resting")
    );
    return id;
  };
  return { view, renderPart, ask, chat: () => chat };
};

describe("a custom part", () => {
  it("merges by id, and an update carrying only data leaves the type alone", () => {
    const parts: TurnPart[] = [{ kind: "custom", id: "c", type: "plan-diff", data: { a: 1 } }];
    const next = mergeParts(parts, { kind: "custom", id: "c", data: { a: 2 } });
    expect(next[0]).toEqual({ kind: "custom", id: "c", type: "plan-diff", data: { a: 2 } });
  });

  it("arrives through the stream and is drawn in its place among the parts", async () => {
    const { ask, view } = setup();
    const id = await ask("Izmeni plan");

    const article = view.container.querySelector(`#turn-${id}`)!;
    const drawn = screen.getByTestId("card-plan");
    expect(drawn).toHaveTextContent("plan-diff: proposed");
    expect(article.contains(drawn)).toBe(true);

    /* Between the reasoning and the tool call, as streamed — not appended at
       the end, not hoisted above. */
    const wrapper = drawn.closest("[data-part='custom']")!;
    expect(wrapper).toHaveAttribute("data-part-type", "plan-diff");
    const body = wrapper.parentElement!;
    const order = [...body.children];
    const at = order.indexOf(wrapper);
    expect(order[at - 1].textContent).toMatch(/Thought/);
    expect(order[at + 1].textContent).toMatch(/read_plan/);
  });

  it("changes after the answer has finished, by id, without touching the other turns", async () => {
    const { ask, renderPart, chat } = setup();
    const first = await ask("Prvi");
    const second = await ask("Drugi");

    expect(screen.getAllByTestId("card-plan")).toHaveLength(2);
    renderPart.mockClear();

    act(() => chat().updatePart(second, { kind: "custom", id: "plan", data: { status: "applied", rows: 2 } }));

    await waitFor(() => {
      const cards = screen.getAllByTestId("card-plan");
      expect(cards.map((c) => c.dataset.status)).toEqual(["proposed", "applied"]);
    });

    /* The row that owns it drew again; the finished one above did not. */
    const turnsDrawn = renderPart.mock.calls.map(([, context]) => context.turnId);
    expect(turnsDrawn).toContain(second);
    expect(turnsDrawn).not.toContain(first);

    const updated = chat().turns.find((t) => t.id === second)!.parts.find((p) => p.id === "plan");
    expect(updated).toMatchObject({ kind: "custom", type: "plan-diff" });
  });
});

describe("without a renderer", () => {
  const turn: ChatTurn = {
    id: "t",
    user: "Pitanje",
    ai: "Odgovor",
    state: "resting",
    parts: [{ kind: "custom", id: "c", type: "plan-diff", data: {} }],
  };

  it("draws nothing, and does not throw", () => {
    const { container } = render(<ChatTurnRow turn={turn} />);
    expect(container.querySelector("[data-part='custom']")).toBeNull();
    expect(screen.getByText("Odgovor")).toBeInTheDocument();
  });

  it("draws nothing when the renderer declines", () => {
    const { container } = render(<ChatTurnRow turn={turn} renderPart={() => null} />);
    expect(container.querySelector("[data-part='custom']")).toBeNull();
  });
});
