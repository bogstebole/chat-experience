"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
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
 * How the pane arrives, in two parts that are deliberately not the same.
 *
 * The room opens flat and the pane arrives with a little life in it. That
 * split is the whole design: `width` is what the conversation is laid out
 * against, so any overshoot there re-wraps every line of the answer twice on
 * the way past — a bounce nobody asked for, paid for in text. Transform and
 * opacity cost the layout nothing, so that is where the spring goes.
 *
 * Leaving is quicker than arriving, and in the other order: the pane goes
 * first and the room closes behind it. A thing that leaves as slowly as it
 * came reads as reluctant.
 */
const room: Variants = {
  closed: {
    width: 0,
    transition: { type: "spring", visualDuration: 0.26, bounce: 0, delay: 0.05 },
  },
  open: {
    width: "auto",
    transition: { type: "spring", visualDuration: 0.42, bounce: 0 },
  },
};

const arriving: Variants = {
  /* Held inside the slot's right margin, so what slides is the pane and not
     the clip: it comes from the edge it lives on. */
  closed: { opacity: 0, x: 24, transition: { duration: 0.16, ease: "easeIn" } },
  open: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", visualDuration: 0.36, bounce: 0.2, delay: 0.06 },
  },
};

/** The same choreography with the time taken out. */
const AT_ONCE = { transition: { duration: 0 } };
const still = (variants: Variants): Variants => ({
  closed: { ...(variants.closed as object), ...AT_ONCE },
  open: { ...(variants.open as object), ...AT_ONCE },
});

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

  /* Read here rather than through `<MotionConfig reducedMotion="user">`, which
     is what the rest of the kit uses and would not be enough on its own: it
     drops transforms and layout animations, and the slot's `width` is neither.
     A pane that still took four hundred milliseconds to unfold would be the
     one animation on the page ignoring the request. */
  const reduce = useReducedMotion();
  const [slot, card] = useMemo(
    () => (reduce ? [still(room), still(arriving)] : [room, arriving]),
    [reduce]
  );

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
      {/* `initial={false}`: a layout that mounts with a pane already open did
          not just open one. Anything opened afterwards animates. */}
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div
            key="pane"
            className={styles.slot}
            variants={slot}
            initial="closed"
            animate="open"
            exit="closed"
          >
            {/* Variants rather than props on each element: named states are
                what Motion propagates down a tree, so the pane leaving is one
                decision here instead of two that have to agree. */}
            <motion.div
              className={styles.card}
              data-expanded={(expanded && !narrow) || undefined}
              variants={card}
            >
              {shown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
