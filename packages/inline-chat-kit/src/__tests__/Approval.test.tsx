import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Approval } from "../Approval/Approval";
import { ChatTurnRow } from "../ChatTurnRow/ChatTurnRow";
import type { ChatTurn } from "../useChatTurns/useChatTurns";

describe("while it is asking", () => {
  it("offers three answers, because yes and yes-forever are not the same one", () => {
    render(<Approval title="Run a command" />);
    expect(screen.getByRole("button", { name: "Allow once" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Always allow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deny" })).toBeInTheDocument();
  });

  it("reports which one was given", () => {
    const onDecide = vi.fn();
    render(<Approval title="Run a command" onDecide={onDecide} />);
    fireEvent.click(screen.getByRole("button", { name: "Always allow" }));
    expect(onDecide).toHaveBeenCalledWith("always");
  });

  /* Somebody deciding needs to see what they are deciding about. */
  it("draws whatever it was given to show", () => {
    render(
      <Approval title="Run a command">
        <code data-testid="subject">rm -rf Shots/</code>
      </Approval>
    );
    expect(screen.getByTestId("subject")).toBeInTheDocument();
  });

  it("is named by what it is asking", () => {
    render(<Approval title="Run a command in your shell" />);
    expect(screen.getByRole("region", { name: "Run a command in your shell" })).toBeInTheDocument();
  });

  it("offers nothing when nothing can be decided from here", () => {
    render(<Approval title="Run a command" readOnly />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("once it is decided", () => {
  /* Live buttons under a decision already made invite a second one that
     contradicts the first. */
  it.each([
    ["once", "Allowed once"],
    ["always", "Allowed from now on"],
    ["denied", "Denied"],
  ] as const)("stops being a set of buttons and says what was decided: %s", (decision, said) => {
    render(<Approval title="Run a command" decision={decision} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(said)).toBeInTheDocument();
  });

  it("stops looking like something that is asking", () => {
    const { container, rerender } = render(<Approval title="Run a command" />);
    expect(container.firstElementChild).not.toHaveAttribute("data-decision");
    rerender(<Approval title="Run a command" decision="once" />);
    expect(container.firstElementChild).toHaveAttribute("data-decision", "once");
  });

  it("takes its labels in another language", () => {
    const { rerender } = render(
      <Approval title="Pokreni komandu" labels={{ once: "Dozvoli jednom" }} />
    );
    expect(screen.getByRole("button", { name: "Dozvoli jednom" })).toBeInTheDocument();
    rerender(
      <Approval title="Pokreni komandu" decision="denied" labels={{ wasDenied: "Odbijeno" }} />
    );
    expect(screen.getByText("Odbijeno")).toBeInTheDocument();
  });
});

describe("as a part of a turn", () => {
  const turn = (over: Partial<ChatTurn> = {}): ChatTurn => ({
    id: "t1",
    user: "Delete the screenshots",
    ai: "",
    parts: [],
    state: "responding",
    ...over,
  });

  it("draws the tool it names, unrun", () => {
    render(
      <ChatTurnRow
        turn={turn({
          parts: [
            {
              kind: "approval",
              id: "ask",
              title: "Run a command in your shell",
              tool: { name: "bash", input: { command: "rm -rf Shots/" } },
            },
          ],
        })}
      />
    );
    expect(screen.getByText("Run a command in your shell")).toBeInTheDocument();
    expect(screen.getByText("bash")).toBeInTheDocument();
    expect(screen.getByText(/rm -rf/)).toBeInTheDocument();
  });

  it("reports the decision rather than keeping it", () => {
    const onDecideApproval = vi.fn();
    render(
      <ChatTurnRow
        onDecideApproval={onDecideApproval}
        turn={turn({ parts: [{ kind: "approval", id: "ask", title: "Run a command" }] })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onDecideApproval).toHaveBeenCalledWith("t1", "ask", "denied");
  });

  /**
   * Every glyph in this kit carries state and pairs with a word for anybody the
   * picture is not reaching — queued, running, failed, allowed, denied. The
   * shield carried a *category*, next to a title that says it in words, above a
   * card that shows the thing and three buttons that are visibly a decision.
   *
   * It was also drawn at 24 against everything else's 14, because the badge box
   * it was meant to sit *in* had been applied to the icon itself. Which is how
   * it came up: it looked too big, and the answer to "how big should it be" was
   * that it should not be there.
   */
  it("draws nothing in the head but the words", () => {
    const { container } = render(
      <Approval title="Run a command in your shell" description="Nothing else is touched." />
    );
    const head = container.querySelector("[class*='head']");
    expect(head, "the head is missing").toBeTruthy();
    expect(head?.querySelectorAll("svg")).toHaveLength(0);
  });

  /** The one that stays, because it says which way it went. */
  it("keeps the glyph that carries the decision", () => {
    for (const decision of ["once", "always", "denied"] as const) {
      const { container, unmount } = render(
        <Approval title="Run a command" decision={decision} />
      );
      const settled = container.querySelector("[class*='settled']");
      expect(settled?.querySelectorAll("svg"), decision).toHaveLength(1);
      unmount();
    }
  });
});

/**
 * Two answers, where "from now on" means nothing.
 *
 * Applying one edit to a plan happens once; a standing permission to apply
 * edits nobody has seen yet is not something anybody is being asked for. So
 * the button that offers it can be left out — and nothing else about the
 * approval moves: Allow once is still the primary, Deny is still first.
 */
describe("with only two choices", () => {
  const TWO = ["once", "deny"] as const;

  it("offers the two it was given and not the third", () => {
    render(<Approval title="Primeni izmenu" choices={[...TWO]} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Always allow" })).toBeNull();
  });

  it("keeps Allow once as the primary", () => {
    render(<Approval title="Primeni izmenu" choices={[...TWO]} />);
    const once = screen.getByRole("button", { name: "Allow once" });
    const deny = screen.getByRole("button", { name: "Deny" });
    expect(once.className).not.toBe(deny.className);
    // The same button the three-way approval makes primary.
    const { container } = render(<Approval title="Tri" />);
    const primary = [...container.querySelectorAll("button")].find(
      (b) => b.textContent === "Allow once"
    )!;
    expect(once.className).toBe(primary.className);
  });

  it("puts Deny first, so the keyboard reaches the safe answer first", async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    render(<Approval title="Primeni izmenu" choices={[...TWO]} onDecide={onDecide} />);

    const [first, second] = screen.getAllByRole("button");
    expect(first).toHaveTextContent("Deny");
    expect(second).toHaveTextContent("Allow once");

    await user.tab();
    expect(first).toHaveFocus();
    await user.tab();
    expect(second).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onDecide).toHaveBeenCalledWith("once");
  });

  it("settles into a record of what was decided, and nothing it did not offer", () => {
    const { container, rerender } = render(
      <Approval title="Primeni izmenu" choices={[...TWO]} />
    );
    expect(container.firstElementChild).not.toHaveAttribute("data-decision");

    rerender(<Approval title="Primeni izmenu" choices={[...TWO]} decision="once" />);
    expect(container.firstElementChild).toHaveAttribute("data-decision", "once");
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Allowed once")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/from now on|Always/);

    rerender(<Approval title="Primeni izmenu" choices={[...TWO]} decision="denied" />);
    expect(container.firstElementChild).toHaveAttribute("data-decision", "denied");
    expect(screen.getByText("Denied")).toBeInTheDocument();
  });

  it("carries the choices as a part", () => {
    const onDecideApproval = vi.fn();
    render(
      <ChatTurnRow
        onDecideApproval={onDecideApproval}
        turn={{
          id: "t1",
          user: "Izmeni plan",
          ai: "",
          state: "responding",
          parts: [{ kind: "approval", id: "ask", title: "Primeni izmenu", choices: [...TWO] }],
        }}
      />
    );
    expect(screen.queryByRole("button", { name: "Always allow" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));
    expect(onDecideApproval).toHaveBeenCalledWith("t1", "ask", "once");
  });
});
