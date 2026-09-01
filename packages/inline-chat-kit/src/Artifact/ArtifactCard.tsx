"use client";

import { type HTMLAttributes, type ReactNode } from "react";
import { CodeBlock } from "../CodeBlock/CodeBlock";
import { Loader } from "../Loader/Loader";
import styles from "./ArtifactCard.module.css";

/**
 * Code, or everything else.
 *
 * Two, because they are drawn differently and nothing else is: code goes
 * through the highlighter, prose keeps its line breaks and does not. An
 * `image` kind can be added the day something needs one — it is a third
 * preview, not a third idea.
 */
export type ArtifactKind = "code" | "text";

/** Being written, or written. A file does not fail the way a call does. */
export type ArtifactState = "writing" | "done";

export interface ArtifactCardProps
  extends Omit<
    HTMLAttributes<HTMLDivElement>,
    "title" | "content" | "onSelect"
  > {
  /** What the pane opens. The card and the pane share nothing else. */
  id: string;
  title: ReactNode;
  /** What it is, in a word or two — "Training plan", "12 lines of Python". */
  meta?: ReactNode;
  kind?: ArtifactKind;
  /** The fence's language, for `kind="code"`. */
  lang?: string;
  /** What was written. Absent while it is still being written. */
  content?: string;
  state?: ArtifactState;
  /**
   * How much of it the card shows before the cut.
   *
   * The whole point of an artifact is that it is bigger than the answer, so
   * the card is a window rather than the thing. Poured out in full it is not
   * an artifact, it is a long message.
   */
  lines?: number;
  /** Open it. Without one the card is a record rather than a control. */
  onOpen?: (id: string) => void;
  /** True while its pane is the one on screen. */
  open?: boolean;
}

const LINES = 8;

/** The first `lines` of it, and whether there was more. */
function clip(content: string, lines: number) {
  const all = content.split("\n");
  return { shown: all.slice(0, lines).join("\n"), more: all.length > lines };
}

/**
 * What the answer produced, in the transcript.
 *
 * A window onto it and a way in — not the thing itself. Press it and the pane
 * beside the conversation shows the whole of it; the card stays where it is,
 * because it is the line of the transcript that says the artifact was made.
 */
export function ArtifactCard({
  id,
  title,
  meta,
  kind = "code",
  lang,
  content,
  state = "done",
  lines = LINES,
  onOpen,
  open,
  className,
  ...rest
}: ArtifactCardProps) {
  const writing = state === "writing";
  const clipped = content ? clip(content, lines) : null;

  const body = (
    <div className={styles.preview} data-more={clipped?.more || undefined} aria-hidden>
      {clipped === null ? (
        <div className={styles.waiting}>
          <Loader />
        </div>
      ) : kind === "code" ? (
        <CodeBlock code={clipped.shown} lang={lang} label={false} copyable={false} />
      ) : (
        <p className={styles.text}>{clipped.shown}</p>
      )}
    </div>
  );

  /* A ground under the card after all, and the reason is the answer's column
     rather than this component.

     It was taken away when the prose still began at the turn's own edge: a
     ground under a single card was 32px of indent that put the card's words on
     a different line from the answer's. Now everything in an answer begins on
     one column and the boxes bleed wider than it — so the ground is what puts
     this card's words *on* that column, the same way a tool call's does. See
     `--ick-answer-column`. */
  const inside = (
    <>
      <Head title={title} meta={meta} writing={writing} />
      {body}
    </>
  );

  const shared = { className: styles.card };

  return (
    <div
      className={[styles.artifact, className ?? ""].filter(Boolean).join(" ")}
      data-state={state}
      data-open={open || undefined}
      {...(rest as HTMLAttributes<HTMLDivElement>)}
    >
      {onOpen ? (
        <button type="button" {...shared} onClick={() => onOpen(id)}>
          {inside}
        </button>
      ) : (
        <div {...shared}>{inside}</div>
      )}
    </div>
  );
}

function Head({
  title,
  meta,
  writing,
}: {
  title: ReactNode;
  meta?: ReactNode;
  writing: boolean;
}) {
  return (
    <span className={styles.head}>
      <span className={styles.title} data-writing={writing || undefined}>
        {title}
      </span>
      {meta && <span className={styles.meta}>{meta}</span>}
    </span>
  );
}
