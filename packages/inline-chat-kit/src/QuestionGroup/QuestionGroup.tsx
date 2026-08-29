"use client";

import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { Button } from "../Button/Button";
import { QuestionCard } from "../QuestionCard/QuestionCard";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import type { Answer, Question } from "../QuestionCard/types";
import styles from "./QuestionGroup.module.css";

/** Below this, folding saves less room than the summary row costs. */
export const FOLDABLE_FROM = 3;

export interface QuestionGroupProps {
  /** Distinguishes one group's layout animations from another's. */
  id: string;
  questions: Question[];
  answers: Record<string, Answer | undefined>;
  /** Index of the question being answered, or `null` when none is. */
  activeIndex?: number | null;
  /** Offer to fold the whole group into one row. */
  collapsible?: boolean;
  onCommit?: (questionId: string, answer: Answer) => void;
  onEdit?: (index: number) => void;
  readOnly?: boolean;
  labels?: Partial<Record<"answers" | "hide", string>>;
  className?: string;
}

const DEFAULT_LABELS = { answers: "answers", hide: "Hide answers" };

/**
 * One step of a questionnaire: the surface holding its questions.
 *
 * Once the conversation has moved past it, it folds down to a single row.
 * Not a peek at the list — a peek costs more height than the answers it shows,
 * and a conversation with four half-open steps above it is unreadable.
 */
export function QuestionGroup({
  id,
  questions,
  answers,
  activeIndex = null,
  collapsible = false,
  onCommit,
  onEdit,
  readOnly = false,
  labels,
  className,
}: QuestionGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const label = { ...DEFAULT_LABELS, ...labels };
  const still = prefersReducedMotion();
  const folded = collapsible && !expanded;

  const summary = questions.map((q) => q.shortTitle).join(" · ");

  const content = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2, delay: still ? 0 : 0.1 } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
  };

  return (
    <LayoutGroup id={id}>
      <motion.div
        layout={!still}
        className={[styles.group, className ?? ""].filter(Boolean).join(" ")}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          {folded ? (
            <motion.button
              key="summary"
              type="button"
              layout={still ? false : "position"}
              className={styles.summary}
              onClick={() => setExpanded(true)}
              aria-expanded={false}
              {...content}
            >
              <span className={styles.count}>
                {questions.length} {label.answers}
              </span>
              <span className={styles.summaryList}>{summary}</span>
              <ChevronDown className={styles.chevron} size={14} aria-hidden />
            </motion.button>
          ) : (
            <motion.div
              key="list"
              layout={still ? false : "position"}
              className={styles.list}
              {...content}
            >
              {questions.map((question, i) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  number={i + 1}
                  state={i === activeIndex ? "active" : answers[question.id] ? "collapsed" : "upcoming"}
                  answer={answers[question.id]}
                  readOnly={readOnly}
                  onCommit={(answer) => onCommit?.(question.id, answer)}
                  onEdit={() => onEdit?.(i)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {collapsible && expanded && (
          <div className={styles.toggle}>
            <Button variant="secondary" size="m" onClick={() => setExpanded(false)} aria-expanded>
              {label.hide}
              <ChevronDown className={styles.chevronUp} size={14} aria-hidden />
            </Button>
          </div>
        )}
      </motion.div>
    </LayoutGroup>
  );
}
