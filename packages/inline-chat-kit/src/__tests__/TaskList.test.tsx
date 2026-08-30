import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TaskList, type Task } from "../TaskList/TaskList";

const PLAN: Task[] = [
  { id: "read", label: "Read the care plan", state: "done" },
  { id: "gaps", label: "Find the gaps", state: "running" },
  { id: "draft", label: "Draft the questions" },
];

const items = () => screen.getAllByRole("listitem");

describe("what the list shows", () => {
  it("keeps the order it was given, whatever state anything is in", () => {
    render(<TaskList tasks={PLAN} />);
    expect(items().map((li) => li.textContent)).toEqual([
      "Read the care planDone",
      "Find the gapsIn progress",
      "Draft the questionsQueued",
    ]);
  });

  /* Which is the point: sorting by state would move the line somebody is
     reading out from under them, and the sequence is half of what the list is
     saying. */
  it("does not reorder when a task finishes", () => {
    const { rerender } = render(<TaskList tasks={PLAN} />);
    const before = items().map((li) => li.getAttribute("data-state"));
    expect(before).toEqual(["done", "running", "pending"]);

    rerender(
      <TaskList
        tasks={[
          { id: "read", label: "Read the care plan", state: "done" },
          { id: "gaps", label: "Find the gaps", state: "done" },
          { id: "draft", label: "Draft the questions", state: "running" },
        ]}
      />
    );
    expect(items().map((li) => li.textContent?.split(/(?=Done|In progress|Queued)/)[0])).toEqual([
      "Read the care plan",
      "Find the gaps",
      "Draft the questions",
    ]);
  });

  it("says which one it is on, in a way that can be jumped to", () => {
    render(<TaskList tasks={PLAN} />);
    const current = items().filter((li) => li.getAttribute("aria-current") === "step");
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toContain("Find the gaps");
  });

  it("says each state in words, not only in a glyph", () => {
    render(<TaskList tasks={PLAN} />);
    expect(within(items()[0]).getByText("Done")).toBeInTheDocument();
    expect(within(items()[2]).getByText("Queued")).toBeInTheDocument();
  });

  it("treats a task with no state as queued", () => {
    render(<TaskList tasks={[{ id: "a", label: "Something" }]} />);
    expect(items()[0]).toHaveAttribute("data-state", "pending");
  });

  it("shows a detail where there is one, and nothing where there is not", () => {
    render(
      <TaskList
        tasks={[
          { id: "a", label: "Read it", state: "done", detail: "42 lines" },
          { id: "b", label: "Write it" },
        ]}
      />
    );
    expect(screen.getByText("42 lines")).toBeInTheDocument();
    expect(items()[1].textContent).toBe("Write itQueued");
  });
});

describe("the row above it", () => {
  it("counts what is finished", () => {
    render(<TaskList title="Plan" tasks={PLAN} />);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("is a heading rather than a control when there is nothing to fold", () => {
    render(<TaskList title="Plan" tasks={PLAN} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Plan")).toBeInTheDocument();
  });

  it("is left out entirely without a title", () => {
    render(<TaskList tasks={PLAN} />);
    expect(screen.queryByText(/of 3/)).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("takes its labels in another language", () => {
    render(
      <TaskList
        title="Plan"
        tasks={PLAN}
        labels={{ progress: "{done}/{total}", done: "Gotovo", running: "U toku" }}
      />
    );
    expect(screen.getByText("1/3")).toBeInTheDocument();
    expect(within(items()[0]).getByText("Gotovo")).toBeInTheDocument();
    expect(within(items()[1]).getByText("U toku")).toBeInTheDocument();
  });
});

describe("folding", () => {
  const allDone = PLAN.map((t) => ({ ...t, state: "done" as const }));

  it("stays open while there is work left", () => {
    render(<TaskList title="Plan" tasks={PLAN} collapsible />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  /* A plan is worth watching while it runs and worth little afterwards. */
  it("folds itself once everything is done", () => {
    const { rerender } = render(<TaskList title="Plan" tasks={PLAN} collapsible />);
    rerender(<TaskList title="Plan" tasks={allDone} collapsible />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("stays where somebody put it, however the work goes after that", () => {
    const { rerender } = render(<TaskList title="Plan" tasks={PLAN} collapsible />);
    fireEvent.click(screen.getByRole("button")); // shut it
    rerender(<TaskList title="Plan" tasks={allDone} collapsible />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button")); // and open it again
    rerender(<TaskList title="Plan" tasks={PLAN} collapsible />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("does not fold at all when it was not asked to", () => {
    render(<TaskList title="Plan" tasks={allDone} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("controls an element that is there whether it is open or shut", () => {
    render(<TaskList title="Plan" tasks={allDone} collapsible />);
    const id = screen.getByRole("button").getAttribute("aria-controls");
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)).not.toBeNull();
  });

  it("reports the toggle and leaves the state to the host when controlled", () => {
    const onOpenChange = vi.fn();
    render(
      <TaskList title="Plan" tasks={PLAN} collapsible open={false} onOpenChange={onOpenChange} />
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "false");
  });

  it("counts nothing as finished in an empty list, and does not fold it", () => {
    render(<TaskList title="Plan" tasks={[]} collapsible />);
    expect(screen.getByText("0 of 0")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });
});
