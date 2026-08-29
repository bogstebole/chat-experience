"use client";

import { useRef, useState, type ReactNode, type RefObject } from "react";
import { motion } from "motion/react";
import styles from "./QuestionCard.module.css";

/**
 * The 24px square carrying a number or a letter.
 *
 * Hidden from assistive technology, because the letter is a visual index and
 * not information — it exists so somebody can say "the third one". Left in the
 * tree it joins the accessible name of whatever contains it, and a field
 * called "a Their name" is worse than one called "Their name".
 */
export function Badge({
  children,
  selected,
  onCard,
}: {
  children: ReactNode;
  selected?: boolean;
  /** Sitting on a raised card rather than on the group's own surface. */
  onCard?: boolean;
}) {
  return (
    <span
      className={styles.badge}
      aria-hidden="true"
      data-selected={selected || undefined}
      data-on-card={(!selected && onCard) || undefined}
    >
      {children}
    </span>
  );
}

/** One option, in a single- or multi-select question. */
export function OptionCard({
  letter,
  title,
  description,
  selected,
  onClick,
}: {
  letter: string;
  title: string;
  description?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className={styles.option}
      data-selected={selected || undefined}
      /* A toggle, said plainly. Not a radio: a single-select here commits and
         moves on, so it behaves like a button that picks rather than like one
         of a set you arrow between. */
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
    >
      <Badge selected={selected}>{letter}</Badge>
      <span className={styles.optionBody}>
        <span className={styles.optionTitle}>{title}</span>
        {description && <span className={styles.optionDescription}>{description}</span>}
      </span>
    </motion.button>
  );
}

/** A free-text row: letter, label, and the field itself. */
export function FieldRow({
  letter,
  label,
  placeholder,
  value,
  onChange,
  onEnter,
  inputRef,
}: {
  letter: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [focused, setFocused] = useState(false);
  const local = useRef<HTMLInputElement | null>(null);
  const ref = inputRef ?? local;
  const id = `${letter}-${label}`.replace(/\s+/g, "-").toLowerCase();

  return (
    /* A label, so the whole row focuses the input — which is what the original
       achieved with a click handler on a div, and this does without asking a
       pointer to be involved. */
    <label className={styles.field} data-focused={focused || undefined} htmlFor={id}>
      <Badge selected={focused}>{letter}</Badge>
      <span className={styles.fieldBody}>
        <span className={styles.fieldLabel}>{label}</span>
        <input
          id={id}
          ref={ref}
          type="text"
          className={styles.fieldInput}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onEnter?.();
            }
          }}
        />
      </span>
    </label>
  );
}

/**
 * The "something else" row: reads as one more option, but it is a text field.
 *
 * A label rather than a button, and that is not a detail — an input inside a
 * button is not reliably focusable, and the whole row exists to be typed into.
 */
export function OtherRow({
  letter,
  value,
  placeholder,
  onChange,
  onEnter,
}: {
  letter: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onEnter?: () => void;
}) {
  const filled = value.trim().length > 0;
  return (
    <label className={styles.option} data-selected={filled || undefined} data-other="">
      <Badge selected={filled}>{letter}</Badge>
      <span className={styles.optionBody}>
        <input
          type="text"
          className={styles.otherInput}
          value={value}
          placeholder={placeholder}
          aria-label={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onEnter?.();
            }
          }}
        />
      </span>
    </label>
  );
}
