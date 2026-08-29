"use client";

import {
  isValidElement,
  useCallback,
  useId,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, TriangleAlert } from "lucide-react";
import { CodeBlock } from "../CodeBlock/CodeBlock";
import { Loader } from "../Loader/Loader";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./Tool.module.css";

/** Queued, working, finished, or failed. */
export type ToolState = "pending" | "running" | "done" | "error";

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

/** `840ms` under a second, `1.2s` over it. Nobody reads `1173ms`. */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
}

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

  /* Three sources, in order of who gets the last word: the host if it is
     controlling the row, then whoever clicked it, then the row's own idea —
     which follows the state, so a call that fails later opens itself.

     Deliberately not an effect that forces it open on failure: somebody who
     closed this row closed it, and reopening under their hands to show them
     something they have already dismissed is not help. */
  const [toggled, setToggled] = useState<boolean | null>(null);
  const isOpen = open ?? toggled ?? defaultOpen ?? state === "error";

  const toggle = useCallback(() => {
    const next = !isOpen;
    if (open === undefined) setToggled(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange, open]);

  const failed = state === "error";
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
        <span className={styles.glyph} aria-hidden>
          {state === "running" ? (
            <span className={styles.spinner} />
          ) : state === "done" ? (
            <Check size={13} />
          ) : failed ? (
            <TriangleAlert size={13} />
          ) : (
            <span className={styles.queued} />
          )}
        </span>

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
  );
}
