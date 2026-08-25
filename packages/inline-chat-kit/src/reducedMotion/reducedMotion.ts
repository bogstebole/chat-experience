/**
 * Whether this reader has asked their system to reduce motion.
 *
 * Motion's own `useReducedMotion` covers rendering. This exists for the places
 * that are not rendering — the reveal in `useChatTurns` decides inside a
 * callback, where a hook's value would have to be captured in a closure and
 * kept fresh in a ref for no gain.
 *
 * The query is matched once and kept. `matchMedia` is not free, and the
 * decision is read on every answer.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

let query: MediaQueryList | null | undefined;

export function prefersReducedMotion(): boolean {
  if (query === undefined) {
    // Server render, or a test environment without matchMedia. Assume motion
    // is fine: the client will correct it on the first real render.
    query = typeof window !== "undefined" && window.matchMedia ? window.matchMedia(QUERY) : null;
  }
  return query?.matches ?? false;
}

/** For tests, which change what `matchMedia` returns between cases. */
export function resetReducedMotionCache(): void {
  query = undefined;
}
