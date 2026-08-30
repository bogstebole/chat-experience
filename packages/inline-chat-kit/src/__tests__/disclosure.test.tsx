import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { DisclosureHeader } from "../disclosure/DisclosureHeader";
import { DisclosureBody } from "../disclosure/DisclosureBody";

/**
 * One header, and the rule that keeps it one.
 *
 * Five components had a row you click to open something — `Tool`, `Reasoning`,
 * `ChainOfThought`, `TaskList`, `Sources`. The markup was written out five
 * times and the CSS five times with it, two pairs of them byte-for-byte
 * identical. The shimmer under the label was in two, twenty lines of gradient
 * each. The reveal underneath was ten lines of the same `motion` props in all
 * five.
 */
const Open = (props: { fit?: "band" | "inline" }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DisclosureHeader
        {...props}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        controls="body"
        label="Thought for 2.4s"
      />
      <DisclosureBody id="body" open={open}>
        <p>what it worked through</p>
      </DisclosureBody>
    </>
  );
};

describe("a disclosure header", () => {
  it("names the box it opens, whether or not the box has anything in it", () => {
    render(<Open />);
    const button = screen.getByRole("button", { name: /Thought for 2.4s/ });
    expect(button).toHaveAttribute("aria-controls", "body");
    /* Shut, and the container still exists — a control naming an id nothing
       has is a control that says nothing. */
    expect(document.getElementById("body")).not.toBeNull();
  });

  it("opens and shuts", async () => {
    render(<Open />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("what it worked through")).toBeInTheDocument();

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  /** No handler, no control — and nothing that looks like one. */
  it("is a heading when there is nothing to fold", () => {
    render(<DisclosureHeader open controls="x" label="Sources" meta="3 sources" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("3 sources")).toBeInTheDocument();
  });

  /** A control with nothing to open yet is still a row worth reading. */
  it("stays put when it is disabled", () => {
    render(
      <DisclosureHeader open={false} onToggle={() => {}} controls="x" label="bash" disabled />
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  /**
   * A pointerdown on the highlighter's surface starts drawing a marker. The
   * click on this row is for the row — every one of the five carried its own
   * copy of that guard, which is one of the five places it could have been
   * forgotten.
   */
  it("does not let a click on it start a marker", async () => {
    let started = false;
    render(
      <div onPointerDown={() => (started = true)}>
        <DisclosureHeader open={false} onToggle={() => {}} controls="x" label="bash" />
      </div>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(started).toBe(false);
  });
});

/**
 * The rule, rather than the discipline.
 *
 * Nothing outside `disclosure/` builds one of these by hand. It is checked
 * because the failure is silent: a sixth component writing its own header
 * works perfectly and simply does not match the other five, which is exactly
 * how there came to be five in the first place.
 */
describe("nothing writes its own", () => {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

  /**
   * `ChatHeader`'s overflow button is the one other `aria-expanded` in the
   * kit, and it is a different thing: `aria-haspopup="menu"`, a menu that
   * opens *over* the page. This is about the row that folds a panel open
   * underneath itself.
   */
  const MENUS = ["../ChatHeader/ChatHeader.tsx"];

  /**
   * `QuestionGroup` folds too, and does not use this — for a reason worth
   * stating rather than waving at. Its shut state is a *card*, and opening it
   * is a FLIP morph between two layouts, not a box growing from zero height
   * under a row. The header here is a row with a panel beneath it. Making one
   * serve both would mean a component that does two unrelated things badly,
   * which is the same mistake as forcing `Reasoning`'s inline label into a
   * full-width band.
   */
  const MORPHS = ["../QuestionGroup/QuestionGroup.tsx"];

  it("declares aria-expanded in one place", async () => {
    const files = import.meta.glob("../**/*.tsx", { query: "?raw", import: "default" });
    for (const [name, read] of Object.entries(files)) {
      if (name.startsWith("./") || name.startsWith("../stories/")) continue;
      if (name.includes("/disclosure/")) continue;
      const src = (await read()) as string;
      if (MENUS.includes(name)) {
        /* The exemption has to stay honest: still a menu, still not a fold. */
        expect(src, `${name} is exempt as a menu and is no longer one`).toContain(
          'aria-haspopup="menu"'
        );
        continue;
      }
      if (MORPHS.includes(name)) {
        /* Same: still a morph, and the moment it stops being one it owes an
           answer for why it is not using the shared header. */
        expect(src, `${name} is exempt as a morph and is no longer one`).toContain("LayoutGroup");
        continue;
      }
      expect(src.includes("aria-expanded"), `${name} builds its own header`).toBe(false);
    }
  });

  it("styles the chevron and the folding label in one stylesheet", async () => {
    const files = import.meta.glob("../**/*.module.css", { query: "?raw", import: "default" });
    for (const [name, read] of Object.entries(files)) {
      if (name.includes("/disclosure/")) continue;
      const css = strip((await read()) as string);
      expect(css.includes('[aria-expanded'), `${name} styles its own header`).toBe(false);
      /* The shimmer moved with the label. `Loader` keeps its own — it shimmers
         a row of dots rather than a control's name — and `shimmer.test.ts`
         holds the two geometries together. */
      if (name.includes("/Loader/")) continue;
      expect(css.includes("@keyframes sweep"), `${name} has its own shimmer`).toBe(false);
    }
  });
});
