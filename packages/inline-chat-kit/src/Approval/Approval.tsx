"use client";

import { useId, type HTMLAttributes, type ReactNode } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "../Button/Button";
import styles from "./Approval.module.css";

/** Once, every time from now on, or not at all. */
export type Decision = "once" | "always" | "denied";

type Labels = Record<"once" | "always" | "deny", string> &
  Record<"allowedOnce" | "allowedAlways" | "wasDenied" | "pending", string>;

const LABELS: Labels = {
  once: "Allow once",
  always: "Always allow",
  deny: "Deny",
  allowedOnce: "Allowed once",
  allowedAlways: "Allowed from now on",
  wasDenied: "Denied",
  pending: "Waiting for you",
};

export interface ApprovalProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** What is being asked. One line: "Run a command in your shell". */
  title: ReactNode;
  /** Why it is being asked, or what it will touch. */
  description?: ReactNode;
  /**
   * The thing itself — usually a `<Tool>` or a `<CodeBlock>`.
   *
   * Somebody deciding needs to see what they are deciding about, and a name is
   * not that. An approval with nothing under it is asking for a signature on a
   * blank page.
   */
  children?: ReactNode;
  /** `null` while it is still being asked. */
  decision?: Decision | null;
  onDecide?: (decision: Decision) => void;
  /** Nothing can be decided from here — a record of a decision already made. */
  readOnly?: boolean;
  labels?: Partial<Labels>;
}

const SETTLED: Record<Decision, keyof Labels> = {
  once: "allowedOnce",
  always: "allowedAlways",
  denied: "wasDenied",
};

/**
 * "It wants to do this. Is that all right?"
 *
 * The one pattern from a coding agent that generalises to any agent that acts,
 * and the only component in this kit whose whole job is to slow somebody down
 * for a moment.
 *
 * Three decisions rather than two, because "yes" and "yes forever" are not the
 * same answer and a UI offering one button for both collects the wrong one.
 * **Allow once is the primary**: the narrow permission is the one that should
 * be easiest to give, and the standing one should cost a moment's thought.
 *
 * Decided, it stops being a set of buttons and becomes a record of what was
 * decided. Leaving live controls under a decision already made invites a
 * second, contradictory one.
 */
export function Approval({
  title,
  description,
  children,
  decision = null,
  onDecide,
  readOnly = false,
  labels,
  className,
  ...rest
}: ApprovalProps) {
  const label = { ...LABELS, ...labels };
  const titleId = useId();
  const settled = decision !== null;

  return (
    <section
      className={[styles.approval, className ?? ""].filter(Boolean).join(" ")}
      data-decision={decision ?? undefined}
      aria-labelledby={titleId}
      {...rest}
    >
      <div className={styles.head}>
        <ShieldCheck className={styles.glyph} size={15} aria-hidden />
        <div className={styles.headText}>
          <p className={styles.title} id={titleId}>
            {title}
          </p>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>

      {/* What is actually being asked for. */}
      {children && <div className={styles.subject}>{children}</div>}

      {settled ? (
        /* A record, not a control. Live buttons under a decision already made
           invite a second one that contradicts the first. */
        <p className={styles.settled} data-decision={decision}>
          {decision === "denied" ? (
            <X size={13} aria-hidden />
          ) : (
            <Check size={13} aria-hidden />
          )}
          {label[SETTLED[decision]]}
        </p>
      ) : (
        /* Three weights for three answers, in the order they should be reached
           for: filled for the narrow yes, outlined for the standing one, flat
           for no. Two outlined buttons beside each other said the last two were
           equals, which they are not.

           Deny stays first in the DOM, so a keyboard lands on the safe answer
           without tabbing past two that say yes. */
        !readOnly && (
          <div className={styles.actions}>
            <Button
              variant="ghost"
              size="m"
              className={styles.deny}
              onClick={() => onDecide?.("denied")}
            >
              {label.deny}
            </Button>
            <Button variant="outline" size="m" onClick={() => onDecide?.("always")}>
              {label.always}
            </Button>
            <Button variant="primary" size="m" onClick={() => onDecide?.("once")}>
              {label.once}
            </Button>
          </div>
        )
      )}
    </section>
  );
}
