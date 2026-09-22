import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { ChatExperience, type ChatExperienceProps } from "../ChatExperience/ChatExperience";
import { ArtifactPane } from "../Artifact/ArtifactPane";
import { useChatTurns, type SendHandler, type UseChatTurnsResult } from "../useChatTurns/useChatTurns";
import type { CustomPart, CustomPartContext } from "../turnParts/turnParts";

/**
 * A pane the host draws itself.
 *
 * `ChatExperience` places its pane beside the conversation, and that is right
 * until the host has a layout of its own — a column of its own, a drawer, a
 * route. Then the kit has to be able to keep out of the way: no pane, no room
 * made for one, and every way of opening an artifact reported instead.
 */

const stream: SendHandler = async function* () {
  yield { kind: "artifact", id: "plan", title: "Plan nege", content: "Ponedeljak…" };
  yield { kind: "custom", id: "nurse", type: "caregiver", data: { name: "Jelena" } };
  yield "Evo plana.";
};

/* A card that opens a profile, the way the host's would. */
const renderPart = (part: CustomPart, context: CustomPartContext) =>
  part.type === "caregiver" ? (
    <div>
      <button type="button" onClick={() => context.openArtifact("profile-jelena")}>
        Jelena
      </button>
      <button type="button" onClick={context.closeArtifact}>
        Zatvori profil
      </button>
    </div>
  ) : null;

function Host(props: Partial<ChatExperienceProps> & { onChat?: (chat: UseChatTurnsResult) => void }) {
  const { onChat, ...rest } = props;
  const chat = useChatTurns({ onSend: stream, announcements: false });
  useEffect(() => {
    onChat?.(chat);
  });
  return <ChatExperience chat={chat} renderPart={renderPart} headerActions={false} {...rest} />;
}

const answer = async (chat: () => UseChatTurnsResult) => {
  const id = chat().turns[0].id;
  act(() => chat().submit(id, "Napravi plan"));
  await waitFor(() => expect(chat().turns[0].state).toBe("resting"));
};

const card = () => screen.getByRole("button", { name: /Plan nege/ });

describe('pane="none"', () => {
  it("draws no pane and makes no room for one, even with an artifact open", async () => {
    let chat!: UseChatTurnsResult;
    const artifact = vi.fn(() => ({ title: "Plan nege", children: "sadržaj" }));
    const { container } = render(
      <Host
        pane="none"
        openArtifactId="plan"
        artifact={artifact}
        onChat={(c) => (chat = c)}
      />
    );
    await answer(() => chat);

    // No room: the layout carries `data-pane` only while a pane is in it.
    expect(container.querySelector("[data-pane]")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    // And it is not even asked what would go in one.
    expect(artifact).not.toHaveBeenCalled();
    // The card still says it is the open one.
    expect(card()).toHaveAttribute("aria-expanded", "true");
  });

  it("reports a pressed card instead of opening anything, and follows openArtifactId", async () => {
    let chat!: UseChatTurnsResult;
    const onOpenArtifactChange = vi.fn();
    const { rerender } = render(
      <Host
        pane="none"
        openArtifactId={null}
        onOpenArtifactChange={onOpenArtifactChange}
        onChat={(c) => (chat = c)}
      />
    );
    await answer(() => chat);

    fireEvent.click(card());
    expect(onOpenArtifactChange).toHaveBeenLastCalledWith("plan");
    // Held by the host, so nothing changes until the host says so.
    expect(card()).toHaveAttribute("aria-expanded", "false");

    rerender(
      <Host
        pane="none"
        openArtifactId="plan"
        onOpenArtifactChange={onOpenArtifactChange}
        onChat={(c) => (chat = c)}
      />
    );
    expect(card()).toHaveAttribute("aria-expanded", "true");

    // Pressed again, it asks for it to close.
    fireEvent.click(card());
    expect(onOpenArtifactChange).toHaveBeenLastCalledWith(null);
  });
});

describe("a custom card and the pane", () => {
  it("opens and closes an artifact through renderPart's context", async () => {
    let chat!: UseChatTurnsResult;
    const onOpenArtifactChange = vi.fn();
    render(
      <Host pane="none" onOpenArtifactChange={onOpenArtifactChange} onChat={(c) => (chat = c)} />
    );
    await answer(() => chat);

    fireEvent.click(screen.getByRole("button", { name: "Jelena" }));
    expect(onOpenArtifactChange).toHaveBeenLastCalledWith("profile-jelena");
    fireEvent.click(screen.getByRole("button", { name: "Zatvori profil" }));
    expect(onOpenArtifactChange).toHaveBeenLastCalledWith(null);
  });

  it("opens the kit's own pane when the kit is drawing it", async () => {
    let chat!: UseChatTurnsResult;
    render(
      <Host
        artifact={(id) => ({ title: id === "profile-jelena" ? "Jelena" : "Plan nege", children: "…" })}
        onChat={(c) => (chat = c)}
      />
    );
    await answer(() => chat);
    expect(screen.queryByRole("complementary")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Jelena" }));
    const pane = await screen.findByRole("complementary", { name: "Jelena" });
    expect(pane).toBeInTheDocument();
  });
});

describe("the default, unchanged", () => {
  it("keeps its own state and draws the pane beside the conversation", async () => {
    let chat!: UseChatTurnsResult;
    const { container } = render(
      <Host artifact={() => ({ title: "Plan nege", children: "sadržaj" })} onChat={(c) => (chat = c)} />
    );
    await answer(() => chat);
    fireEvent.click(card());
    await screen.findByRole("complementary", { name: "Plan nege" });
    expect(container.querySelector("[data-pane]")).not.toBeNull();
    expect(card()).toHaveAttribute("aria-expanded", "true");
  });
});

describe("ArtifactPane in the host's own column", () => {
  /* The way a host draws it: its own state, its own column, keyed by id so a
     different artifact is a new pane — and a new pane is focus moved again. */
  function Column() {
    const [open, setOpen] = useState<string | null>(null);
    return (
      <div style={{ display: "flex" }}>
        <button type="button" onClick={() => setOpen("a")}>
          Otvori A
        </button>
        <button type="button" onClick={() => setOpen("b")}>
          Otvori B
        </button>
        {open && (
          <ArtifactPane key={open} title={`Dokument ${open}`} onClose={() => setOpen(null)}>
            sadržaj
          </ArtifactPane>
        )}
      </div>
    );
  }

  it("puts focus on its title when it opens, and is a region rather than a dialog", async () => {
    render(<Column />);
    fireEvent.click(screen.getByRole("button", { name: "Otvori A" }));
    const pane = screen.getByRole("complementary", { name: "Dokument a" });
    expect(pane).not.toHaveAttribute("aria-modal");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Dokument a" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Otvori B" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Dokument b" })).toHaveFocus());
  });

  it("does not hold focus or take Escape when it is not modal", () => {
    render(<Column />);
    fireEvent.click(screen.getByRole("button", { name: "Otvori A" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("complementary")).toBeInTheDocument();
    screen.getByRole("button", { name: "Otvori B" }).focus();
    expect(screen.getByRole("button", { name: "Otvori B" })).toHaveFocus();
  });
});
