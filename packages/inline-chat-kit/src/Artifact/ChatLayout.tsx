"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./ChatLayout.module.css";

/** Below this the pane covers the conversation. Kept with the stylesheet. */
const NARROW = 760;

export interface PaneState {
  /** The pane is covering the conversation rather than standing beside it. */
  narrow: boolean;
  /** It has been widened. Meaningless while `narrow`, which is already full. */
  expanded: boolean;
  toggleExpanded: () => void;
}

export interface ChatLayoutProps extends HTMLAttributes<HTMLDivElement> {
  /** The conversation, and whatever else belongs above and below it. */
  children: ReactNode;
  /**
   * The pane, when one is open.
   *
   * Given `narrow`, so it can hold focus and answer Escape once it is covering
   * the conversation rather than standing beside it — the one thing about a
   * pane that is not a matter of taste. And given `expanded` with the control
   * for it, because the *width* belongs to the layout while the button that
   * changes it belongs in the pane's own header, where somebody can find it.
   */
  pane?: (state: PaneState) => ReactNode;
}

/**
 * Where the pane goes, decided once.
 *
 * The kit takes this decision rather than handing over a slot. A preview pane
 * is one of the few patterns every AI chat now has, and the value of a pattern
 * is that it is the same every time: ask for a plan, get a card, press it, the
 * plan opens on the right. A kit that let each host place it would be shipping
 * four chats that behave differently and calling it flexibility.
 *
 * What is left open is the part that actually differs — what is *in* the pane.
 * See `ArtifactPane`.
 */
export function ChatLayout({ children, pane, className, ...rest }: ChatLayoutProps) {
  const root = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((wide) => !wide), []);

  /* Measured off this element rather than the window, to agree with the
     container query in the stylesheet. A kit embedded in a narrow column
     inside a wide page is the case a media query gets wrong. */
  useEffect(() => {
    const element = root.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width <= NARROW);
    });
    watch.observe(element);
    return () => watch.disconnect();
  }, []);

  const shown = pane?.({ narrow, expanded, toggleExpanded });

  return (
    <div
      ref={root}
      className={[styles.layout, className ?? ""].filter(Boolean).join(" ")}
      data-pane={shown ? "" : undefined}
      {...rest}
    >
      <div className={styles.chat}>{children}</div>
      {shown && (
        <div className={styles.pane} data-expanded={(expanded && !narrow) || undefined}>
          {shown}
        </div>
      )}
    </div>
  );
}
