"use client";

import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "../Button/Button";
import styles from "./ArtifactPane.module.css";

export interface ArtifactPaneProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  /** What it is, under the title. */
  meta?: ReactNode;
  /**
   * What the host renders. Absent, the pane shows its own skeleton — an
   * artifact usually arrives before it is finished, and a pane that opens
   * empty reads as broken rather than as early.
   */
  children?: ReactNode;
  onClose?: () => void;
  /**
   * The one prop that changes behaviour, and it is not about position.
   *
   * Below the layout's breakpoint the pane covers the conversation instead of
   * standing beside it, and covering changes what it *is*: focus has to be
   * held inside it and Escape has to close it, because there is nothing usable
   * behind it. Beside the conversation both would be wrong — trapping focus
   * would lock a reader out of the chat they are still reading.
   *
   * `<ChatLayout>` sets it from its own width. Set it yourself only if you are
   * placing the pane without one.
   */
  modal?: boolean;
  /**
   * Widened. The pane draws the control; `ChatLayout` owns the width, because
   * how much room the pane takes is a fact about the layout.
   */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  closeLabel?: string;
  expandLabel?: string;
  collapseLabel?: string;
}

/**
 * What the answer produced, in full, beside the conversation.
 *
 * The kit decides that it is on the right and that the conversation makes room
 * for it — this is a pattern rather than a slot, and a chat where the pane
 * arrives somewhere different each time is a chat nobody learns. What the kit
 * does **not** decide is the content: a plan, a document, a table, a diagram.
 * That is the host's, and it is why this takes children.
 *
 * The part worth having in a library is not the box. It is what happens on
 * open: focus has to move here or a keyboard reader is left behind in the
 * conversation, and it must **not** be trapped unless the pane is covering
 * that conversation. Every host gets one of those two wrong.
 */
export function ArtifactPane({
  title,
  meta,
  children,
  onClose,
  modal = false,
  expanded = false,
  onToggleExpanded,
  closeLabel = "Close",
  expandLabel = "Widen",
  collapseLabel = "Narrow",
  className,
  ...rest
}: ArtifactPaneProps) {
  const titleId = useId();
  const pane = useRef<HTMLDivElement>(null);

  /* Focus moves to the pane's heading, not into it: a heading is where a
     reader wants to be put down, and focusing the first control would skip
     what the thing is. `tabIndex={-1}` makes it a target without making it a
     stop. */
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);

  /* Escape closes it only when it is covering the conversation. Beside it,
     Escape belongs to whatever the reader is actually in. */
  useEffect(() => {
    if (!modal || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal, onClose]);

  /* And focus stays inside it, for the same reason and only then. */
  useEffect(() => {
    if (!modal) return;
    const onFocus = (event: FocusEvent) => {
      const root = pane.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        heading.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, [modal]);

  return (
    /* A `div` with the role written out, not an `<aside>`.
    
       Beside the conversation this is a complementary region and `<aside>`
       would have said so for free — but the same element has to become a
       dialog when it covers the conversation, and `role="dialog"` is not
       allowed on an `<aside>`. One element that is both means neither can be
       implied. Caught by the axe pass rather than by reading, which is what
       that pass is for. */
    <div
      ref={pane}
      className={[styles.pane, className ?? ""].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      aria-modal={modal || undefined}
      role={modal ? "dialog" : "complementary"}
      {...rest}
    >
      {/* A `div`, not a `<header>`. Inside a landmark a `<header>` *is* a
          banner landmark, and a banner has to be top-level — nesting one in
          the pane's own region is a second landmark claiming to be the page's.
          It only became a problem when the pane stopped being an `<aside>`,
          which would have scoped it; the axe pass caught the consequence a
          minute after it caught the cause. */}
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title} id={titleId} ref={heading} tabIndex={-1}>
            {title}
          </h2>
          {meta && <p className={styles.meta}>{meta}</p>}
        </div>
        {/* Widening is meaningless while it is covering the conversation:
            there is nothing left to take. */}
        {onToggleExpanded && !modal && (
          <Button
            variant="ghost"
            size="s"
            icon={
              expanded ? <Minimize2 size={15} aria-hidden /> : <Maximize2 size={15} aria-hidden />
            }
            aria-label={expanded ? collapseLabel : expandLabel}
            aria-pressed={expanded}
            onClick={onToggleExpanded}
          />
        )}
        {onClose && (
          <Button
            variant="ghost"
            size="s"
            icon={<X size={15} aria-hidden />}
            aria-label={closeLabel}
            onClick={onClose}
          />
        )}
      </div>

      <div className={styles.body}>
        {children ?? <Skeleton />}
      </div>
    </div>
  );
}

/**
 * What a pane looks like before its content exists.
 *
 * Not a spinner. An artifact is written a line at a time and the shape of what
 * is coming is already known — a title, some paragraphs — so the skeleton says
 * that, and the content replaces it in place rather than after a blank.
 */
function Skeleton() {
  return (
    <div className={styles.skeleton} aria-hidden>
      {[68, 100, 92, 100, 46, 100, 84].map((width, i) => (
        <span key={i} className={styles.line} style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}
