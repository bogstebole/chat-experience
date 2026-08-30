import type { Meta, StoryObj } from "@storybook/react-vite";
import { QuestionCard } from "../QuestionCard/QuestionCard";
import { QuestionGroup } from "../QuestionGroup/QuestionGroup";
import { Tool } from "../Tool/Tool";
import { Approval } from "../Approval/Approval";
import { Reasoning } from "../Reasoning/Reasoning";
import { ChainOfThought } from "../ChainOfThought/ChainOfThought";
import { TaskList } from "../TaskList/TaskList";
import { Sources } from "../Sources/Sources";
import type { Question } from "../QuestionCard/types";

/**
 * Everything the kit draws, next to everything else it draws.
 *
 * Not a demo — a place to catch the things that only show up in comparison: a
 * corner that does not nest the way its neighbour's does, one component
 * separating with a rule while the one above it separates with a surface, two
 * headers that are nearly the same and not quite.
 *
 * Every fault worth fixing in this kit so far was found by looking at two
 * things at once. This is where to look.
 */
const meta: Meta = {
  title: "Components/Side by side",
  parameters: { layout: "padded" },
};

export default meta;

const COLUMN = 520;

const Panel = ({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) => (
  <div style={{ width: COLUMN, flexShrink: 0 }}>
    <div
      style={{
        marginBottom: 10,
        fontFamily: "var(--ick-font-mono)",
        fontSize: 11,
        color: "var(--ick-ink)",
      }}
    >
      {label}
    </div>
    {note && (
      <div
        style={{
          marginBottom: 14,
          fontFamily: "var(--ick-font-mono)",
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--ick-ink-faint)",
          whiteSpace: "pre-line",
        }}
      >
        {note}
      </div>
    )}
    {children}
  </div>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", gap: 48, alignItems: "flex-start", flexWrap: "wrap" }}>
    {children}
  </div>
);

const QUESTION: Question = {
  id: "household",
  type: "single",
  title: "Who else lives in the household?",
  subtitle: "This tells us how much support is already around them",
  shortTitle: "Household",
  options: [
    { id: "alone", title: "They live alone", description: "Nobody else in the home" },
    { id: "partner", title: "With a partner", description: "Two in the household" },
  ],
};

const COMMAND = { command: "rm -rf Shots/", cwd: "~/Projects/chat" };

/**
 * The three that draw a box.
 *
 * What to look at: the corners, which should nest at a constant band, and the
 * surfaces, which should be ground → card → inset in all three.
 */
export const Boxes: StoryObj = {
  render: () => (
    <Row>
      <Panel
        label="QuestionGroup → QuestionCard → rows"
        note={"ground 40 → card 24 → row 16 → badge 8\nseparated by surface and gap"}
      >
        <QuestionGroup
          id="side-by-side"
          questions={[QUESTION]}
          answers={{}}
          activeIndex={0}
        />
      </Panel>

      <Panel
        label="Approval → Tool → CodeBlock"
        note={"ground 26 → card 14 → inset 6\nthe card does not float as well: it already has a ground"}
      >
        <Approval
          title="Run a command in your shell"
          description="It removes the generated screenshots."
        >
          <Tool name="bash" state="pending" input={COMMAND} defaultOpen />
        </Approval>
      </Panel>

      <Panel
        label="Tool, on its own"
        note={"card 14 → inset 6\nthe same object a question card is, lifted off the page"}
      >
        <Tool
          name="search_web"
          state="done"
          summary="2 results"
          duration={412}
          input={{ query: "higgs boson mass", limit: 3 }}
          output={{ combined_gev: 125.25 }}
          defaultOpen
        />
      </Panel>

      <Panel label="QuestionCard, on its own" note={"the card without its group"}>
        <QuestionCard question={QUESTION} number={2} state="active" />
      </Panel>
    </Row>
  ),
};

/**
 * The five with a foldable row on top.
 *
 * What to look at: the header. Glyph, label, something at the right end, a
 * chevron — five times, and the CSS behind it is written out five times too.
 * Lined up like this, the places they do not quite agree are the point.
 */
export const Disclosures: StoryObj = {
  render: () => (
    <Row>
      <Panel label="Tool" note="glyph · name · summary · duration · chevron">
        <Tool
          name="search_web"
          state="done"
          summary="2 results"
          duration={412}
          input={{ query: "higgs boson mass" }}
        />
      </Panel>

      <Panel label="Reasoning" note="glyph · label · chevron">
        <Reasoning state="done" duration={2400}>
          Two numbers matter here: the mass, and how well it is known.
        </Reasoning>
      </Panel>

      <Panel label="ChainOfThought" note="glyph · label · duration · chevron">
        <ChainOfThought
          duration={4200}
          steps={[
            { id: "a", label: "The question is about size", body: "A point particle has none." },
            { id: "b", label: "Checked the measured value", body: "125.25 GeV." },
          ]}
        />
      </Panel>

      <Panel label="TaskList" note="title · count · chevron — no glyph">
        <TaskList
          title="Plan"
          collapsible
          tasks={[
            { id: "a", label: "Read the care plan", state: "done" },
            { id: "b", label: "Find the gaps", state: "running" },
          ]}
        />
      </Panel>

      <Panel label="Sources" note="title · count · chevron — no glyph">
        <Sources
          collapsible
          defaultOpen={false}
          sources={[
            { id: "a", title: "Combined measurement", origin: "atlas.cern" },
            { id: "b", title: "Particle Data Group", origin: "pdg.lbl.gov" },
          ]}
        />
      </Panel>
    </Row>
  ),
};

/** All of them open, which is where the bodies can be compared. */
export const Opened: StoryObj = {
  render: () => (
    <Row>
      <Panel label="Tool" note="sections on the tool's ground">
        <Tool
          name="search_web"
          state="done"
          summary="2 results"
          duration={412}
          input={{ query: "higgs boson mass" }}
          defaultOpen
        />
      </Panel>

      <Panel label="ChainOfThought" note="a rail down the side: each step follows from the one above">
        <ChainOfThought
          defaultOpen
          duration={4200}
          steps={[
            { id: "a", label: "The question is about size", body: "A point particle has none." },
            { id: "b", label: "Checked the measured value", body: "125.25 GeV, to a fifth of a percent." },
          ]}
        />
      </Panel>

      <Panel label="Reasoning" note="a rule down the side: an aside">
        <Reasoning state="done" duration={2400} defaultOpen>
          {"Two numbers matter here: the mass, and how well it is known.\n\nAnd size is the wrong question for a point particle."}
        </Reasoning>
      </Panel>

      <Panel label="TaskList" note="no rail, no rule — a sequence, not a derivation">
        <TaskList
          title="Plan"
          tasks={[
            { id: "a", label: "Read the care plan", state: "done", detail: "42 lines" },
            { id: "b", label: "Find the gaps in the weekly cover", state: "running" },
            { id: "c", label: "Draft the questions" },
          ]}
        />
      </Panel>
    </Row>
  ),
};
