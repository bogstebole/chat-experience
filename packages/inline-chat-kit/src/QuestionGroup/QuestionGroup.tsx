"use client";

import { useState, useRef } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { QuestionCard } from "../QuestionCard/QuestionCard";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import type { Answer, Question } from "../QuestionCard/types";
import { useCorrectedRadius } from "../radiusCorrection/useCorrectedRadius";
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
        <AnimatePresence initial={false} mode="popLayout">
          {!folded && (
            <motion.div key="list" layout={still ? false : "position"} className={styles.list} {...content}>
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

        {/* One control, in both states.
        
            It used to be two: a full-width card when folded, and a centred pill
            underneath the list when expanded. Two shapes for one job, so the
            fold cross-faded a button through a div and neither knew where the
            other had been.
        
            The same element now, kept mounted, so Motion moves it instead of
            replacing it — and the row reads the same going both ways. */}
        {collapsible && (
          <motion.button
            layout={still ? false : "position"}
            type="button"
            className={styles.summary}
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
          >
            {folded ? (
              <>
                <span className={styles.count}>
                  {questions.length} {label.answers}
                </span>
                <span className={styles.summaryList}>{summary}</span>
              </>
            ) : (
              <span className={styles.summaryList} data-hide>
                {label.hide}
              </span>
            )}
            <ChevronDown
              className={styles.chevron}
              data-open={expanded || undefined}
              size={14}
              aria-hidden
            />
          </motion.button>
        )}
      </motion.div>
    </LayoutGroup>
  );
}
