"use client";

import type { HTMLAttributes } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Branch.module.css";

type Labels = {
  previous: string;
  next: string;
  /** `{index}` and `{total}` are filled in. */
  position: string;
};

const LABELS: Labels = {
  previous: "Previous answer",
  next: "Next answer",
  position: "Answer {index} of {total}",
};

export interface BranchProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** How many answers this turn has had. */
  total: number;
  /** Which one is on screen, from zero. */
  index: number;
  onSelect: (index: number) => void;
  labels?: Partial<Labels>;
}

/**
 * Which answer you are looking at, and how to reach the others.
 *
 * Regenerating used to overwrite: the answer you were comparing against was
 * gone the moment the second one started. But the reason anybody presses
 * regenerate is to find out whether a second attempt is better, and there is
 * no better once the first has been thrown away.
 *
 * So it draws nothing at all for a turn with one answer. A control that says
 * "1 of 1" is a control offering to take you nowhere.
 */
export function Branch({ total, index, onSelect, labels, className, ...rest }: BranchProps) {
  const label = { ...LABELS, ...labels };
  if (total < 2) return null;

  const at = Math.min(Math.max(index, 0), total - 1);
  const position = label.position
    .replace("{index}", String(at + 1))
    .replace("{total}", String(total));

  return (
    <div
      className={[styles.branch, className ?? ""].filter(Boolean).join(" ")}
      /* A group rather than a toolbar: two buttons and the count between them
         are one thing, and the count is the group's name. */
      role="group"
      aria-label={position}
      {...rest}
    >
      <button
        type="button"
        className={styles.step}
        onClick={() => onSelect(at - 1)}
        /* Inside an answer this sits on the highlighter's surface, where a
           pointerdown starts drawing a marker. The click is for the button. */
        onPointerDown={(event) => event.stopPropagation()}
        disabled={at === 0}
        aria-label={label.previous}
      >
        <ChevronLeft size={14} aria-hidden />
      </button>

      {/* Not `aria-live`: moving between answers already replaces the answer
          itself, which is what a reader wants read out — not the counter. */}
      <span className={styles.count}>
        {at + 1}
        <span className={styles.of}>/</span>
        {total}
      </span>

      <button
        type="button"
        className={styles.step}
        onClick={() => onSelect(at + 1)}
        onPointerDown={(event) => event.stopPropagation()}
        disabled={at === total - 1}
        aria-label={label.next}
      >
        <ChevronRight size={14} aria-hidden />
      </button>
    </div>
  );
}
