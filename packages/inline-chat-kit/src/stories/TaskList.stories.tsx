import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TaskList, type Task } from "../TaskList/TaskList";

/**
 * What the agent means to do, what it is doing, and what it has finished.
 *
 * The order never changes. A list that sorted itself as work progressed would
 * move the line somebody is reading out from under them, and the sequence is
 * half of what the list is saying.
 */
const meta: Meta<typeof TaskList> = {
  title: "Components/TaskList",
  component: TaskList,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof TaskList>;

const PLAN: Task[] = [
  { id: "read", label: "Read the care plan", state: "done", detail: "42 lines" },
  { id: "meds", label: "Check the medication list against the prescription", state: "done" },
  { id: "gaps", label: "Find the gaps in the weekly cover", state: "running" },
  { id: "draft", label: "Draft the questions for the family" },
  { id: "send", label: "Send the summary" },
];

const Wrap = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 36, maxWidth: 480 }}>
    <div
      style={{
        marginBottom: 12,
        fontFamily: "var(--ick-font-mono)",
        fontSize: 11,
        color: "var(--ick-ink-faint)",
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

/** The four states a task can be in, down one list. */
export const States: Story = {
  render: () => (
    <Wrap label="done · done · running · queued · queued">
      <TaskList title="Plan" tasks={PLAN} />
    </Wrap>
  ),
};

/** Something went wrong, and the row says what. */
export const Failed: Story = {
  render: () => (
    <Wrap label="a task that failed keeps its reason">
      <TaskList
        title="Plan"
        tasks={[
          { id: "read", label: "Read the care plan", state: "done" },
          {
            id: "db",
            label: "Look up the prescription history",
            state: "error",
            detail: "No record for this resident before March",
          },
          { id: "draft", label: "Draft the questions for the family" },
        ]}
      />
    </Wrap>
  ),
};

/** Without a title there is no row above it, and nothing to fold. */
export const Bare: Story = {
  render: () => (
    <Wrap label="no title — just the steps">
      <TaskList tasks={PLAN} />
    </Wrap>
  ),
};

/** It folds itself once everything is done, and you can overrule that. */
export const FoldsWhenFinished: Story = {
  render: function FoldsWhenFinished() {
    const [tasks, setTasks] = useState<Task[]>(PLAN);
    const allDone = tasks.every((t) => t.state === "done");
    return (
      <Wrap label="press Finish — the list folds, and its row keeps the count">
        <TaskList title="Plan" tasks={tasks} collapsible />
        <button
          type="button"
          onClick={() =>
            setTasks((ts) =>
              allDone ? PLAN : ts.map((t) => ({ ...t, state: "done" as const }))
            )
          }
          style={{
            marginTop: 20,
            font: "inherit",
            fontSize: 12,
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid var(--ick-border)",
            background: "transparent",
            color: "var(--ick-ink)",
            cursor: "pointer",
          }}
        >
          {allDone ? "Start over" : "Finish everything"}
        </button>
      </Wrap>
    );
  },
};

/** How it actually reads: work moving down the list, one row at a time. */
export const Live: Story = {
  render: function Live() {
    const [at, setAt] = useState(0);
    useEffect(() => {
      const t = setInterval(() => setAt((i) => (i + 1) % (PLAN.length + 1)), 1600);
      return () => clearInterval(t);
    }, []);
    const tasks = PLAN.map((task, i) => ({
      ...task,
      state: i < at ? ("done" as const) : i === at ? ("running" as const) : ("pending" as const),
      detail: i < at ? task.detail : undefined,
    }));
    return (
      <Wrap label="the order never changes — only the glyphs do">
        <TaskList title="Plan" tasks={tasks} collapsible />
      </Wrap>
    );
  },
};
