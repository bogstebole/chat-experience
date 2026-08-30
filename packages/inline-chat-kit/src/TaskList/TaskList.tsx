"use client";

import { useId, type HTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { StateGlyph, type WorkState } from "../stateGlyph/StateGlyph";
import { useDisclosure } from "../disclosure/useDisclosure";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./TaskList.module.css";

/** The same four as a tool call. See `StateGlyph`. */
export type TaskState = WorkState;

export interface Task {
  id: string;
  label: ReactNode;
  state?: TaskState;
  /** A line under the label — what it found, or why it failed. */
  detail?: ReactNode;
}

type Labels = Record<TaskState, string> & {
  /** `{done}` and `{total}` are filled in. */
  progress: string;
};

const LABELS: Labels = {
  pending: "Queued",
  running: "In progress",
  done: "Done",
  error: "Failed",
  progress: "{done} of {total}",
};

export interface TaskListProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  tasks: Task[];
  /** Names the list, and gives it a row to fold into. */
  title?: ReactNode;
  /**
   * Let the whole list fold away.
   *
   * It folds itself once every task is done — a plan is worth watching while
   * it runs and worth little afterwards — and anybody reading it can overrule
   * that, in either direction, for good.
   */
  collapsible?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: Partial<Labels>;
}

/**
 * What the agent means to do, what it is doing, and what it has finished.
 *
 * The order never changes. A list that sorted itself as work progressed would
 * move the line somebody is reading out from under them, and the sequence is
 * half of what the list is saying — these steps, in this order. Only the
 * glyphs change.
 */
export function TaskList({
  tasks,
  title,
  collapsible = false,
  open,
  defaultOpen,
  onOpenChange,
  labels,
  className,
  ...rest
}: TaskListProps) {
  const label = { ...LABELS, ...labels };
  const listId = useId();
  const still = prefersReducedMotion();

  const done = tasks.filter((t) => (t.state ?? "pending") === "done").length;
  const finished = tasks.length > 0 && done === tasks.length;

  const disclosure = useDisclosure({
    open,
    defaultOpen,
    onOpenChange,
    preferOpen: !finished,
  });
  // Without a row to fold into there is nothing to fold with.
  const isOpen = collapsible ? disclosure.isOpen : true;

  const progress = label.progress
    .replace("{done}", String(done))
    .replace("{total}", String(tasks.length));

  const header = title ? (
    <>
      <span className={styles.title}>{title}</span>
      <span className={styles.progress}>{progress}</span>
      {collapsible && <ChevronDown className={styles.chevron} size={14} aria-hidden />}
    </>
  ) : null;

  return (
    <section
      className={[styles.tasks, className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      {header &&
        (collapsible ? (
          <button
            type="button"
            className={styles.header}
            onClick={disclosure.toggle}
            /* Inside an answer this sits on the highlighter's surface, where a
               pointerdown starts drawing a marker. The click is for the row. */
            onPointerDown={(event) => event.stopPropagation()}
            aria-expanded={isOpen}
            aria-controls={listId}
          >
            {header}
          </button>
        ) : (
          <div className={`${styles.header} ${styles.static}`}>{header}</div>
        ))}

      {/* Always rendered, so `aria-controls` always points at something. */}
      <div id={listId} className={styles.listOuter}>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              key="list"
              className={styles.listWrap}
              initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={still ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: still ? 0.12 : 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              <ol className={styles.list}>
                <AnimatePresence initial={false}>
                  {tasks.map((task) => {
                    const state = task.state ?? "pending";
                    return (
                      <motion.li
                        key={task.id}
                        className={styles.item}
                        data-state={state}
                        /* The one being worked on, said in a way a screen
                           reader can jump to. `step` rather than `true`: this
                           is a sequence, and which step it is on is the
                           question somebody is asking. */
                        aria-current={state === "running" ? "step" : undefined}
                        initial={still ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={still ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        transition={{ duration: still ? 0.12 : 0.2 }}
                      >
                        <StateGlyph state={state} />
                        <span className={styles.body}>
                          <span className={styles.label}>{task.label}</span>
                          {/* The glyph is a picture. This is the same thing in
                              words, for anybody it is not reaching. */}
                          <span className={styles.srOnly}>{label[state]}</span>
                          {task.detail && <span className={styles.detail}>{task.detail}</span>}
                        </span>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
