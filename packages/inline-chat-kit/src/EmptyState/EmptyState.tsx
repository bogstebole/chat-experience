"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { Button } from "../Button/Button";
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
  suggestionsLabel = "Suggestions",
  children,
  className,
  ...rest
}: EmptyStateProps) {
  const chips = onSuggestion ? (suggestions ?? []) : [];

  return (
    <div className={[styles.empty, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      {icon && <div className={styles.icon}>{icon}</div>}
      {title && <div className={styles.title}>{title}</div>}
      {description && <p className={styles.description}>{description}</p>}

      {chips.length > 0 && (
        <div className={styles.suggestions} role="group" aria-label={suggestionsLabel}>
          {chips.map((text) => (
            /* `primary`, not `secondary`. The secondary button is transparent
               until it is hovered, which for an opener means it reads as a
               line of bold text rather than as something to press — and an
               opener nobody recognises as pressable is one nobody presses. */
            <Button key={text} variant="primary" size="m" onClick={() => onSuggestion?.(text)}>
              {text}
            </Button>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
