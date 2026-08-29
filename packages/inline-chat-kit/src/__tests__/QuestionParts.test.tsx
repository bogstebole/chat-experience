import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { act, render, screen, fireEvent } from "@testing-library/react";
import {
  QuestionBadge,
  QuestionFieldRow,
  QuestionOptionRow,
  QuestionOtherRow,
  QuestionShell,
} from "../QuestionCard/parts";

/**
 * These are public API now, which is a different job to being the inside of a
 * card. What is tested here is the part of them that only exists because they
 * are exported: that somebody else's className, DOM props and refs survive the
 * trip, and that two of them on one page do not collide.
 */

describe("QuestionBadge", () => {
  it("is hidden from assistive technology, because the letter is an index", () => {
    render(<QuestionBadge>a</QuestionBadge>);
    expect(screen.getByText("a")).toHaveAttribute("aria-hidden", "true");
  });

  it("can be told otherwise, for a badge that does carry information", () => {
    render(<QuestionBadge aria-hidden={false}>7</QuestionBadge>);
    expect(screen.getByText("7")).toHaveAttribute("aria-hidden", "false");
  });

  it("keeps its own class when given one", () => {
    render(<QuestionBadge className="mine">a</QuestionBadge>);
    const badge = screen.getByText("a");
    expect(badge.className).toContain("mine");
    expect(badge.className.split(" ").length).toBeGreaterThan(1);
  });

  it("forwards its ref", () => {
    const ref = createRef<HTMLSpanElement>();
    render(<QuestionBadge ref={ref}>a</QuestionBadge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });
});

describe("QuestionOptionRow", () => {
  it("says whether it is picked, rather than only looking picked", () => {
    render(<QuestionOptionRow title="Meals" selected />);
    expect(screen.getByRole("button", { name: /Meals/ })).toHaveAttribute("aria-pressed", "true");
  });

  /* `title` on a button is a tooltip. Ours is the row's heading, and the Omit
     in the props is what stops it quietly becoming the other one. */
  it("draws its title rather than hanging it off the element as a tooltip", () => {
    render(<QuestionOptionRow title="Meals" />);
    const button = screen.getByRole("button", { name: /Meals/ });
    expect(button).not.toHaveAttribute("title");
    expect(button.textContent).toContain("Meals");
  });

  it("leaves the badge out when there is no letter", () => {
    const { rerender, container } = render(<QuestionOptionRow title="Meals" />);
    expect(container.querySelectorAll("[aria-hidden='true']")).toHaveLength(0);
    rerender(<QuestionOptionRow letter="a" title="Meals" />);
    expect(screen.getByText("a")).toBeInTheDocument();
  });

  it("passes the rest of its props to the button", () => {
    render(<QuestionOptionRow title="Meals" disabled data-testid="row" />);
    expect(screen.getByTestId("row")).toBeDisabled();
  });

  it("forwards its ref to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<QuestionOptionRow ref={ref} title="Meals" />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe("QuestionFieldRow", () => {
  const Row = (props: { label: string; value?: string }) => (
    <QuestionFieldRow label={props.label} value={props.value ?? ""} onChange={() => {}} />
  );

  /* The id used to be built out of the letter and the label, which is unique
     inside one card and not across two. Two inputs sharing an id means the
     second label focuses the first input. */
  it("gives each row an id of its own, so two with the same label do not collide", () => {
    render(
      <>
        <Row label="Their name" />
        <Row label="Their name" />
      </>
    );
    const [first, second] = screen.getAllByLabelText("Their name");
    expect(first.id).not.toBe(second.id);
    expect(first.id).toBeTruthy();
  });

  it("labels the input, so clicking the row focuses it", () => {
    render(<Row label="Their name" />);
    const input = screen.getByLabelText("Their name");
    // Focusing lights the row up, which is a state update.
    act(() => input.focus());
    expect(document.activeElement).toBe(input);
  });

  it("takes an id when one is given, for a form that owns its own", () => {
    render(<QuestionFieldRow id="name" label="Their name" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Their name")).toHaveAttribute("id", "name");
  });

  it("reports the value rather than the event", () => {
    const onChange = vi.fn();
    render(<QuestionFieldRow label="Their name" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Their name"), { target: { value: "Milica" } });
    expect(onChange).toHaveBeenCalledWith("Milica");
  });

  it("calls onEnter on Enter", () => {
    const onEnter = vi.fn();
    render(<QuestionFieldRow label="Their name" value="" onChange={() => {}} onEnter={onEnter} />);
    fireEvent.keyDown(screen.getByLabelText("Their name"), { key: "Enter" });
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  /* A handler that calls preventDefault has said it dealt with the key. */
  it("stands down when a consumer's own key handler took the Enter", () => {
    const onEnter = vi.fn();
    render(
      <QuestionFieldRow
        label="Their name"
        value=""
        onChange={() => {}}
        onEnter={onEnter}
        onKeyDown={(event) => event.preventDefault()}
      />
    );
    fireEvent.keyDown(screen.getByLabelText("Their name"), { key: "Enter" });
    expect(onEnter).not.toHaveBeenCalled();
  });

  it("puts the rest of its props on the input, and its className on the row", () => {
    const { container } = render(
      <QuestionFieldRow
        label="Age"
        value=""
        onChange={() => {}}
        className="mine"
        inputMode="numeric"
        maxLength={3}
      />
    );
    const input = screen.getByLabelText("Age");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("maxlength", "3");
    expect(container.querySelector("label")?.className).toContain("mine");
  });

  it("forwards its ref to the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(<QuestionFieldRow ref={ref} label="Their name" value="" onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe("QuestionOtherRow", () => {
  it("is named by its placeholder, having no visible label of its own", () => {
    render(<QuestionOtherRow value="" placeholder="Something else" onChange={() => {}} />);
    expect(screen.getByLabelText("Something else")).toBeInTheDocument();
  });

  it("is a label rather than a button, because an input inside a button is not focusable", () => {
    const { container } = render(
      <QuestionOtherRow value="" placeholder="Something else" onChange={() => {}} />
    );
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("label")).not.toBeNull();
  });

  it("forwards its ref to the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <QuestionOtherRow ref={ref} value="" placeholder="Something else" onChange={() => {}} />
    );
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});

describe("QuestionShell", () => {
  it("lays out a question that the kit does not ship", () => {
    render(
      <QuestionShell
        number={3}
        title="How soon do they need this?"
        subtitle="Roughly is fine"
        footer={<button type="button">Next</button>}
      >
        <QuestionOptionRow letter="a" title="In the next few days" />
      </QuestionShell>
    );
    expect(screen.getByText("How soon do they need this?")).toBeInTheDocument();
    expect(screen.getByText("Roughly is fine")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /In the next few days/ })).toBeInTheDocument();
  });

  /* On by default, since a shell standing on its own is the reason it exists.
     Inside a QuestionCard the box is the card's, and two would nest. */
  it("paints the card unless told the box is already drawn", () => {
    const { container, rerender } = render(
      <QuestionShell title="Anything">
        <span>row</span>
      </QuestionShell>
    );
    const withCard = container.firstElementChild?.className ?? "";
    rerender(
      <QuestionShell title="Anything" card={false}>
        <span>row</span>
      </QuestionShell>
    );
    const withoutCard = container.firstElementChild?.className ?? "";
    expect(withCard.split(" ").length).toBe(withoutCard.split(" ").length + 1);
  });

  it("leaves the footer out entirely when there is nothing to put in it", () => {
    render(
      <QuestionShell title="Anything">
        <span>row</span>
      </QuestionShell>
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
