"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { prefersReducedMotion } from "../reducedMotion/reducedMotion";
import styles from "./Chip.module.css";

export interface ChipProps {
  children: ReactNode;
  className?: string;
}

/** A small, self-contained value — an answer given, a count, a tag. */
export function Chip({ children, className }: ChipProps) {
  const still = prefersReducedMotion();
  return (
    <motion.span
      className={[styles.chip, className ?? ""].filter(Boolean).join(" ")}
      initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
      animate={still ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={still ? { duration: 0.15 } : { type: "spring", stiffness: 500, damping: 30 }}
    >
      {children}
    </motion.span>
  );
}
