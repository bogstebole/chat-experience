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
    HTMLAttributes<HTMLElement>,
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

  /* The card *is* the root — there is no ground under it.
  
     Every other ground in the kit carries something besides its card: a tool
     call's carries the header, a question group's carries the title, an
     approval's carries the asking and the answering. This one carried a single
     card and nothing else, which is not a ground, it is an indent. And the
     indent showed: the answer's own prose ran along the turn's left edge while
     the card's words sat 32px inside it, so the two halves of one answer read
     as two columns. */
  const inside = (
    <>
      <Head title={title} meta={meta} writing={writing} />
      {body}
    </>
  );

  const shared = {
    className: [styles.card, className ?? ""].filter(Boolean).join(" "),
    "data-state": state,
    "data-open": open || undefined,
  };

  return onOpen ? (
    <button
      type="button"
      {...(shared as HTMLAttributes<HTMLButtonElement>)}
      onClick={() => onOpen(id)}
      {...(rest as HTMLAttributes<HTMLButtonElement>)}
    >
      {inside}
    </button>
  ) : (
    <div {...(shared as HTMLAttributes<HTMLDivElement>)} {...(rest as HTMLAttributes<HTMLDivElement>)}>
      {inside}
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
