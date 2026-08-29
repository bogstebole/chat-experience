import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tool, type ToolState } from "../Tool/Tool";

/**
 * One tool call: what was run, what with, what came back.
 *
 * Shut by default, because most of the time nobody cares — and open when it
 * failed, because an error nobody can see has not been reported.
 */
const meta: Meta<typeof Tool> = {
  title: "Components/Tool",
  component: Tool,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Tool>;

const Wrap = ({ label, children }: { label?: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 28, maxWidth: 520 }}>
    {label && (
      <div
        style={{
          marginBottom: 8,
          fontFamily: "var(--ick-font-mono)",
          fontSize: 11,
          color: "var(--ick-ink-faint)",
        }}
      >
        {label}
      </div>
    )}
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
  </div>
);

const SEARCH_INPUT = { query: "weather in Belgrade this weekend", limit: 3 };
const SEARCH_OUTPUT = {
  results: [
    { title: "Belgrade — 7 day forecast", url: "https://example.com/rs/belgrade", rank: 1 },
    { title: "Weekend outlook, Serbia", url: "https://example.com/rs/weekend", rank: 2 },
  ],
  took_ms: 412,
};

/** The four a call can be in, shut. */
export const States: Story = {
  render: () => (
    <Wrap label="pending · running · done · error">
      <Tool name="send_email" state="pending" summary="Waiting on the draft" input={{ to: "milica@example.com" }} />
      <Tool name="search_web" state="running" summary="Searching the web" input={SEARCH_INPUT} />
      <Tool
        name="search_web"
        state="done"
        summary="3 results"
        duration={412}
        input={SEARCH_INPUT}
        output={SEARCH_OUTPUT}
      />
      <Tool
        name="run_sql"
        state="error"
        summary="Query rejected"
        duration={1173}
        input={{ statement: "select * from residents where id = $1", params: [null] }}
        error="ERROR: null value in column &quot;id&quot; violates not-null constraint"
      />
    </Wrap>
  ),
};

/** Open, with JSON on both sides. The copy button is the bar's whole job here. */
export const Open: Story = {
  render: () => (
    <Wrap label="done, opened">
      <Tool
        name="search_web"
        state="done"
        summary="3 results"
        duration={412}
        input={SEARCH_INPUT}
        output={SEARCH_OUTPUT}
        defaultOpen
      />
    </Wrap>
  ),
};

/** A string is what came back, not a program — so it is text, not a fence. */
export const TextOutput: Story = {
  render: () => (
    <Wrap label="a string output keeps its own line breaks">
      <Tool
        name="read_file"
        state="done"
        summary="42 lines"
        duration={18}
        input={{ path: "src/care-plan.md" }}
        output={"# Care plan\n\nMornings: medication at 08:00, then a walk.\nAfternoons: shopping on Tuesdays."}
        defaultOpen
      />
    </Wrap>
  ),
};

/** It opens itself, because an error nobody can see has not been reported. */
export const Failed: Story = {
  render: () => (
    <Wrap label="error — open without being asked">
      <Tool
        name="run_sql"
        state="error"
        summary="Query rejected"
        duration={1173}
        input={{ statement: "select * from residents where id = $1", params: [null] }}
        error={'ERROR: null value in column "id" violates not-null constraint\n  at parameter $1'}
      />
    </Wrap>
  ),
};

/** Nothing to open yet: the row still says what is happening. */
export const NothingToOpen: Story = {
  render: () => (
    <Wrap label="no input, no output — a row, not a control">
      <Tool name="warm_cache" state="pending" summary="Queued behind two others" />
    </Wrap>
  ),
};

const SEQUENCE: ToolState[] = ["pending", "running", "done"];

/** What it looks like as a call actually runs. */
export const Live: Story = {
  render: function Live() {
    const [step, setStep] = useState(0);
    useEffect(() => {
      const t = setInterval(() => setStep((s) => (s + 1) % (SEQUENCE.length + 1)), 1800);
      return () => clearInterval(t);
    }, []);
    const state = SEQUENCE[Math.min(step, SEQUENCE.length - 1)];
    return (
      <Wrap label="pending → running → done, on a loop">
        <Tool
          name="search_web"
          state={state}
          summary={
            state === "pending" ? "Queued" : state === "running" ? "Searching the web" : "3 results"
          }
          duration={state === "done" ? 412 : undefined}
          input={SEARCH_INPUT}
          output={state === "done" ? SEARCH_OUTPUT : undefined}
          defaultOpen
        />
      </Wrap>
    );
  },
};

/** Several in a row, which is how an agent's turn actually reads. */
export const ASequence: Story = {
  render: () => (
    <Wrap label="one turn's worth">
      <Tool name="read_file" state="done" summary="42 lines" duration={18} input={{ path: "src/care-plan.md" }} output={"# Care plan\n\nMornings: medication at 08:00."} />
      <Tool name="search_web" state="done" summary="3 results" duration={412} input={SEARCH_INPUT} output={SEARCH_OUTPUT} />
      <Tool name="write_file" state="running" summary="Writing the summary" input={{ path: "out/summary.md" }} />
    </Wrap>
  ),
};
