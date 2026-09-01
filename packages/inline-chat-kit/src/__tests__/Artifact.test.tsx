import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { ArtifactCard } from "../Artifact/ArtifactCard";
import { ArtifactPane } from "../Artifact/ArtifactPane";
import { ChatLayout } from "../Artifact/ChatLayout";
import { useArtifacts } from "../Artifact/useArtifacts";

const LINES = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join("\n");

describe("ArtifactCard", () => {
  it("is a window, not the thing", () => {
    const { container } = render(
      <ArtifactCard id="a" title="5k training plan" kind="text" content={LINES} lines={4} />
    );
    expect(screen.getByText(/line 4/)).toBeInTheDocument();
    expect(screen.queryByText(/line 5/)).not.toBeInTheDocument();
    /* And it says there was more, which is the whole job of the fade. */
    expect(container.querySelector("[data-more]")).toBeInTheDocument();
  });

  it("does not claim there is more when there is not", () => {
    const { container } = render(
      <ArtifactCard id="a" title="Short" kind="text" content={"one\ntwo"} lines={8} />
    );
    expect(container.querySelector("[data-more]")).not.toBeInTheDocument();
  });

  /* A record of an artifact and a way into one are different things, and the
     difference is whether anybody can open it. */
  it("is a control only when it can be opened", () => {
    const { rerender } = render(<ArtifactCard id="a" title="Plan" content="x" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    rerender(<ArtifactCard id="a" title="Plan" content="x" onOpen={() => {}} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("hands back its own id, so one handler serves every card", () => {
    const onOpen = vi.fn();
    render(<ArtifactCard id="plan" title="Plan" content="x" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledWith("plan");
  });

  /* The card stays where it is and says which one the pane is showing —
     otherwise the pane is the only thing that knows. */
  it("marks itself while its pane is the one on screen", () => {
    const { container, rerender } = render(
      <ArtifactCard id="a" title="Plan" content="x" onOpen={() => {}} />
    );
    expect(container.querySelector("[data-open]")).not.toBeInTheDocument();
    rerender(<ArtifactCard id="a" title="Plan" content="x" onOpen={() => {}} open />);
    expect(container.querySelector("[data-open]")).toBeInTheDocument();
  });

  it("shimmers the name while it is still being written", () => {
    const { container } = render(<ArtifactCard id="a" title="Plan" state="writing" />);
    expect(container.querySelector("[data-writing]")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });
});

describe("useArtifacts", () => {
  it("holds one at a time", () => {
    const { result } = renderHook(() => useArtifacts());
    expect(result.current.openId).toBeNull();
    act(() => result.current.open("a"));
    expect(result.current.openId).toBe("a");
    act(() => result.current.open("b"));
    expect(result.current.openId).toBe("b");
    act(() => result.current.close());
    expect(result.current.openId).toBeNull();
  });

  it("closes the one already open when its card is pressed again", () => {
    const { result } = renderHook(() => useArtifacts());
    act(() => result.current.toggle("a"));
    expect(result.current.openId).toBe("a");
    act(() => result.current.toggle("a"));
    expect(result.current.openId).toBeNull();
  });
});

describe("ArtifactPane", () => {
  /* An artifact usually arrives before it is finished. A pane that opens empty
     reads as broken rather than as early. */
  it("shows a skeleton until there is something to read", () => {
    const { container, rerender } = render(<ArtifactPane title="Plan" />);
    expect(container.querySelector("[class*='skeleton']")).toBeInTheDocument();
    rerender(<ArtifactPane title="Plan">Week 1</ArtifactPane>);
    expect(container.querySelector("[class*='skeleton']")).not.toBeInTheDocument();
    expect(screen.getByText("Week 1")).toBeInTheDocument();
  });

  /* The part worth having in a library. Without it a keyboard reader is left
     behind in the conversation with no idea anything opened. */
  it("puts a reader down on what the pane is", () => {
    render(<ArtifactPane title="5k training plan" />);
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "5k training plan" })
    );
  });

  it("names itself with that heading", () => {
    render(<ArtifactPane title="5k training plan" />);
    expect(screen.getByLabelText("5k training plan")).toBeInTheDocument();
  });

  /* Beside the conversation it is a region; covering it, it is a dialog. The
     difference is not decoration — it is whether there is anything usable
     behind it. */
  it("is only a dialog when it is covering the conversation", () => {
    const { rerender } = render(<ArtifactPane title="Plan" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    /* Beside the conversation it is a region somebody can move to on purpose,
       which is what `complementary` is for. */
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    rerender(<ArtifactPane title="Plan" modal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("answers Escape only when it is covering the conversation", () => {
    const onClose = vi.fn();
    const { rerender } = render(<ArtifactPane title="Plan" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose, "beside the chat, Escape belongs to the chat").not.toHaveBeenCalled();

    rerender(<ArtifactPane title="Plan" onClose={onClose} modal />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when asked", () => {
    const onClose = vi.fn();
    render(<ArtifactPane title="Plan" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("has no close control when there is nothing to close it with", () => {
    render(<ArtifactPane title="Plan" />);
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });
});

describe("ChatLayout", () => {
  it("draws the conversation on its own when nothing is open", () => {
    render(
      <ChatLayout pane={() => null}>
        <p>the conversation</p>
      </ChatLayout>
    );
    expect(screen.getByText("the conversation")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  /* The pane is told how much room it has, which is the only thing it needs
     from the layout — and the reason `modal` is a prop rather than a guess. */
  it("tells the pane whether it is covering the conversation", () => {
    const pane = vi.fn(() => null);
    render(<ChatLayout pane={pane}>chat</ChatLayout>);
    expect(pane).toHaveBeenCalledWith({ narrow: expect.any(Boolean) });
  });

  it("puts the pane beside the conversation", () => {
    render(
      <ChatLayout pane={() => <ArtifactPane title="Plan" />}>
        <p>the conversation</p>
      </ChatLayout>
    );
    expect(screen.getByText("the conversation")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
  });
});
