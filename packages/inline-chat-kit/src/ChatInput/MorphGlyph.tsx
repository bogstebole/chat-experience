"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, CornerDownLeft, Square } from "lucide-react";

/**
 * Glyph slot for the send/stop/check action. Static Lucide icons swap
 * with a vertical slide + fade — outgoing slides up and out, incoming
 * slides up from below. Single slot, single transition.
 */

export interface MorphGlyphProps {
  mode: "send" | "stop" | "check";
  /** Icon colour. Inherits from whatever contains it unless set. */
  color?: string;
  /** Slide duration in seconds. */
  duration?: number;
  /** Icon pixel size. */
  size?: number;
}

const SLIDE_DISTANCE = 10;

export function MorphGlyph({
  mode,
  color = "currentColor",
  duration = 0.22,
  size = 14,
}: MorphGlyphProps) {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
      aria-hidden
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={mode}
          initial={{ y: SLIDE_DISTANCE, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -SLIDE_DISTANCE, opacity: 0 }}
          transition={{ duration, ease: [0.32, 0.72, 0, 1] }}
          style={{
            position: "absolute",
            inset: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mode === "send" ? (
            <CornerDownLeft
              size={size}
              color={color}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : mode === "check" ? (
            <Check
              size={size}
              color={color}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <Square
              size={size}
              color={color}
              fill={color}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
