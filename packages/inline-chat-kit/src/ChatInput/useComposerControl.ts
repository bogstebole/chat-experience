"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/** What the composer's controls were before they were a token, and still are by default. */
export const COMPOSER_CONTROL = 28;

/**
 * `--ick-composer-control` in pixels, for the parts of the composer Motion
 * animates.
 *
 * The row of controls opens and closes by animating each one's width from
 * nothing to its size, and a spring can only run between two numbers — not to
 * `var(--…)`, and not to `2rem`. So the token is laid out once, on a probe as
 * wide as it says, and read back. Everything that is not animated uses the
 * token itself.
 *
 * Read again when the pointer changes, because the touch block of the tokens
 * sets its own value. A host that changes the token at runtime remounts the
 * composer, or does not need the row to follow until the next one.
 */
export function useComposerControl(ref: RefObject<HTMLElement | null>): number {
  const [size, setSize] = useState(COMPOSER_CONTROL);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const read = () => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:absolute;visibility:hidden;pointer-events:none;height:0;width:var(--ick-composer-control)";
      element.appendChild(probe);
      const px = probe.getBoundingClientRect().width;
      probe.remove();
      /* Nothing laid out — a test's DOM, or a composer not on screen yet:
         keep what it was. */
      if (px > 0) setSize((current) => (current === px ? current : px));
    };
    read();
    const coarse = window.matchMedia?.("(pointer: coarse)");
    coarse?.addEventListener?.("change", read);
    return () => coarse?.removeEventListener?.("change", read);
  }, [ref]);

  return size;
}
