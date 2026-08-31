"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { QuestionCard } from "../QuestionCard/QuestionCard";
import { DisclosureHeader } from "../disclosure/DisclosureHeader";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import type { Answer, Question } from "../QuestionCard/types";
import { useCorrectedRadius } from "../radiusCorrection/useCorrectedRadius";
import styles from "./QuestionGroup.module.css";

/** Below this, folding saves less room than the summary row costs. */
export const FOLDABLE_FROM = 3;

export interface QuestionGroupProps {
  /** Distinguishes one group's layout animations from another's. */
  id: string;
  /**
   * What this step is about, at the top of the group.
   *
   * Also the fold control when there is one — which is the point of putting it
   * there. A control at the top does not move when the thing under it opens,
   * so folding stops being two shapes swapping places and becomes a body
   * changing under a header that stays put.
   *
   * Left out on a foldable group, the count stands in, so the control still
   * has a name.
   */
  title?: ReactNode;
  questions: Question[];
  answers: Record<string, Answer | undefined>;
  /** Index of the question being answered, or `null` when none is. */
  activeIndex?: number | null;
  /** Offer to fold the whole group into one row. */
  collapsible?: boolean;
  onCommit?: (questionId: string, answer: Answer) => void;
  onEdit?: (index: number) => void;
  readOnly?: boolean;
  labels?: Partial<Record<"answers", string>>;
  className?: string;
}

/* `hide` went with the pill that used to say it. The header carries the
   section's name in both states now, so there is nothing left to word. */
const DEFAULT_LABELS = { answers: "answers" };

/**
 * One step of a questionnaire: the surface holding its questions.
 *
 * Once the conversation has moved past it, it folds down to a single row.
 * Not a peek at the list — a peek costs more height than the answers it shows,
 * and a conversation with four half-open steps above it is unreadable.
 */
export function QuestionGroup({
  id,
  title,
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
  const bodyId = useId();
  const groundRef = useRef<HTMLDivElement>(null);
  const groundRadius = useCorrectedRadius(groundRef);
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
        ref={groundRef}
        layout={!still}
        className={[styles.group, className ?? ""].filter(Boolean).join(" ")}
        /* Handed to Motion so it can keep the corner round while it scales the
           box. See `useCorrectedRadius`. */
        style={{ borderRadius: groundRadius }}
      >
        {/* The section's name, at the top, and the fold control when there is
            one. At the top because a control that does not move is the whole
            trick: folding stops being two shapes swapping places and becomes a
            body changing under a header that stays put.
        
            Without a title a foldable group falls back to the count, so the
            control still has a name; without either there is no header at all
            and the group is the list, as it was. */}
        {(title || collapsible) && (
          <DisclosureHeader
            open={!folded}
            onToggle={collapsible ? () => setExpanded((open) => !open) : undefined}
            controls={bodyId}
            label={title ?? `${questions.length} ${label.answers}`}
          />
        )}

        <div id={bodyId} className={styles.body}>
          <AnimatePresence initial={false} mode="popLayout">
            {folded ? (
              <motion.div key="summary" className={styles.summary} {...content}>
                <span className={styles.count}>
                  {questions.length} {label.answers}
                </span>
                <span className={styles.summaryList}>{summary}</span>
              </motion.div>
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
                    state={
                      i === activeIndex
                        ? "active"
                        : answers[question.id]
                          ? "collapsed"
                          : "upcoming"
                    }
                    answer={answers[question.id]}
                    readOnly={readOnly}
                    onCommit={(answer) => onCommit?.(question.id, answer)}
                    onEdit={() => onEdit?.(i)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </LayoutGroup>
  );
}
