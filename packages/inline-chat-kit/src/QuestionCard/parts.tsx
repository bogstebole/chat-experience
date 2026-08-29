"use client";

import {
  forwardRef,
  useId,
  useState,
  type ComponentPropsWithoutRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./QuestionCard.module.css";

/* ─────────────────────────────────────────────
   The parts a QuestionCard is built from.

   Exported, so a fourth kind of question is a composition rather than a fork.
   The kit ships three shapes; a product that needs a fifth should not have to
   reimplement the badge, the row, the focus behaviour and the tokens to get
   there.

   Being public API is what decides how they look from outside: named for what
   they are rather than for where they sit (`QuestionOptionRow`, not
   `OptionCard`), each taking a `className` and the DOM props of the element it
   ends in, and each forwarding its ref to the thing you would actually want
   one for — the input, in the two rows that have one.
   ───────────────────────────────────────────── */

/* ── The badge ──────────────────────────────────────────────────────────── */

export interface QuestionBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The number or the letter. */
  children: ReactNode;
  /** Wearing the accent, because this is the one being answered or chosen. */
  selected?: boolean;
  /** Sitting on a raised card rather than on the group's own surface. */
  onCard?: boolean;
}

/** The 24px square carrying a number or a letter. */
export const QuestionBadge = forwardRef<HTMLSpanElement, QuestionBadgeProps>(
  function QuestionBadge({ children, selected, onCard, className, ...rest }, ref) {
    return (
      <span
        ref={ref}
        className={[styles.badge, className ?? ""].filter(Boolean).join(" ")}
        /* Hidden from assistive technology, because the letter is a visual
           index and not information — it exists so somebody can say "the third
           one". Left in the tree it joins the accessible name of whatever
           contains it, and a field called "a Their name" is worse than one
           called "Their name".

           Said before the spread, so somebody using the badge for something
           that *is* information can pass `aria-hidden={false}`. */
        aria-hidden="true"
        data-selected={selected || undefined}
        data-on-card={(!selected && onCard) || undefined}
        {...rest}
      >
        {children}
      </span>
    );
  }
);

/* ── The option row ─────────────────────────────────────────────────────── */

/* Motion declares its own `onAnimationStart` and drag handlers with different
   shapes to the DOM's, so the DOM's are dropped rather than fought with. */
type OptionBase = Omit<
  ComponentPropsWithoutRef<"button">,
  "title" | "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd"
>;

export interface QuestionOptionRowProps extends OptionBase {
  /** The a/b/c badge. Left out, the row starts at its title. */
  letter?: ReactNode;
  /** Wins the name from the button's own `title` attribute, which is a tooltip. */
  title: ReactNode;
  description?: ReactNode;
  selected?: boolean;
}

/** One option, in a single- or multi-select question. */
export const QuestionOptionRow = forwardRef<HTMLButtonElement, QuestionOptionRowProps>(
  function QuestionOptionRow(
    { letter, title, description, selected = false, className, ...rest },
    ref
  ) {
    const still = prefersReducedMotion();
    return (
      <motion.button
        ref={ref}
        type="button"
        className={[styles.option, className ?? ""].filter(Boolean).join(" ")}
        data-selected={selected || undefined}
        /* A toggle, said plainly. Not a radio: a single-select here commits and
           moves on, so it behaves like a button that picks rather than like one
           of a set you arrow between. */
        aria-pressed={selected}
        whileTap={still ? undefined : { scale: 0.99 }}
        {...rest}
      >
        {letter !== undefined && <QuestionBadge selected={selected}>{letter}</QuestionBadge>}
        <span className={styles.optionBody}>
          <span className={styles.optionTitle}>{title}</span>
          {description && <span className={styles.optionDescription}>{description}</span>}
        </span>
      </motion.button>
    );
  }
);

/* ── The field row ──────────────────────────────────────────────────────── */

/** `className` styles the row; everything else lands on the input. */
type FieldBase = Omit<ComponentPropsWithoutRef<"input">, "value" | "onChange" | "className">;

export interface QuestionFieldRowProps extends FieldBase {
  /** The a/b/c badge. Left out, the row starts at its label. */
  letter?: ReactNode;
  label: ReactNode;
  value: string;
  /** The value, not the event — the row exists to be typed into. */
  onChange: (value: string) => void;
  /** Enter, which in a question nearly always means "the next one", not "send". */
  onEnter?: () => void;
  /** On the row. Every other prop goes to the input. */
  className?: string;
}

/** A free-text row: letter, label, and the field itself. */
export const QuestionFieldRow = forwardRef<HTMLInputElement, QuestionFieldRowProps>(
  function QuestionFieldRow(
    { letter, label, value, onChange, onEnter, className, id, onFocus, onBlur, onKeyDown, ...rest },
    ref
  ) {
    const [focused, setFocused] = useState(false);
    /* React's own, rather than one built out of the letter and the label. Two
       cards on a page can hold the same label, and two elements sharing an id
       means the label focuses the wrong input. */
    const auto = useId();
    const inputId = id ?? auto;

    return (
      /* A label, so the whole row focuses the input — which is what the
         original achieved with a click handler on a div, and this does without
         asking a pointer to be involved. */
      <label
        className={[styles.field, className ?? ""].filter(Boolean).join(" ")}
        data-focused={focused || undefined}
        htmlFor={inputId}
      >
        {letter !== undefined && <QuestionBadge selected={focused}>{letter}</QuestionBadge>}
        <span className={styles.fieldBody}>
          <span className={styles.fieldLabel}>{label}</span>
          <input
            id={inputId}
            ref={ref}
            type="text"
            className={styles.fieldInput}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={(event) => {
              setFocused(true);
              onFocus?.(event);
            }}
            onBlur={(event) => {
              setFocused(false);
              onBlur?.(event);
            }}
            onKeyDown={(event) => {
              /* Theirs first: a handler that calls preventDefault is saying it
                 has dealt with this key, and Enter is the one somebody is most
                 likely to want for themselves. */
              onKeyDown?.(event);
              if (event.key === "Enter" && !event.defaultPrevented) {
                event.preventDefault();
                onEnter?.();
              }
            }}
            {...rest}
          />
        </span>
      </label>
    );
  }
);

/* ── The "something else" row ───────────────────────────────────────────── */

type OtherBase = Omit<
  ComponentPropsWithoutRef<"input">,
  "value" | "onChange" | "className" | "placeholder"
>;

export interface QuestionOtherRowProps extends OtherBase {
  /** The a/b/c badge. Left out, the row starts at the field. */
  letter?: ReactNode;
  value: string;
  /** Also the accessible name: the row has no visible label of its own. */
  placeholder: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  /** On the row. Every other prop goes to the input. */
  className?: string;
}

/**
 * The "something else" row: reads as one more option, but it is a text field.
 *
 * A label rather than a button, and that is not a detail — an input inside a
 * button is not reliably focusable, and the whole row exists to be typed into.
 */
export const QuestionOtherRow = forwardRef<HTMLInputElement, QuestionOtherRowProps>(
  function QuestionOtherRow(
    { letter, value, placeholder, onChange, onEnter, className, onKeyDown, ...rest },
    ref
  ) {
    const filled = value.trim().length > 0;
    return (
      <label
        className={[styles.option, className ?? ""].filter(Boolean).join(" ")}
        data-selected={filled || undefined}
        data-other=""
      >
        {letter !== undefined && <QuestionBadge selected={filled}>{letter}</QuestionBadge>}
        <span className={styles.optionBody}>
          <input
            ref={ref}
            type="text"
            className={styles.otherInput}
            value={value}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (event.key === "Enter" && !event.defaultPrevented) {
                event.preventDefault();
                onEnter?.();
              }
            }}
            {...rest}
          />
        </span>
      </label>
    );
  }
);

/* ── The shell they sit in ──────────────────────────────────────────────── */

export interface QuestionShellProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The badge over the question. Left out, the header starts at the title. */
  number?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The rows this question is made of. */
  children: ReactNode;
  /** Right-aligned under the rows — usually the button that commits. */
  footer?: ReactNode;
  /**
   * Paint the card box: background, radius, shadow.
   *
   * On by default, because a shell used on its own is the reason this is
   * exported. `QuestionCard` turns it off — it brings its own box, which is
   * the one that morphs between the three states.
   */
  card?: boolean;
}

/**
 * A question laid out: header, rows, footer.
 *
 * The scaffolding, so composing a fourth kind of question is a matter of
 * choosing the rows rather than rebuilding the box, the spacing and the type
 * around them out of numbers that were tokens ten minutes ago.
 */
export const QuestionShell = forwardRef<HTMLDivElement, QuestionShellProps>(
  function QuestionShell(
    { number, title, subtitle, children, footer, card = true, className, ...rest },
    ref
  ) {
    return (
      <div
        ref={ref}
        className={[styles.active, card ? styles.shellCard : "", className ?? ""]
          .filter(Boolean)
          .join(" ")}
        {...rest}
      >
        <div className={styles.header}>
          {number !== undefined && <QuestionBadge selected>{number}</QuestionBadge>}
          <div className={styles.headerText}>
            <p className={styles.title}>{title}</p>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
        </div>
        <div className={styles.rows}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    );
  }
);
