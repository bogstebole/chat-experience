"use client";

import type { HTMLAttributes } from "react";
import styles from "./Loader.module.css";

export type LoaderVariant = "dots" | "shimmer";

export interface LoaderProps extends HTMLAttributes<HTMLDivElement> {
  variant?: LoaderVariant;
  /** The words the shimmer runs through. Ignored by `dots`. */
  children?: React.ReactNode;
  /**
   * What a screen reader is told, if anything.
   *
   * `null` by default, and that is deliberate: `useChatTurns` already
   * announces that a response is coming, and a second live region saying the
   * same thing means hearing it twice. Pass a string only when nothing else
   * is speaking for you.
   */
  label?: string | null;
}

/**
 * The gap between sending and the first word arriving.
 *
 * `dots` for that gap, when there is nothing to show yet. `shimmer` for words
 * that are standing in for something — a status line that has not settled.
 */
export function Loader({
  variant = "dots",
  children,
  label = null,
  className,
  ...rest
}: LoaderProps) {
  const classes = [styles.loader, styles[variant], className ?? ""].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      // Decorative unless it is given something to say. See `label`.
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      {...rest}
    >
      {label && <span className={styles.srOnly}>{label}</span>}
      {variant === "dots" ? (
        <>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </>
      ) : (
        <span className={styles.text}>{children}</span>
      )}
    </div>
  );
}
