"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./DisclosureBody.module.css";

export interface DisclosureBodyProps {
  /** What the header's `aria-controls` points at. */
  id: string;
  open: boolean;
  /** On the animated box, so a caller can pad or lay out what is revealed. */
  className?: string;
  children?: ReactNode;
}

/**
 * What a `DisclosureHeader` opens, and how it opens.
 *
 * The outer box is **always rendered**, empty and flat when shut, so the
 * header's `aria-controls` always points at something — a control that names
 * an id nothing has is a control that says nothing.
 *
 * The reveal was ten lines of identical `motion` props in five components. The
 * height animation is what makes growing read as a reveal rather than as
 * content arriving before its container has caught up, and `overflow: hidden`
 * on the moving box is what keeps it from spilling on the way.
 */
export function DisclosureBody({ id, open, className, children }: DisclosureBodyProps) {
  const still = prefersReducedMotion();

  return (
    <div id={id} className={styles.outer}>
      <AnimatePresence initial={false}>
        {open && children ? (
          <motion.div
            key="body"
            className={styles.wrap}
            initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={still ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: still ? 0.12 : 0.22, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className={className}>{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
