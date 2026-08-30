"use client";

import { useId, useState, type HTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Brain, ChevronDown } from "lucide-react";
import { useDisclosure } from "../disclosure/useDisclosure";
import { formatDuration } from "../duration/formatDuration";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./Reasoning.module.css";

/** Still working it out, or finished. */
export type ReasoningState = "thinking" | "done";

type Labels = Record<"thinking" | "thought" | "thoughtFor", string>;

const LABELS: Labels = {
  thinking: "Thinking",
  thought: "Thought",
  /** Followed by the duration: "Thought for 12s". */
  thoughtFor: "Thought for",
};

export interface ReasoningProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The thinking itself. Prose, not structure — see `Tool` for that. */
  children: ReactNode;
  state?: ReasoningState;
  /**
   * How long it took, in ms.
   *
   * Left out, the block times itself: it starts a clock when it begins
   * thinking and reads it when it stops. Pass one when you already know —
   * replaying a transcript, where the thinking did not happen just now.
   */
  duration?: number;
  /** Controlled. Leave it out and the block looks after itself. */
  open?: boolean;
  /** Where it starts, overruling the block's own preference. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: Partial<Labels>;
}

/**
 * What the model worked through before it answered.
 *
 * **Open while it thinks, folded away once the answer starts.** That is the
 * one detail every kit that ships this has converged on, and it is right:
 * thinking is worth watching while it is happening and worth almost nothing
 * afterwards — but it has to stay reachable, because the times it matters are
 * exactly the times the answer looks wrong.
 *
 * Folding is the block's *preference*, not something done to the reader. Open
 * it and it stays open, however many times the state changes underneath.
 */
export function Reasoning({
  children,
  state = "done",
  duration,
  open,
  defaultOpen,
  onOpenChange,
  labels,
  className,
  ...rest
}: ReasoningProps) {
  const label = { ...LABELS, ...labels };
  const bodyId = useId();
  const still = prefersReducedMotion();
  const thinking = state === "thinking";

  const { isOpen, toggle } = useDisclosure({
    open,
    defaultOpen,
    onOpenChange,
    preferOpen: thinking,
  });

  /* Timed here rather than asked of the host, which would only be reading the
     same clock. Adjusted during render on a change of state rather than in an
     effect: an effect would mean a second pass every time the thinking stops,
     and React documents this as the way to derive state from a prop that
     changed. `was` is what makes it run once per change rather than once per
     render. */
  const [was, setWas] = useState(thinking);
  const [clock, setClock] = useState<{ from: number | null; took: number | null }>(() => ({
    from: thinking ? Date.now() : null,
    took: null,
  }));

  if (was !== thinking) {
    setWas(thinking);
    setClock((c) =>
      thinking
        ? { from: Date.now(), took: null }
        : { from: null, took: c.from === null ? null : Date.now() - c.from }
    );
  }

  const took = duration ?? clock.took;
  const time = thinking || took === null ? "" : formatDuration(took);

  return (
    <div
      className={[styles.reasoning, className ?? ""].filter(Boolean).join(" ")}
      data-state={state}
      {...rest}
    >
      <button
        type="button"
        className={styles.header}
        onClick={toggle}
        /* Inside an answer this sits on the highlighter's surface, where a
           pointerdown starts drawing a marker. The click is for the row. */
        onPointerDown={(event) => event.stopPropagation()}
        aria-expanded={isOpen}
        aria-controls={bodyId}
      >
        <Brain className={styles.glyph} size={14} aria-hidden />

        {/* The word shimmers while it is happening, which is how this kit
            says "provisional" everywhere else. Its own element rather than a
            `<Loader variant="shimmer">`: the loader is decorative and marks
            itself `aria-hidden`, and this word is the button's name. Hiding it
            would leave a control with nothing to call it.

            No counter either. A number ticking up while somebody waits is a
            stopwatch pointed at them. */}
        <span className={styles.label} data-shimmer={thinking || undefined}>
          {thinking ? label.thinking : time ? `${label.thoughtFor} ${time}` : label.thought}
        </span>

        <ChevronDown className={styles.chevron} size={14} aria-hidden />
      </button>

      {/* Always rendered, so `aria-controls` always points at something. */}
      <div id={bodyId} className={styles.bodyOuter}>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="body"
              className={styles.body}
              initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={still ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: still ? 0.12 : 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className={styles.bodyInner}>{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
