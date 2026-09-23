import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChatExperience } from "../ChatExperience/ChatExperience";

/* A highlight needs a measurement; jsdom has no layout. See
   TextHighlighter.highlights.test.tsx. */
let rects: { mockRestore: () => void };
beforeEach(() => {
  rects = vi.spyOn(Range.prototype, "getClientRects").mockReturnValue([
    { left: 10, top: 20, width: 120, height: 16 },
  ] as unknown as DOMRectList);
});
afterEach(() => rects.mockRestore());

/**
 * Highlighting, and keeping what was highlighted — chosen in code.
 *
 * A marker over a passage is how a reader asks about one sentence rather than
 * the whole answer, and a product either works that way or it does not. So it
 * is a prop, not a control: turning it off leaves no trace of it in the
 * interface, and the answer is prose.
 */
describe("highlights and bookmarks", () => {
  const answered = (over: Partial<React.ComponentProps<typeof ChatExperience>> = {}) =>
    render(
      <ChatExperience
        onSend={() => "Odgovor."}
        headerActions={false}
        empty={{ title: "Zdravo", suggestions: ["Pitanje"] }}
        {...over}
      />
    );

  const surface = (container: HTMLElement) =>
    container.querySelector("[data-cursor]") as HTMLElement | null;

  it("marks by default: the answer is a surface with a cursor of its own", async () => {
    const { container } = answered();
    fireEvent.click(screen.getByRole("button", { name: "Pitanje" }));
    await screen.findByText(/Odgovor/, undefined, { timeout: 3000 });
    const marked = surface(container)!;
    expect(marked).toHaveAttribute("data-cursor", "marker");
    expect(marked).toHaveAttribute("tabindex", "0");
  });

  it("draws the answer as prose with highlights off, and nothing else", async () => {
    const { container } = answered({ highlights: false, selectionToggle: true });
    fireEvent.click(screen.getByRole("button", { name: "Pitanje" }));
    const answer = await screen.findByText(/Odgovor/, undefined, { timeout: 3000 });

    // The answer is still there, and still the answer.
    expect(answer).toBeInTheDocument();
    // Nothing to press, nothing to tab to, no cursor of its own.
    expect(surface(container)).toBeNull();
    expect(container.querySelector("svg[class*='canvas']")).toBeNull();
    expect(container.querySelector("[aria-describedby]")).toBeNull();
    // And the selection-mode pair goes with it: there is no mode to choose.
    expect(screen.queryByRole("group", { name: "Selection mode" })).toBeNull();
  });

  it("keeps marking and drops the keeping, with bookmarks off", async () => {
    const { container } = answered({ bookmarks: false });
    fireEvent.click(screen.getByRole("button", { name: "Pitanje" }));
    await screen.findByText(/Odgovor/, undefined, { timeout: 3000 });

    const marked = surface(container)!;
    expect(marked).toHaveAttribute("data-cursor", "marker");
    marked.focus();
    fireEvent.keyDown(marked, { key: "ArrowRight" });
    fireEvent.keyDown(marked, { key: "Enter" });
    // Marked — the menu is there — and nothing was saved.
    await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Saved highlights/ })).toBeNull();
  });

  it("offers the saved ones once there are some", async () => {
    const { container } = answered();
    fireEvent.click(screen.getByRole("button", { name: "Pitanje" }));
    await screen.findByText(/Odgovor/, undefined, { timeout: 3000 });
    const marked = surface(container)!;
    marked.focus();
    fireEvent.keyDown(marked, { key: "ArrowRight" });
    fireEvent.keyDown(marked, { key: "Enter" });
    expect(await screen.findByRole("button", { name: /Saved highlights/ })).toBeInTheDocument();
  });
});
