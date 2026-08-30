"use client";

import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Context.module.css";

type Labels = {
  name: string;
  /** Between the two numbers: "128k of 1M". */
  of: string;
  tokens: string;
  /** Said once it is past `warnAt`, and it should say what happens next. */
  nearlyFull: string;
};

const LABELS: Labels = {
  name: "Context used",
  of: "of",
  tokens: "tokens",
  nearlyFull: "Nearly full — the oldest messages will start dropping out",
};

export interface ContextProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  used: number;
  total: number;
  /** Where it stops being quiet. A fraction, default `0.8`. */
  warnAt?: number;
  /**
   * Drawn beside the ring. The percentage by default; `false` for the ring on
   * its own, which is what a header usually wants.
   */
  label?: ReactNode | false;
  labels?: Partial<Labels>;
}

/** `128000` → `128k`, `1000000` → `1M`. Nobody reads the zeroes. */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m < 10 ? Number(m.toFixed(1)) : Math.round(m)}M`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    return `${k < 10 ? Number(k.toFixed(1)) : Math.round(k)}k`;
  }
  return String(Math.round(n));
}

const RADIUS = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How full the context window is.
 *
 * Small on purpose. It is a gauge, not a feature, and it earns its place for
 * one reason: it is the only honest way to explain why a long conversation
 * starts forgetting. Without it the forgetting looks like the model being
 * stupid rather than the window being full.
 *
 * Which is why the warning says what happens next rather than only that a
 * number is high. "82%" tells somebody nothing they can act on.
 */
export function Context({
  used,
  total,
  warnAt = 0.8,
  label,
  labels,
  className,
  ...rest
}: ContextProps) {
  const label_ = { ...LABELS, ...labels };

  /* A total of zero is a window that has not been reported yet, not one that
     is full. Clamped, because a host summing its own tokens will overshoot
     before it notices. */
  const fraction = total > 0 ? Math.min(1, Math.max(0, used / total)) : 0;
  const percent = Math.round(fraction * 100);
  const warn = fraction >= warnAt;

  const shown = label === false ? null : (label ?? `${percent}%`);
  const spoken = `${label_.name}: ${percent}%, ${formatCount(used)} ${label_.of} ${formatCount(
    total
  )} ${label_.tokens}${warn ? `. ${label_.nearlyFull}` : ""}`;

  return (
    <div
      className={[styles.context, className ?? ""].filter(Boolean).join(" ")}
      data-warn={warn || undefined}
      /* A gauge within a known range, which is what a meter is for. The
         numbers are on it rather than only in the label, so assistive
         technology can read the value without parsing a sentence. */
      role="meter"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={spoken}
      // The same sentence for a pointer, since the ring alone says a fraction
      // and not what to do about it.
      title={spoken}
      {...rest}
    >
      <svg className={styles.ring} viewBox="0 0 16 16" aria-hidden focusable="false">
        <circle className={styles.track} cx="8" cy="8" r={RADIUS} />
        <circle
          className={styles.fill}
          cx="8"
          cy="8"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          /* From the top rather than from three o'clock, because a gauge that
             starts anywhere else reads as decoration. */
          transform="rotate(-90 8 8)"
        />
      </svg>
      {shown !== null && <span className={styles.label}>{shown}</span>}
    </div>
  );
}
