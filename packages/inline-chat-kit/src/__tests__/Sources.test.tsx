import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Sources, type Source } from "../Sources/Sources";
import { InlineCitation } from "../InlineCitation/InlineCitation";

const SOURCES: Source[] = [
  { id: "atlas", title: "Combined measurement", origin: "atlas.cern", url: "https://example.com/a", quote: "125.25 GeV." },
  { id: "pdg", title: "Particle Data Group", origin: "pdg.lbl.gov" },
];

describe("the list", () => {
  it("numbers the entries to match the markers in the text", () => {
    render(<Sources sources={SOURCES} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("1")).toBeInTheDocument();
    expect(within(items[1]).getByText("2")).toBeInTheDocument();
  });

  it("counts them, in the singular when there is one", () => {
    const { rerender } = render(<Sources sources={SOURCES} />);
    expect(screen.getByText("2 sources")).toBeInTheDocument();
    rerender(<Sources sources={[SOURCES[0]]} />);
    expect(screen.getByText("1 source")).toBeInTheDocument();
  });

  /* A row that is not a link should not be one: a keyboard lands on every
     link, and one that goes nowhere is a stop for nothing. */
  it("is a link only where there is somewhere to go", () => {
    render(<Sources sources={SOURCES} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "https://example.com/a");
    expect(links[0]).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("shows the passage a source carries, where there is one", () => {
    render(<Sources sources={SOURCES} />);
    expect(screen.getByText("125.25 GeV.")).toBeInTheDocument();
  });

  it("marks the one arrived at rather than scrolling to it", () => {
    render(<Sources sources={SOURCES} activeId="pdg" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).not.toHaveAttribute("data-active");
    expect(items[1]).toHaveAttribute("data-active");
  });

  it("reports which one was pressed, and its number", () => {
    const onSelect = vi.fn();
    render(<Sources sources={SOURCES} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("link"));
    expect(onSelect).toHaveBeenCalledWith(SOURCES[0], 1);
  });

  /* Sources are the difference between an answer somebody can check and one
     they have to trust. */
  it("is open, and is a heading rather than a control until it can fold", () => {
    render(<Sources sources={SOURCES} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("folds when it is told it may, and controls something that exists", () => {
    render(<Sources sources={SOURCES} collapsible />);
    const header = screen.getByRole("button");
    expect(header).toHaveAttribute("aria-expanded", "true");
    const id = header.getAttribute("aria-controls");
    expect(document.getElementById(id as string)).not.toBeNull();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("takes its labels in another language", () => {
    render(<Sources sources={SOURCES} labels={{ title: "Izvori", many: "izvora" }} />);
    expect(screen.getByText("Izvori")).toBeInTheDocument();
    expect(screen.getByText("2 izvora")).toBeInTheDocument();
  });
});

describe("the marker in the text", () => {
  it("says more than its number", () => {
    render(<InlineCitation index={1} source={SOURCES[0]} onSelect={() => {}} />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Source 1: Combined measurement");
  });

  it("is not a control when there is nowhere to go", () => {
    render(<InlineCitation index={1} source={SOURCES[0]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("reports the number and the source it stands for", () => {
    const onSelect = vi.fn();
    render(<InlineCitation index={2} source={SOURCES[1]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(2, SOURCES[1]);
  });

  /* The same statement the highlighter makes, so it is drawn the same way. */
  it("marks the passage it speaks for, when it is given one", () => {
    const { container, rerender } = render(<InlineCitation index={1} />);
    expect(container.querySelector("[class*='marked']")).toBeNull();

    rerender(<InlineCitation index={1}>no measurable spatial extent</InlineCitation>);
    expect(container.querySelector("[class*='marked']")).not.toBeNull();
    expect(screen.getByText("no measurable spatial extent")).toBeInTheDocument();
  });

  it("stays inline, so it wraps with the sentence around it", () => {
    const { container } = render(
      <p>
        before <InlineCitation index={1}>a passage</InlineCitation> after
      </p>
    );
    expect(container.querySelector("p")?.textContent).toBe("before a passage1 after");
  });
});
