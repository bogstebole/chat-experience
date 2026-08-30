"use client";

import { isValidElement, useId, type HTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { CodeBlock } from "../CodeBlock/CodeBlock";
import { StateGlyph, type WorkState } from "../stateGlyph/StateGlyph";
import { useDisclosure } from "../disclosure/useDisclosure";
import { formatDuration } from "../duration/formatDuration";
import { Loader } from "../Loader/Loader";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./Tool.module.css";

/** Queued, working, finished, or failed — the kit's four, shared with `TaskList`. */
export type ToolState = WorkState;

type Labels = Record<"input" | "output" | "error" | ToolState, string>;

export interface ToolProps extends Omit<HTMLAttributes<HTMLDivElement>, "title" | "onToggle"> {
  /** What was called. Set in mono: it is an identifier, not prose. */
  name: string;
  state?: ToolState;
  /** A sentence for what it did — "Searched the web", "Read 3 files". */
  summary?: ReactNode;
  /**
   * What it was called with.
   *
   * A string is shown as text and an object as JSON. Anything you want drawn
   * some other way, pass as an element and it is rendered untouched.
   */
  input?: unknown;
  /** What came back. Read the same way as `input`. */
  output?: unknown;
  /** What went wrong. Drawn instead of the output, and opens the row. */
  error?: ReactNode;
  /** How long it took, in ms. Shown once it has finished. */
  duration?: number;
  /** Open, controlled. Leave out and the row keeps its own. */
  open?: boolean;
  /** Where it starts. Defaults to open only if it failed. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  labels?: Partial<Labels>;
}

const LABELS: Labels = {
  input: "Input",
  output: "Output",
  error: "Error",
  pending: "Queued",
  running: "Running",
  done: "Done",
};

/**
 * A value, and how it wants to be drawn.
 *
 * A string is what came back rather than a program, so it is text. An object
 * is JSON, which is what it already was on the wire. An element is somebody
 * having decided for themselves, so it is left alone.
 */
type Shown =
  | { kind: "node"; node: ReactNode }
  | { kind: "text"; text: string }
  | { kind: "json"; code: string }
  | null;

function show(value: unknown): Shown {
  if (value === null || value === undefined) return null;
  if (isValidElement(value)) return { kind: "node", node: value };
  if (typeof value === "string") return value.trim() ? { kind: "text", text: value } : null;
  if (typeof value === "number" || typeof value === "boolean") {
    return { kind: "text", text: String(value) };
  }
  try {
    const code = JSON.stringify(value, null, 2);
    return code ? { kind: "json", code } : null;
  } catch {
    // Circular, or a BigInt. A row that throws while rendering a tool call is
    // worse than one that prints something unhelpful.
    return { kind: "text", text: String(value) };
  }
}

function Section({
  label,
  value,
  tone,
}: {
  label: string;
  value: Shown;
  /** `error` puts the section on its own ground. */
  tone?: "error";
}) {
  if (!value) return null;

  /* A fenced value carries its heading in its own bar. Stacking a title above
     a bar that held nothing but a copy button was two rows doing one row's
     work, and the empty strip between them was the first thing you saw. */
  if (value.kind === "json") {
    return <CodeBlock code={value.code} lang="json" label={label} />;
  }

  const body =
    value.kind === "text" ? <p className={styles.text}>{value.text}</p> : value.node;

  return (
    <div className={styles.section}>
      <span className={styles.sectionLabel}>{label}</span>
      {tone === "error" ? <div className={styles.error}>{body}</div> : body}
    </div>
  );
}

/**
 * One tool call: what was run, what with, what came back.
 *
 * Collapsed, because most of the time nobody cares — and open when it failed,
 * because an error nobody can see has not been reported. The glyph says which
 * state it is in and the row says so in words too; a status carried only by
 * colour is a status half the people reading it do not have.
 */
export function Tool({
  name,
  state = "done",
  summary,
  input,
  output,
  error,
  duration,
  open,
  defaultOpen,
  onOpenChange,
  labels,
  className,
  ...rest
}: ToolProps) {
  const label = { ...LABELS, ...labels };
  const bodyId = useId();
  const still = prefersReducedMotion();

  const failed = state === "error";

  /* Open when it failed, because an error nobody can see has not been
     reported — but only as the row's own preference, which anybody reading it
     can overrule. See `useDisclosure`. */
  const { isOpen, toggle } = useDisclosure({
    open,
    defaultOpen,
    onOpenChange,
    preferOpen: failed,
  });
  const shownInput = show(input);
  const shownOutput = failed ? null : show(output);
  const shownError = failed ? show(error) : null;
  const hasBody = Boolean(shownInput || shownOutput || shownError || state === "running");

  const time = state === "done" || failed ? formatDuration(duration ?? NaN) : "";

  return (
    <div
      className={[styles.tool, className ?? ""].filter(Boolean).join(" ")}
      data-state={state}
      {...rest}
    >
      {/* The ground, then the card on it — the same two the question card has.
          A card needs something to be a card *on*; on the page alone it was
          only paper with a shadow. */}
      <div className={styles.card}>
      <button
        type="button"
        className={styles.header}
        onClick={toggle}
        /* Inside an answer this sits on the highlighter's surface, where a
           pointerdown starts drawing a marker. The click is for the row. */
        onPointerDown={(event) => event.stopPropagation()}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        disabled={!hasBody}
      >
        <StateGlyph state={state} />

        <span className={styles.name}>{name}</span>
        {/* The glyph is a picture. This is the same thing in words, for
            anybody the picture is not reaching. */}
        <span className={styles.srOnly}>{label[state]}</span>

        {summary && <span className={styles.summary}>{summary}</span>}
        {time && <span className={styles.time}>{time}</span>}

        {hasBody && <ChevronDown className={styles.chevron} size={14} aria-hidden />}
      </button>

      {/* Always rendered, so `aria-controls` always points at something. */}
      <div id={bodyId} className={styles.bodyOuter}>
        <AnimatePresence initial={false}>
          {isOpen && hasBody && (
            <motion.div
              key="body"
              className={styles.body}
              initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={still ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: still ? 0.12 : 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              <div className={styles.bodyInner}>
                <Section label={label.input} value={shownInput} />
                {state === "running" && !shownOutput && (
                  <div className={styles.section}>
                    <span className={styles.sectionLabel}>{label.output}</span>
                    <Loader />
                  </div>
                )}
                <Section label={label.output} value={shownOutput} />
                <Section label={label.error} value={shownError} tone="error" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
