"use client";

import { useId, type HTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import { StateGlyph, type WorkState } from "../stateGlyph/StateGlyph";
import { useDisclosure } from "../disclosure/useDisclosure";
import { DisclosureHeader } from "../disclosure/DisclosureHeader";
import { DisclosureBody } from "../disclosure/DisclosureBody";
import { formatDuration } from "../duration/formatDuration";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./ChainOfThought.module.css";

/** One step of a derivation: what was worked out, and the working. */
export interface Thought {
  id: string;
  /** What this step established. One line. */
  label: ReactNode;
  /** The working behind it. Prose, or anything you want drawn — a `Tool`, say. */
  body?: ReactNode;
  /** Defaults to `done`: a step you can read is a step that happened. */
  state?: WorkState;
}

type Labels = {
  /** Followed by the count: "Thought through 4 steps". */
  through: string;
  step: string;
  steps: string;
  thinking: string;
};

const LABELS: Labels = {
  through: "Thought through",
  step: "step",
  steps: "steps",
  thinking: "Thinking",
};

export interface ChainOfThoughtProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  steps: Thought[];
  /** The chain as a whole. `thinking` holds it open and narrates the last step. */
  state?: "thinking" | "done";
  /** How long the whole chain took, in ms. */
  duration?: number;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: Partial<Labels>;
}

/**
 * How the answer was arrived at, step by step.
 *
 * The third thing in this kit that draws a sequence, and the line between them
 * is worth stating because it is the only reason there are three:
 *
 * - **`Reasoning`** is prose. The model talking to itself, unstructured.
 * - **`TaskList`** is a plan. Known up front, forward-looking, fixed order,
 *   items changing state as work happens.
 * - **`ChainOfThought`** is a derivation. Backward-looking, and it *grows* —
 *   each step follows from the one above it, which is what the line down the
 *   side is drawing. A step carries its own working, not a footnote.
 *
 * Open while it thinks and folded away once the answer starts, on the same
 * terms as `Reasoning`: the chain's preference, overruled for good by anybody
 * who touches it.
 */
export function ChainOfThought({
  steps,
  state = "done",
  duration,
  open,
  defaultOpen,
  onOpenChange,
  labels,
  className,
  ...rest
}: ChainOfThoughtProps) {
  const label = { ...LABELS, ...labels };
  const listId = useId();
  const still = prefersReducedMotion();
  const thinking = state === "thinking";

  const { isOpen, toggle } = useDisclosure({
    open,
    defaultOpen,
    onOpenChange,
    preferOpen: thinking,
  });

  /* While it is running the header narrates the step it is on — which is the
     one question somebody watching is asking, and the reason to look at a
     folded chain at all. */
  const running = thinking
    ? steps.find((s) => (s.state ?? "done") === "running") ?? steps[steps.length - 1]
    : undefined;

  const time = thinking ? "" : formatDuration(duration ?? NaN);
  const counted = `${label.through} ${steps.length} ${steps.length === 1 ? label.step : label.steps}`;

  return (
    <section
      className={[styles.chain, className ?? ""].filter(Boolean).join(" ")}
      data-state={state}
      {...rest}
    >
      {/* An aside in the flow of an answer, like `Reasoning`'s — it takes the
          width of its own words rather than a band's. */}
      <DisclosureHeader
        fit="inline"
        open={isOpen}
        onToggle={toggle}
        controls={listId}
        glyph={<StateGlyph state={thinking ? "running" : "done"} />}
        /* While it runs the header narrates the step it is on, which is the
           one question somebody watching a folded chain is asking. */
        label={thinking ? (running?.label ?? label.thinking) : counted}
        pending={thinking}
        meta={time || undefined}
      />

      <DisclosureBody id={listId} open={isOpen && steps.length > 0}>
        <ol className={styles.list}>
          <AnimatePresence initial={false}>
            {steps.map((step) => {
              const stepState = step.state ?? "done";
              return (
                <motion.li
                  key={step.id}
                  className={styles.step}
                  data-state={stepState}
                  aria-current={stepState === "running" ? "step" : undefined}
                  initial={still ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={still ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: still ? 0.12 : 0.2 }}
                >
                  <span className={styles.rail} aria-hidden>
                    <StateGlyph state={stepState} />
                  </span>
                  <span className={styles.body}>
                    <span className={styles.stepLabel}>{step.label}</span>
                    {step.body && <span className={styles.working}>{step.body}</span>}
                  </span>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      </DisclosureBody>
    </section>
  );
}
