"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./DisclosureHeader.module.css";

export interface DisclosureHeaderProps {
  /**
   * `band` is a full-width row — it has a right edge, so the meta and the
   * chevron are pushed to it. `inline` is a label that hugs its own words,
   * for a header that sits in the flow of an answer as an aside.
   *
   * The two are not a style choice. An inline header's chevron pushed to a
   * right edge 500px away floats alone in white space with nothing beside it.
   */
  fit?: "band" | "inline";
  /** The row *is* a card's top edge: corner to corner, the card's padding. */
  filled?: boolean;
  open: boolean;
  /** Leave it out and this is a heading rather than a control — no chevron,
      no `aria-expanded`, nothing to press. */
  onToggle?: () => void;
  /** The id of the box it opens. Always present, so this always points at
      something even while the box is empty. */
  controls: string;
  /** A control with nothing to open yet. Still a row worth reading. */
  disabled?: boolean;
  glyph?: ReactNode;
  /** The control's name. */
  label: ReactNode;
  /** Shimmers the label: the kit's way of saying "still happening". */
  pending?: boolean;
  /** A duration, a count — pushed to the right end of a band. */
  meta?: ReactNode;
  /** Anything between the label and the meta. */
  children?: ReactNode;
  className?: string;
}

const join = (...names: (string | undefined | false)[]) => names.filter(Boolean).join(" ");

/**
 * The row you click to open something.
 *
 * Five components had one of these and the markup was written out five times,
 * with two pairs byte-for-byte identical and the others differing in ways
 * nobody had decided on. The shimmer under the label was in two of them, with
 * the same twenty lines of gradient in each.
 *
 * What it does not do is force one shape on all five — see `fit`.
 */
export function DisclosureHeader({
  fit = "band",
  filled,
  open,
  onToggle,
  controls,
  disabled,
  glyph,
  label,
  pending,
  meta,
  children,
  className,
}: DisclosureHeaderProps) {
  const inside = (
    <>
      {glyph && <span className={styles.glyph}>{glyph}</span>}
      <span className={styles.label} data-pending={pending || undefined}>
        {label}
      </span>
      {children}
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      {onToggle && <ChevronDown className={styles.chevron} size={14} aria-hidden />}
    </>
  );

  const shared = {
    className: join(styles.header, className),
    "data-fit": fit,
    "data-filled": filled || undefined,
  };

  if (!onToggle) {
    return (
      <div {...shared} className={join(shared.className, styles.static)}>
        {inside}
      </div>
    );
  }

  return (
    <button
      type="button"
      {...shared}
      onClick={onToggle}
      /* Inside an answer this sits on the highlighter's surface, where a
         pointerdown starts drawing a marker. The click is for the row. */
      onPointerDown={(event) => event.stopPropagation()}
      aria-expanded={open}
      aria-controls={controls}
      disabled={disabled}
    >
      {inside}
    </button>
  );
}
