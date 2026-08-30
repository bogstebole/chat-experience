import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  QuestionBadge,
  QuestionFieldRow,
  QuestionOptionRow,
  QuestionOtherRow,
  QuestionShell,
} from "../QuestionCard/parts";
import { Button } from "../Button/Button";

/**
 * The parts a `QuestionCard` is built from.
 *
 * The kit ships three question shapes. They are not the only three, so the
 * rows and the shell around them are public — a fourth is a composition rather
 * than a fork, and it arrives already wearing the same tokens as the rest.
 */
const meta: Meta = {
  title: "Components/Question parts",
  parameters: { layout: "padded" },
};

export default meta;

const Ground = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div style={{ marginBottom: 32, maxWidth: 520 }}>
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
    <div
      /* The ground, off the kit's tokens rather than out of two numbers.
         Hand-rolled, it read 16 and 24 — a ground padded like a ground and
         cornered like the card standing on it, which is the crescent the
         concentric rule exists to close. It is `card + padding`, or 40. */
      style={{
        padding: "var(--ick-space-6)",
        borderRadius: "var(--ick-question-radius-group)",
        background: "var(--ick-question-surface)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--ick-space-5)",
      }}
    >
      {children}
    </div>
  </div>
);

/** The letter or number, in each of the three grounds it has to sit on. */
export const Badges: StoryObj = {
  render: () => (
    <Ground label="QuestionBadge">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <QuestionBadge>a</QuestionBadge>
        <QuestionBadge onCard>2</QuestionBadge>
        <QuestionBadge selected>3</QuestionBadge>
      </div>
      <div
        style={{
          fontFamily: "var(--ick-font-mono)",
          fontSize: 11,
          color: "var(--ick-ink-faint)",
        }}
      >
        default · onCard · selected
      </div>
    </Ground>
  ),
};

/** A row that picks. `aria-pressed`, so it says what it is. */
export const Options: StoryObj = {
  render: () => {
    return (
      <>
        <Ground label="QuestionOptionRow">
          <QuestionOptionRow letter="a" title="They live alone" description="Nobody else in the home" />
          <QuestionOptionRow
            letter="b"
            title="With a partner"
            description="Two in the household"
            selected
          />
          <QuestionOptionRow letter="c" title="With family" />
        </Ground>
        <Ground label="QuestionOptionRow — without a letter, the row starts at its title">
          <QuestionOptionRow title="Every weekday" />
          <QuestionOptionRow title="Weekends too" selected />
        </Ground>
      </>
    );
  },
};

/** A row that is typed into. The row lights up, not the input inside it. */
export const Fields: StoryObj = {
  render: function Fields() {
    const [name, setName] = useState("");
    const [age, setAge] = useState("84");
    return (
      <Ground label="QuestionFieldRow — the second one is filled; click either to focus the row">
        <QuestionFieldRow
          letter="a"
          label="Their name"
          placeholder="Milica Stevanović"
          value={name}
          onChange={setName}
        />
        <QuestionFieldRow
          letter="b"
          label="Age"
          placeholder="84"
          value={age}
          onChange={setAge}
          inputMode="numeric"
        />
      </Ground>
    );
  },
};

/** Reads as one more option, but it is a text field. */
export const SomethingElse: StoryObj = {
  render: function SomethingElse() {
    const [value, setValue] = useState("");
    return (
      <Ground label="QuestionOtherRow — fills in as an option once there is something in it">
        <QuestionOptionRow letter="a" title="Meals" description="Cooking and shopping" />
        <QuestionOtherRow
          letter="b"
          value={value}
          placeholder="Something else"
          onChange={setValue}
        />
      </Ground>
    );
  },
};

const URGENCY = [
  { id: "now", title: "In the next few days", description: "Something has already changed" },
  { id: "soon", title: "Within a month", description: "It is coming, but there is time" },
  { id: "planning", title: "Just planning ahead", description: "Nothing has happened yet" },
];

/**
 * A fourth kind of question — pick one *and* say something — which the kit
 * does not ship and does not need to. The shell draws the card, the header and
 * the footer; the rows are the two the kit already has.
 */
export const AComposedQuestion: StoryObj = {
  render: function AComposedQuestion() {
    const [picked, setPicked] = useState<string | null>(null);
    const [note, setNote] = useState("");
    return (
      <Ground label="QuestionShell + QuestionOptionRow + QuestionFieldRow">
        <QuestionShell
          number={3}
          title="How soon do they need this?"
          subtitle="Roughly is fine — it decides what we look at first"
          footer={
            <Button variant="secondary" size="m" disabled={!picked}>
              Next
            </Button>
          }
        >
          {URGENCY.map((option, i) => (
            <QuestionOptionRow
              key={option.id}
              letter={String.fromCharCode(97 + i)}
              title={option.title}
              description={option.description}
              selected={picked === option.id}
              onClick={() => setPicked(option.id)}
            />
          ))}
          <QuestionFieldRow
            letter="d"
            label="Anything we should know"
            placeholder="Optional"
            value={note}
            onChange={setNote}
          />
        </QuestionShell>
      </Ground>
    );
  },
};

/** The shell on its own ground, without the card it usually paints. */
export const ShellWithoutItsBox: StoryObj = {
  render: () => (
    <Ground label="QuestionShell card={false} — for a box that is already drawn around it">
      <QuestionShell number={1} title="What are we sorting out?" card={false}>
        <QuestionOptionRow letter="a" title="Care at home" />
        <QuestionOptionRow letter="b" title="A place to move to" />
      </QuestionShell>
    </Ground>
  ),
};
