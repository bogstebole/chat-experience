import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Tool, formatDuration } from "../Tool/Tool";

const INPUT = { query: "weather in Belgrade", limit: 3 };

/* Not `getByRole("button")`: an open row has a copy button in it too. The
   header is the one that says what it controls. */
const header = () =>
  screen.getAllByRole("button").find((b) => b.hasAttribute("aria-expanded")) as HTMLElement;

describe("a tool call", () => {
  it("is shut, because most of the time nobody cares", () => {
    render(<Tool name="search_web" input={INPUT} output={{ ok: true }} />);
    expect(header()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Input")).toBeNull();
  });

  it("opens and shuts when the row is clicked", () => {
    render(<Tool name="search_web" input={INPUT} />);
    fireEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Input")).toBeInTheDocument();
    fireEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });

  /* aria-controls pointing at nothing is a promise the row does not keep, and
     the body only exists while it is open — so the container always does. */
  it("controls an element that is there whether it is open or not", () => {
    render(<Tool name="search_web" input={INPUT} />);
    const id = header().getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)).not.toBeNull();
  });

  it("is not a control when there is nothing to open", () => {
    render(<Tool name="warm_cache" state="pending" summary="Behind two others" />);
    expect(header()).toBeDisabled();
    expect(screen.getByText("Behind two others")).toBeInTheDocument();
  });

  it("says which state it is in, not only draws it", () => {
    const { rerender } = render(<Tool name="search_web" state="running" input={INPUT} />);
    expect(header()).toHaveAccessibleName(/Running/);
    rerender(<Tool name="search_web" state="error" error="nope" input={INPUT} />);
    expect(header()).toHaveAccessibleName(/Error|Failed|error/i);
  });

  it("shows how long it took once it has finished, and not before", () => {
    const { rerender } = render(
      <Tool name="search_web" state="running" duration={412} input={INPUT} />
    );
    expect(screen.queryByText("412ms")).toBeNull();
    rerender(<Tool name="search_web" state="done" duration={412} input={INPUT} />);
    expect(screen.getByText("412ms")).toBeInTheDocument();
  });
});

describe("failing", () => {
  it("opens itself, because an error nobody can see has not been reported", () => {
    render(<Tool name="run_sql" state="error" error="null value in column id" />);
    expect(header()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/null value in column id/)).toBeInTheDocument();
  });

  it("draws the error instead of the output, not underneath it", () => {
    render(
      <Tool name="run_sql" state="error" error="boom" output={{ rows: 12 }} />
    );
    expect(screen.getByText("boom")).toBeInTheDocument();
    expect(screen.queryByText("Output")).toBeNull();
  });

  /* An error that arrives later opens the row — unless whoever is reading has
     already had an opinion about it. Reopening under their hands to show them
     something they shut is not help. */
  it("opens on an error that arrives later", () => {
    const { rerender } = render(<Tool name="run_sql" state="running" input={INPUT} />);
    expect(header()).toHaveAttribute("aria-expanded", "false");
    rerender(<Tool name="run_sql" state="error" error="boom" input={INPUT} />);
    expect(header()).toHaveAttribute("aria-expanded", "true");
  });

  it("stays shut on an error if it was shut on purpose", () => {
    const { rerender } = render(<Tool name="run_sql" state="running" input={INPUT} />);
    fireEvent.click(header()); // open
    fireEvent.click(header()); // and shut again, deliberately
    rerender(<Tool name="run_sql" state="error" error="boom" input={INPUT} />);
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("being controlled", () => {
  it("reports the toggle and leaves the state to the host", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Tool name="search_web" open={false} onOpenChange={onOpenChange} input={INPUT} />
    );
    fireEvent.click(header());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // The host has not said yes yet, so it has not moved.
    expect(header()).toHaveAttribute("aria-expanded", "false");

    rerender(<Tool name="search_web" open onOpenChange={onOpenChange} input={INPUT} />);
    expect(header()).toHaveAttribute("aria-expanded", "true");
  });

  it("takes defaultOpen for a row that starts open and then looks after itself", () => {
    render(<Tool name="search_web" defaultOpen input={INPUT} />);
    expect(header()).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(header());
    expect(header()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("what it was given", () => {
  it("renders an object as JSON", () => {
    const { container } = render(<Tool name="search_web" input={INPUT} defaultOpen />);
    const pre = container.querySelector("pre");
    expect(pre?.textContent).toContain('"query"');
    expect(pre?.textContent).toContain("weather in Belgrade");
  });

  /* A string is what came back, not a program. Wrapped in JSON it would arrive
     in quotes with its newlines spelled out, which is worse than reading it. */
  it("renders a string as text rather than as a quoted fence", () => {
    const { container } = render(
      <Tool name="read_file" output={"line one\nline two"} defaultOpen />
    );
    expect(screen.getByText(/line one/)).toBeInTheDocument();
    expect(container.querySelector("pre")).toBeNull();
  });

  it("leaves an element alone", () => {
    render(<Tool name="chart" output={<figure data-testid="mine">a chart</figure>} defaultOpen />);
    expect(screen.getByTestId("mine")).toBeInTheDocument();
  });

  it("skips a section it was given nothing for", () => {
    render(<Tool name="search_web" input={INPUT} defaultOpen />);
    expect(screen.getByText("Input")).toBeInTheDocument();
    expect(screen.queryByText("Output")).toBeNull();
  });

  it("skips a string that is only whitespace", () => {
    render(<Tool name="search_web" input={INPUT} output="   " defaultOpen />);
    expect(screen.queryByText("Output")).toBeNull();
  });

  /* A row that throws while rendering a tool call is worse than one that
     prints something unhelpful. */
  it("survives a value JSON cannot hold", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    expect(() =>
      render(<Tool name="inspect" input={circular} defaultOpen />)
    ).not.toThrow();
  });

  it("takes its labels in another language", () => {
    render(
      <Tool
        name="search_web"
        input={INPUT}
        defaultOpen
        labels={{ input: "Ulaz", done: "Gotovo" }}
      />
    );
    expect(screen.getByText("Ulaz")).toBeInTheDocument();
    expect(header()).toHaveAccessibleName(/Gotovo/);
  });

  it("puts the running loader where the output will be", () => {
    const { container } = render(<Tool name="search_web" state="running" input={INPUT} defaultOpen />);
    const sections = container.querySelectorAll("[class*='section']");
    const output = [...sections].find((s) => within(s as HTMLElement).queryByText("Output"));
    expect(output, "no Output section while running").toBeTruthy();
    expect(output?.querySelector("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0ms"],
    [412, "412ms"],
    [999, "999ms"],
    [1000, "1.0s"],
    [1173, "1.2s"],
    [9949, "9.9s"],
    [12400, "12s"],
  ])("turns %ims into %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });

  it("says nothing about a duration it was not given", () => {
    expect(formatDuration(NaN)).toBe("");
    expect(formatDuration(-1)).toBe("");
  });
});
