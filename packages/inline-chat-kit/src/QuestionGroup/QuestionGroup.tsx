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

/**
 * What the fold is made of, in numbers.
 *
 * Two of them, deliberately. `visualDuration` is how long the box *looks* like
 * it takes — Motion solves the spring for it — and `bounce` is how much it
 * overshoots. Stiffness and damping describe the same spring and neither one
 * answers "how long is this", which is the only question anybody tuning it is
 * actually asking.
 *
 * The fades are separate because they are not the same event: the box changing
 * size and the content changing identity happen together and want different
 * lengths. The old numbers had the incoming body waiting 100ms — a tenth of a
 * second of a grown, empty box, which is most of what read as a flicker.
 */
export interface FoldMotion {
  /** How long the box looks like it takes to resize, in seconds. */
  visualDuration: number;
  /** Overshoot, 0–1. At 0 it settles without passing the target. */
  bounce: number;
  /** The arriving body's fade, in seconds. */
  fadeIn: number;
  /** How long it waits first. Enough to not cross the leaving body, no more. */
  fadeInDelay: number;
  /** The leaving body's fade, in seconds. */
  fadeOut: number;
}

export const defaultFoldMotion: FoldMotion = {
  visualDuration: 0.32,
  bounce: 0.08,
  /* A real crossfade: both bodies sit on the same top edge, so the arriving
     one starts the moment the leaving one does. With the old delay of 0.1 the
     box was grown and empty for a tenth of a second. Sampled at the midpoint
     the two now sum to about 0.9 of an opaque body rather than 0.4. */
  fadeIn: 0.18,
  fadeInDelay: 0,
  fadeOut: 0.14,
};

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
  /** Overrides for the fold's timing. See `defaultFoldMotion`. */
  foldMotion?: Partial<FoldMotion>;
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
  foldMotion,
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

  const beat = { ...defaultFoldMotion, ...foldMotion };

  /* The box's own resize. Handed to every element that carries `layout` here,
     so the ground and the things inside it move on one clock — a header
     counter-scaling on a different spring to the box scaling it is a header
     that visibly lags. */
  const resize = still
    ? { duration: 0 }
    : { type: "spring" as const, visualDuration: beat.visualDuration, bounce: beat.bounce };

  const content = {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: still ? 0 : beat.fadeIn, delay: still ? 0 : beat.fadeInDelay },
    },
    exit: { opacity: 0, transition: { duration: still ? 0 : beat.fadeOut } },
  };

  return (
    <LayoutGroup id={id}>
      <motion.div
        ref={groundRef}
        layout={!still}
        transition={resize}
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
          /* `layout="position"` and not decoration.

             The ground animates its height the only way Motion animates a
             size: it sets the new one in the DOM and scales the box back. So
             every child that is not itself a layout child rides that scale,
             and this one is a line of type. Measured over one open: the header
             was squashed to 11.67px of its 23 in a single frame and stretched
             back over the next 450ms, the title with it — which is exactly
             what "it flickers and jumps around" looks like when you slow it
             down. `position` is the right half of it: the header does not
             move, so all it needs is the scale taken back off. */
          <motion.div layout={still ? false : "position"} transition={resize}>
            <DisclosureHeader
              open={!folded}
              onToggle={collapsible ? () => setExpanded((open) => !open) : undefined}
              controls={bodyId}
              label={title ?? `${questions.length} ${label.answers}`}
            />
          </motion.div>
        )}

        <motion.div
          id={bodyId}
          layout={still ? false : "position"}
          transition={resize}
          className={styles.body}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {folded ? (
              /* No `layout` on either body, deliberately. `popLayout` takes
                 the leaving one out of flow, and `layout` then animates it
                 toward wherever it resolves to once absolute — measured, the
                 summary left its own row and travelled 67px down the moment it
                 popped, so it faded out somewhere it had never been. Scale
                 correction is what these needed and they inherit it from the
                 body above them. */
              <motion.div key="summary" className={styles.summary} {...content}>
                <span className={styles.count}>
                  {questions.length} {label.answers}
                </span>
                <span className={styles.summaryList}>{summary}</span>
              </motion.div>
            ) : (
              <motion.div key="list" className={styles.list} {...content}>
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
        </motion.div>
      </motion.div>
    </LayoutGroup>
  );
}
