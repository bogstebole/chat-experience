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
 * Springs for anything that moves, tweens for opacity alone.
 *
 * That split is not a preference. A spring is a description of *travel* —
 * where a thing is going and how it arrives — and opacity has nowhere to
 * travel: it is bounded at 0 and 1, so a spring with any bounce in it
 * overshoots into a clamp and spends the overshoot sitting still. Position and
 * size have no such ceiling, which is exactly why they are worth springing.
 *
 * `visualDuration` rather than stiffness and damping, for the same reason
 * throughout: the two of them describe one spring between them without either
 * answering "how long is this", which is the only question anybody tuning it
 * is asking. Motion solves the spring for the duration you name.
 */
export interface FoldMotion {
  /** How long the ground looks like it takes to resize, in seconds. */
  visualDuration: number;
  /** The ground's overshoot, 0–1. */
  bounce: number;
  /** How long a row takes to arrive, in seconds. */
  rowDuration: number;
  /** A row's overshoot, 0–1. Enough to read as arriving, not as bouncing. */
  rowBounce: number;
  /** How far above its place a row starts, in pixels. */
  rowOffset: number;
  /** Between one row and the next, in seconds. */
  stagger: number;
  /** A row's fade, in seconds. Tween: see the note above. */
  fadeIn: number;
  /** And the fade of one leaving. */
  fadeOut: number;
}

export const defaultFoldMotion: FoldMotion = {
  visualDuration: 0.34,
  bounce: 0.1,
  rowDuration: 0.3,
  rowBounce: 0.12,
  rowOffset: -10,
  stagger: 0.045,
  fadeIn: 0.16,
  fadeOut: 0.1,
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
  /* True for the length of one fold, and off again after. See the note over
     `[data-moving]` in the stylesheet. */
  const [moving, setMoving] = useState(false);
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

  /* What a body does, one row at a time.
  
     This was a crossfade between two blocks: the summary dissolving into the
     list and back. A dissolve is what you reach for when two things are
     unrelated, and these are not — the row and the stack are the same answers
     in two states. It read as the box moving while the content sat there
     bleeding through itself.
  
     Rows arrive instead, each one a little above its place and settling into
     it, one after the next, and leave the same way. The ground follows them
     rather than the other way round. */
  const bodyVariants = {
    /* Both directions stagger the same way round. The conventional mirror —
       last in, first out — is right when a thing is being *dismissed*, because
       it unwinds the way it was built. This is not a dismissal: it is one body
       being replaced by another on the same edge, and the two are the same
       answers. Read forwards both ways, leaving and arriving are one gesture
       passing through the row rather than two gestures meeting in the middle. */
    hidden: { transition: { staggerChildren: still ? 0 : beat.stagger } },
    shown: { transition: { staggerChildren: still ? 0 : beat.stagger } },
  };

  /* One spring, both directions. A row leaving used to be a plain tween while a
     row arriving was sprung, which made collapsing a different gesture from
     expanding rather than the same one run backwards. */
  const travel = (fade: number) =>
    still
      ? { duration: 0 }
      : {
          type: "spring" as const,
          visualDuration: beat.rowDuration,
          bounce: beat.rowBounce,
          /* Opacity is bounded, so it gets the tween. See `FoldMotion`. */
          opacity: { duration: fade },
        };

  const rowMotion = {
    hidden: { opacity: 0, y: still ? 0 : beat.rowOffset, transition: travel(beat.fadeOut) },
    shown: { opacity: 1, y: 0, transition: travel(beat.fadeIn) },
  };

  const bodyMotion = {
    variants: bodyVariants,
    initial: "hidden" as const,
    animate: "shown" as const,
    exit: "hidden" as const,
    /* The arriving body finishing is when the fold is over. Both bodies carry
       this, and the leaving one finishes first — clearing on that took the
       layers away at 165ms with the rows still travelling until 300. */
    onAnimationComplete: (definition: unknown) => {
      if (definition === "shown") setMoving(false);
    },
  };

  return (
    <LayoutGroup id={id}>
      <motion.div
        ref={groundRef}
        layout={!still}
        transition={resize}
        className={[styles.group, className ?? ""].filter(Boolean).join(" ")}
        data-moving={moving || undefined}
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
              onToggle={
              collapsible
                ? () => {
                    setMoving(true);
                    setExpanded((open) => !open);
                  }
                : undefined
            }
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
                 body above them.

                 Each body is a list of rows even when it holds one, so that
                 both sides of the fold arrive by the same rule. */
              <motion.div key="summary" {...bodyMotion}>
                <motion.div variants={rowMotion} className={styles.summary}>
                  <span className={styles.count}>
                    {questions.length} {label.answers}
                  </span>
                  <span className={styles.summaryList}>{summary}</span>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div key="list" className={styles.list} {...bodyMotion}>
                {questions.map((question, i) => (
                  <motion.div key={question.id} variants={rowMotion} className={styles.row}>
                    <QuestionCard
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
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </LayoutGroup>
  );
}
