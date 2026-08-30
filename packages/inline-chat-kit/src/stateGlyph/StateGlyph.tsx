"use client";

import { Check, TriangleAlert } from "lucide-react";
import styles from "./StateGlyph.module.css";

/**
 * Queued, working, finished, failed.
 *
 * One vocabulary across the kit rather than one per component — a tool call
 * and a task in a list are in the same four states, and calling the third one
 * `active` in one place and `running` in another buys nothing and costs a
 * mental translation every time somebody reads both.
 */
export type WorkState = "pending" | "running" | "done" | "error";

/**
 * The 16px square that says which of the four states something is in.
 *
 * Four shapes, not four colours. Colour is the second thing it says, and a
 * status carried only by colour is a status half the people reading it do not
 * have — so a queued ring, a turning ring, a tick and a triangle are different
 * before anything is tinted.
 *
 * Not exported from the package. Two components draw it and neither wants a
 * consumer's version of it; if that changes it is one line in `index.ts`.
 */
export function StateGlyph({ state }: { state: WorkState }) {
  return (
    <span className={styles.glyph} data-state={state} aria-hidden>
      {state === "running" ? (
        <span className={styles.spinner} />
      ) : state === "done" ? (
        <Check size={13} />
      ) : state === "error" ? (
        <TriangleAlert size={13} />
      ) : (
        <span className={styles.queued} />
      )}
    </span>
  );
}
