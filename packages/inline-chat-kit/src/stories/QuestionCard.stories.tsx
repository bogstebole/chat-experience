import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QuestionCard } from "../QuestionCard/QuestionCard";
import { QuestionGroup, FOLDABLE_FROM } from "../QuestionGroup/QuestionGroup";
import { Chip } from "../Chip/Chip";
import type { Answer, Question } from "../QuestionCard/types";

const meta: Meta<typeof QuestionCard> = {
  title: "Components/QuestionCard",
  component: QuestionCard,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof QuestionCard>;

const INPUTS: Question = {
  id: "who",
  type: "inputs",
  title: "Who are we caring for?",
  subtitle: "Just the basics for now — we'll go into detail together",
  shortTitle: "About them",
  fields: [
    { id: "name", label: "Their name", placeholder: "Milica Stevanović" },
    { id: "age", label: "Age", placeholder: "84" },
    { id: "where", label: "Where they live", placeholder: "Vračar, Beograd" },
  ],
};

const SINGLE: Question = {
  id: "household",
  type: "single",
  title: "Who else lives in the household?",
  subtitle: "This tells us how much support is already around them",
  shortTitle: "Household",
  options: [
    { id: "alone", title: "They live alone", description: "Nobody else in the home", short: "Alone" },
    { id: "partner", title: "With a partner", description: "Two in the household", short: "Partner" },
    { id: "family", title: "With family", description: "Children or relatives in the home", short: "Family" },
    { id: "more", title: "Three or more others", description: "A full household", short: "3+" },
  ],
};

const MULTI: Question = {
  id: "help",
  type: "multi",
  title: "What do they need help with?",
  subtitle: "Pick everything that applies",
  shortTitle: "Support needed",
  allowOther: true,
  allowEmpty: true,
  otherPlaceholder: "Something else",
  options: [
    { id: "meals", title: "Meals", description: "Cooking and shopping", short: "Meals" },
    { id: "mobility", title: "Getting around", description: "Stairs, walks, appointments", short: "Mobility" },
    { id: "meds", title: "Medication", description: "Reminders and refills", short: "Meds" },
  ],
};

const Wrap = ({ label, children }: { label: string; children: React.ReactNode }) => (
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
      style={{
        padding: 16,
        borderRadius: 24,
        background: "var(--ick-question-surface)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {children}
    </div>
  </div>
);

/** The three states a question passes through. */
export const States: Story = {
  render: () => (
    <div>
      <Wrap label="active — being answered">
        <QuestionCard question={INPUTS} number={1} state="active" />
      </Wrap>
      <Wrap label="collapsed — answered, folded into a row">
        <QuestionCard
          question={INPUTS}
          number={1}
          state="collapsed"
          answer={{ values: { name: "Milica Stevanović", age: "84", where: "Vračar" } }}
        />
      </Wrap>
      <Wrap label="upcoming — still to come">
        <QuestionCard question={SINGLE} number={2} state="upcoming" />
      </Wrap>
      <Wrap label="collapsed, read-only — not a control at all">
        <QuestionCard
          question={SINGLE}
          number={2}
          state="collapsed"
          readOnly
          answer={{ optionId: "family" }}
        />
      </Wrap>
    </div>
  ),
};

/** The three ways to answer one. */
export const Types: Story = {
  render: () => (
    <div>
      <Wrap label="inputs — type something">
        <QuestionCard question={INPUTS} number={1} state="active" />
      </Wrap>
      <Wrap label="single — pick one, and it moves on by itself">
        <QuestionCard question={SINGLE} number={2} state="active" />
      </Wrap>
      <Wrap label="multi — pick several, plus 'something else'">
        <QuestionCard question={MULTI} number={3} state="active" />
      </Wrap>
    </div>
  ),
};

/**
 * Two chips at most, then a count. Three of unpredictable width in a row that
 * also holds a title is a row that wraps, and a summary that wraps is not one.
 */
export const Summaries: Story = {
  render: () => (
    <Wrap label="how answers shorten">
      <QuestionCard
        question={INPUTS}
        number={1}
        state="collapsed"
        answer={{ values: { name: "Milica Stevanović", age: "84", where: "Vračar, Beograd" } }}
      />
      <QuestionCard
        question={MULTI}
        number={2}
        state="collapsed"
        answer={{ optionIds: ["meals", "mobility", "meds"] }}
      />
      <QuestionCard
        question={MULTI}
        number={3}
        state="collapsed"
        answer={{ optionIds: ["meals"], other: "Company in the afternoons" }}
      />
    </Wrap>
  ),
};

/** A chip on its own. */
export const Chips: Story = {
  render: () => (
    <Wrap label="Chip">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Chip>Milica Stevanović</Chip>
        <Chip>84</Chip>
        <Chip>+1</Chip>
      </div>
    </Wrap>
  ),
};

/** The whole step, answered one question at a time. */
function Flow({ collapsible }: { collapsible?: boolean }) {
  const questions = [INPUTS, SINGLE, MULTI];
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({});
  const [editing, setEditing] = useState<number | null>(null);

  const firstUnanswered = questions.findIndex((q) => !answers[q.id]);
  const activeIndex = editing ?? (firstUnanswered === -1 ? null : firstUnanswered);
  const done = firstUnanswered === -1;

  return (
    <div style={{ maxWidth: 520 }}>
      <QuestionGroup
        id="demo"
        questions={questions}
        answers={answers}
        activeIndex={activeIndex}
        collapsible={collapsible && done && questions.length >= FOLDABLE_FROM}
        onCommit={(id, answer) => {
          setAnswers((all) => ({ ...all, [id]: answer }));
          setEditing(null);
        }}
        onEdit={setEditing}
      />
    </div>
  );
}

export const AWholeStep: Story = { render: () => <Flow /> };

/**
 * Once every question is answered the whole step folds to one row. Not a peek
 * at the list — a peek costs more height than the answers it shows.
 */
export const Folding: Story = { render: () => <Flow collapsible /> };
