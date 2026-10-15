"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { motion, type Variants } from "motion/react";
import { KitButton } from "../Button/KitButton";
import { useLabels } from "../labels/labels";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps
  // `title` is a DOM attribute as well as a prop here, and the DOM's is a
  // plain string. Ours wins: a heading can be a node.
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  /**
   * Openers. A blank input asks somebody to think of something; these are for
   * the moment before they have.
   */
  suggestions?: string[];
  /** Given the suggestion's text. Without it, none are drawn. */
  onSuggestion?: (text: string) => void;
  suggestionsLabel?: string;
  children?: ReactNode;
}

/**
 * How each piece leaves, when whatever holds this one exits as `"leave"`.
 *
 * To the left, a little blurred, one after another: read as the openers
 * stepping out of the way of the message that was just sent, rather than
 * vanishing under it. Fast, because by then nobody is looking at them — they
 * are the past. Ease-out, so the first frame already moves. The blur is what
 * makes a short slide read as leaving rather than as a nudge.
 *
 * Inert anywhere else: nothing here animates on its own.
 */
const LEAVE_STAGGER = 0.025;
const leave: Variants = {
  leave: (order: number) => ({
    opacity: 0,
    x: -24,
    filter: "blur(4px)",
    transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1], delay: order * LEAVE_STAGGER },
  }),
};

/**
 * What is on screen before anybody has asked anything.
 *
 * Not a landmark and not a heading by default — this sits inside a
 * conversation the host already owns, and claiming a level in their document
 * is not ours to do. `title` renders as text; wrap it yourself if it should be
 * a heading.
 */
export function EmptyState({
  icon,
  title,
  description,
  suggestions,
  onSuggestion,
  suggestionsLabel: suggestionsProp,
  children,
  className,
  ...rest
}: EmptyStateProps) {
  const fallback = useLabels("emptyState").suggestions;
  const suggestionsLabel = suggestionsProp ?? fallback;
  const chips = onSuggestion ? (suggestions ?? []) : [];

  return (
    <div className={[styles.empty, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {icon && (
        <motion.div className={styles.icon} variants={leave} custom={0}>
          {icon}
        </motion.div>
      )}
      {title && (
        <motion.div className={styles.title} variants={leave} custom={0}>
          {title}
        </motion.div>
      )}
      {description && (
        <motion.p className={styles.description} variants={leave} custom={1}>
          {description}
        </motion.p>
      )}

      {chips.length > 0 && (
        <div className={styles.suggestions} role="group" aria-label={suggestionsLabel}>
          {chips.map((text, i) => (
            <motion.span key={text} className={styles.chip} variants={leave} custom={i + 2}>
              {/* `primary`, not `secondary`. The secondary button is
                  transparent until it is hovered, which for an opener means it
                  reads as a line of bold text rather than as something to
                  press — and an opener nobody recognises as pressable is one
                  nobody presses. */}
              <KitButton
                variant="primary"
                size="m"
                kitRole="suggestion"
                shape="pill"
                onClick={() => onSuggestion?.(text)}
              >
                {text}
              </KitButton>
            </motion.span>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
