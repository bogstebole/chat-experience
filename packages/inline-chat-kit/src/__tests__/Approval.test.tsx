import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
});
