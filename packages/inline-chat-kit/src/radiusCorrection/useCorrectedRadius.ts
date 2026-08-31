"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * A box's corner in pixels, so Motion can keep it round while it scales it.
 *
 * A `layout` animation does not resize a box — it **scales** one, and a browser
 * scaling a box scales the corner with it. Measured on the question group
 * opening a card: `scaleY` runs from 0.932 to 1 while `border-radius` stays a
 * flat 40px, which paints a 40 × 37 ellipse and eases back to a circle. That is
 * the stretching and squashing everyone can see and nobody can name.
 *
 * Motion has a corrector for exactly this — it rewrites the radius as
 * `x% y%` against the projected box every frame — but it only runs on values
 * **Motion is managing**. A radius that lives in a CSS class is invisible to
 * it, so the whole morph goes uncorrected.
 *
 * So the number is read off the element and handed back through `style`, where
 * Motion can see it. Read rather than hard-coded, because the corner is a
 * token and a host may retune it; `var(--…)` is no use here, since the
 * corrector parses pixels and returns anything else untouched.
 *
 * `undefined` until the element exists, which is one render with the class's
 * own corner and no animation running yet — nothing to see.
 */
export function useCorrectedRadius(ref: RefObject<HTMLElement | null>): number | undefined {
  const [radius, setRadius] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    /* Before paint, so the first frame is already the corrected value rather
       than the class's and then a swap. */
    const px = Number.parseFloat(getComputedStyle(element).borderTopLeftRadius);
    setRadius((current) => (Number.isFinite(px) && px !== current ? px : current));
  }, [ref]);

  return radius;
}
