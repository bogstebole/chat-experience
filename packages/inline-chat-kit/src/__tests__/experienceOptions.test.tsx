import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatExperience } from "../ChatExperience/ChatExperience";
import { ChatInput } from "../ChatInput/ChatInput";

/**
 * Turning off what a host has no use for.
 *
 * A theme toggle on a page that has its own, a Share for a conversation with
 * no URL of its own, three menu entries that do nothing — each is a control
 * that promises something the host cannot keep. Left alone, nothing changes.
 */

const send = () => "Одговор.";

describe("the header's built-in actions", () => {
  it("are the theme toggle and Share, by default", () => {
    render(<ChatExperience onSend={send} />);
    expect(screen.getByRole("button", { name: /switch to the (dark|light) theme/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("go, both, with false", () => {
    render(<ChatExperience onSend={send} headerActions={false} />);
    expect(screen.queryByRole("button", { name: /theme/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("keep only the ones named", () => {
    render(<ChatExperience onSend={send} headerActions={["theme"]} />);
    expect(screen.getByRole("button", { name: /theme/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
  });

  it("leave the host's own actions in place", () => {
    const onClick = vi.fn();
    render(
      <ChatExperience
        onSend={send}
        headerActions={false}
        actions={[{ id: "plan", label: "Отвори план", icon: <span />, onClick }]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Отвори план" }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("the composer's menu", () => {
  it("is Add, Design and Connectors, by default", () => {
    render(<ChatExperience onSend={send} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    for (const name of ["Design", "Connectors"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("goes, with its +, when it is false", () => {
    render(<ChatExperience onSend={send} composerMenu={false} />);
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    // The composer itself is still there to type into.
    expect(document.querySelector("[contenteditable]")).toBeInTheDocument();
  });

  it("holds the host's own entries instead, and runs them", () => {
    const onSelect = vi.fn();
    const menu = [{ id: "upit", label: "Pošalji upit", onSelect }];
    render(<ChatExperience onSend={send} composerMenu={menu} />);
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.queryByRole("button", { name: "Design" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pošalji upit" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("opens the file picker for an attach entry with nothing of its own", () => {
    const { container } = render(
      <ChatInput
        state="idle"
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        menu={[{ id: "attach", label: "Priloži" }]}
      />
    );
    const picker = container.querySelector("input[type='file']") as HTMLInputElement;
    const click = vi.spyOn(picker, "click");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Priloži" }));
    expect(click).toHaveBeenCalled();
  });
});

/* Typing is not a decision; sending is. The openers went at the first
   letter, and inline the composer jumped from their column to the corner. */
describe("the openers", () => {
  const empty = { title: "Kako mogu da pomognem?", suggestions: ["Šta me čeka danas?"] };

  it("stay while somebody types, and so does the composer's column", () => {
    const { container } = render(<ChatExperience onSend={send} empty={empty} />);
    const editor = container.querySelector("[contenteditable]") as HTMLElement;
    editor.textContent = "Kada je";
    fireEvent.input(editor);
    expect(screen.getByRole("button", { name: "Šta me čeka danas?" })).toBeInTheDocument();
    expect(screen.getByText("Kako mogu da pomognem?")).toBeInTheDocument();
  });

  it("leave once a message is sent", async () => {
    const { container } = render(<ChatExperience onSend={send} empty={empty} />);
    const editor = container.querySelector("[contenteditable]") as HTMLElement;
    editor.textContent = "Kada je sledeća poseta?";
    fireEvent.input(editor);
    fireEvent.keyDown(editor, { key: "Enter" });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Šta me čeka danas?" })).toBeNull()
    );
  });
});
