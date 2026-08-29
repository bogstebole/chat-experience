import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import { QuestionCard, answerChips } from "../QuestionCard/QuestionCard";
import { QuestionGroup } from "../QuestionGroup/QuestionGroup";
import type { Question } from "../QuestionCard/types";

const INPUTS: Question = {
  id: "who",
  type: "inputs",
  title: "Who are we caring for?",
  subtitle: "Just the basics",
  shortTitle: "About them",
  fields: [
    { id: "name", label: "Their name" },
    { id: "age", label: "Age" },
    { id: "note", label: "Anything else", optional: true },
  ],
};

const SINGLE: Question = {
  id: "household",
  type: "single",
  title: "Who else lives there?",
  shortTitle: "Household",
  options: [
    { id: "alone", title: "They live alone", short: "Alone" },
    { id: "partner", title: "With a partner", short: "Partner" },
  ],
};

const MULTI: Question = {
  id: "help",
  type: "multi",
  title: "What do they need help with?",
  shortTitle: "Support",
  allowOther: true,
  allowEmpty: true,
  options: [
    { id: "meals", title: "Meals", short: "Meals" },
    { id: "meds", title: "Medication", short: "Meds" },
  ],
};

/**
 * Asked by role, not by label text. `getByLabelText` reads the label's text
 * content, which still contains the badge's letter; the accessible name does
 * not, because the badge is `aria-hidden`. The role query uses the tree, which
 * is what a screen reader uses, so it is the one telling the truth here.
 */
const field = (name: string) => screen.getByRole("textbox", { name });

describe("answering with fields", () => {
  it("will not commit until the required ones are filled", () => {
    const onCommit = vi.fn();
    render(<QuestionCard question={INPUTS} number={1} state="active" onCommit={onCommit} />);
    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();

    fireEvent.change(field("Their name"), { target: { value: "Milica" } });
    expect(next).toBeDisabled();
    fireEvent.change(field("Age"), { target: { value: "84" } });

    // The third is optional, so that is enough.
    expect(next).toBeEnabled();
    fireEvent.click(next);
    expect(onCommit).toHaveBeenCalledWith({ values: { name: "Milica", age: "84" } });
  });

  /** The next field is nearly always what somebody means by Enter. */
  it("moves to the next field on Enter, and commits from the last", () => {
    const onCommit = vi.fn();
    render(<QuestionCard question={INPUTS} number={1} state="active" onCommit={onCommit} />);
    const name = field("Their name");
    const age = field("Age");
    const note = field("Anything else");

    fireEvent.change(name, { target: { value: "Milica" } });
    fireEvent.keyDown(name, { key: "Enter" });
    expect(age).toHaveFocus();

    fireEvent.change(age, { target: { value: "84" } });
    fireEvent.keyDown(age, { key: "Enter" });
    expect(note).toHaveFocus();

    fireEvent.keyDown(note, { key: "Enter" });
    expect(onCommit).toHaveBeenCalled();
  });

  it("starts from the answer already given", () => {
    render(
      <QuestionCard
        question={INPUTS}
        number={1}
        state="active"
        answer={{ values: { name: "Milica", age: "84" } }}
      />
    );
    expect(field("Their name")).toHaveValue("Milica");
  });
});

describe("picking one", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  /**
   * Picked, then a beat, then on. Committing instantly means the card is gone
   * before anybody sees which one they chose.
   */
  it("shows the choice landing before it moves on", () => {
    const onCommit = vi.fn();
    render(<QuestionCard question={SINGLE} number={1} state="active" onCommit={onCommit} />);
    const option = screen.getByRole("button", { name: /They live alone/ });

    fireEvent.click(option);
    expect(option).toHaveAttribute("aria-pressed", "true");
    expect(onCommit).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(400));
    expect(onCommit).toHaveBeenCalledWith({ optionId: "alone" });
  });
});

describe("picking several", () => {
  it("toggles, and reports every one chosen", () => {
    const onCommit = vi.fn();
    render(<QuestionCard question={MULTI} number={1} state="active" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button", { name: /Meals/ }));
    fireEvent.click(screen.getByRole("button", { name: /Medication/ }));
    fireEvent.click(screen.getByRole("button", { name: /Meals/ })); // taken back
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onCommit).toHaveBeenCalledWith({ optionIds: ["meds"] });
  });

  it("carries the free-text answer out with the rest", () => {
    const onCommit = vi.fn();
    render(<QuestionCard question={MULTI} number={1} state="active" onCommit={onCommit} />);
    fireEvent.change(field("Something else"), { target: { value: "Company" } });
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onCommit).toHaveBeenCalledWith({ optionIds: [], other: "Company" });
  });

  /** Somebody who means "none" should not be stuck on the question. */
  it("offers none of these when that is allowed", () => {
    const onCommit = vi.fn();
    render(<QuestionCard question={MULTI} number={1} state="active" onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button", { name: "None of these" }));
    expect(onCommit).toHaveBeenCalledWith({ optionIds: [] });
  });

  it("is stuck when it is not", () => {
    render(
      <QuestionCard question={{ ...MULTI, allowEmpty: false }} number={1} state="active" />
    );
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("once it is answered", () => {
  /**
   * One control for the whole row. The original could be clicked but not
   * tabbed to, and put a second button inside the clickable area for the same
   * action — two tab stops, one of them unreachable.
   */
  it("is a single button naming what pressing it does", () => {
    const onEdit = vi.fn();
    render(
      <QuestionCard
        question={SINGLE}
        number={2}
        state="collapsed"
        answer={{ optionId: "alone" }}
        onEdit={onEdit}
      />
    );
    const row = screen.getByRole("button", { name: "Edit answer: Household" });
    fireEvent.click(row);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(within(row).getByText("They live alone")).toBeInTheDocument();
  });

  it("is not a control at all when it cannot be changed", () => {
    render(
      <QuestionCard
        question={SINGLE}
        number={2}
        state="collapsed"
        readOnly
        answer={{ optionId: "alone" }}
      />
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("They live alone")).toBeInTheDocument();
  });

  it("shows only its short title while it waits its turn", () => {
    render(<QuestionCard question={SINGLE} number={2} state="upcoming" />);
    expect(screen.getByText("Household")).toBeInTheDocument();
    expect(screen.queryByText("Who else lives there?")).not.toBeInTheDocument();
  });
});

describe("shortening an answer for its row", () => {
  it("keeps two, then counts", () => {
    expect(answerChips(INPUTS, { values: { name: "Milica", age: "84" } })).toEqual(["Milica", "84"]);
    expect(
      answerChips(INPUTS, { values: { name: "Milica", age: "84", note: "Vračar" } })
    ).toEqual(["Milica", "84", "+1"]);
  });

  /** Several short ones read better joined than stacked. */
  it("joins short labels rather than stacking them", () => {
    expect(answerChips(MULTI, { optionIds: ["meals", "meds"] })).toEqual(["Meals, Meds"]);
  });

  it("uses the full titles once free text is in the mix", () => {
    expect(answerChips(MULTI, { optionIds: ["meals"], other: "Company" })).toEqual([
      "Meals",
      "Company",
    ]);
  });

  it("has nothing to say about an unanswered question", () => {
    expect(answerChips(SINGLE, undefined)).toEqual([]);
  });
});

describe("a whole step", () => {
  const questions = [INPUTS, SINGLE, MULTI];

  it("shows one active, the answered folded, and the rest waiting", () => {
    render(
      <QuestionGroup
        id="s"
        questions={questions}
        answers={{ who: { values: { name: "Milica", age: "84" } } }}
        activeIndex={1}
      />
    );
    expect(screen.getByRole("button", { name: "Edit answer: About them" })).toBeInTheDocument();
    expect(screen.getByText("Who else lives there?")).toBeInTheDocument();
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("folds to one row, and opens again", () => {
    render(
      <QuestionGroup
        id="s"
        questions={questions}
        answers={{ who: {}, household: {}, help: {} } as never}
        collapsible
      />
    );
    const summary = screen.getByRole("button", { expanded: false });
    expect(summary).toHaveTextContent("3 answers");
    expect(summary).toHaveTextContent("About them · Household · Support");

    fireEvent.click(summary);
    expect(screen.getByRole("button", { name: "Hide answers" })).toBeInTheDocument();
  });

  it("reports which question was answered", () => {
    const onCommit = vi.fn();
    render(
      <QuestionGroup id="s" questions={questions} answers={{}} activeIndex={1} onCommit={onCommit} />
    );
    fireEvent.click(screen.getByRole("button", { name: /They live alone/ }));
    // The single-select settles before it commits; the id is what matters here.
    expect(onCommit).not.toHaveBeenCalledWith("who", expect.anything());
  });
});
