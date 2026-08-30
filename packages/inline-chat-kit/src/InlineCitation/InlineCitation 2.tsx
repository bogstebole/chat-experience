"use client";

import type { HTMLAttributes, ReactNode } from "react";
import type { Source } from "../Sources/Sources";
import styles from "./InlineCitation.module.css";

export interface InlineCitationProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "onSelect"> {
  /** 1-based, and it has to match the entry's place in `<Sources>`. */
  index: number;
  /** Named in the marker's label, so the marker says more than a number. */
  source?: Source;
  /**
   * The passage this citation is for.
   *
   * Given one, the passage is **marked** — the same yellow the highlighter
   * draws, because it is the same statement: this run of words is spoken for.
   * Left out, the marker stands on its own after whatever precedes it.
   */
  children?: ReactNode;
  /** Where the reader is taken. Without one the marker is not a control. */
  onSelect?: (index: number, source?: Source) => void;
  labels?: Partial<{ cite: string }>;
}

/**
 * The numbered marker in the text, and the passage it speaks for.
 *
 * The kit already had a way of saying "this run of words is picked out" — the
 * marker somebody draws over an answer to ask about it. A citation is that
 * same statement made by the answer rather than by the reader, so it is drawn
 * the same way rather than in a second visual language nobody has learned.
 */
export function InlineCitation({
  index,
  source,
  children,
  onSelect,
  labels,
  className,
  ...rest
}: InlineCitationProps) {
  const cite = labels?.cite ?? "Source";
  const name = source ? `${cite} ${index}: ${source.title}` : `${cite} ${index}`;

  const marker = onSelect ? (
    <button
      type="button"
      className={styles.marker}
      onClick={() => onSelect(index, source)}
      /* Inside an answer this sits on the highlighter's surface, where a
         pointerdown starts drawing a marker. The click is for the citation. */
      onPointerDown={(event) => event.stopPropagation()}
      aria-label={name}
    >
      {index}
    </button>
  ) : (
    <span className={styles.marker} data-static="" aria-label={name} role="note">
      {index}
    </span>
  );

  if (!children) {
    return (
      <span className={[styles.citation, className ?? ""].filter(Boolean).join(" ")} {...rest}>
        {marker}
      </span>
    );
  }

  return (
    <span
      className={[styles.citation, styles.marked, className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      <span className={styles.passage}>{children}</span>
      {marker}
    </span>
  );
}
