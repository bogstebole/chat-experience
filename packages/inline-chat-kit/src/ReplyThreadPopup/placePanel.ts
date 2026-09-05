/**
 * Where the reply panel goes, as arithmetic.
 *
 * A function rather than ten lines inside the render, and the reason is that
 * it could not otherwise be tested. The panel's geometry reaches the DOM
 * through Motion's `animate` prop, and Motion animations never complete under
 * jsdom — so a test that reads `panel.style.left` reads the `initial` value
 * for ever, which is the anchor. The first guard written for this passed
 * against the broken version because of it.
 */

export interface Anchor {
  left: number;
  top: number;
  width: number;
}

export interface Placement {
  x: number;
  y: number;
  width: number;
}

/** Its clearance from every edge of the screen. */
const PADDING = 24;
/** Narrower than this and a thread is a column of two-word lines. */
const IDEAL = 480;
/** Room either side of the passage it hangs off, when that is the wider one. */
const AROUND = 80;

/**
 * **Fit first, then place.** That order is the whole of it.
 *
 * The version before this widened to 480 whatever the screen was, then ran two
 * clamps in a row: push the left edge in to the padding, then push the right
 * edge in to `screenWidth - padding`. For a box that does not fit, the second
 * always undoes the first — on a 390px phone it finished at `390 - 24 - 480`,
 * so the panel sat at **x = −114** with its heading off the side of the world.
 * Clamping a box into a space smaller than itself has no answer; the box has
 * to be made smaller first.
 */
export function placePanel(anchor: Anchor, screenWidth: number, screenHeight = Infinity): Placement {
  const room = Math.max(screenWidth - PADDING * 2, 0);
  const width = Math.min(Math.max(anchor.width + AROUND, IDEAL), room);

  // Centred on the passage, then pulled inside whichever edge it crossed.
  const centred = anchor.left + anchor.width / 2 - width / 2;
  const x = Math.min(Math.max(centred, PADDING), screenWidth - PADDING - width);

  // Above the passage, but never off the top: a phrase marked in an answer's
  // first line would otherwise open its thread where nobody can read it.
  const y = Math.max(anchor.top - PADDING, Math.min(PADDING, screenHeight));

  return { x, y, width };
}
