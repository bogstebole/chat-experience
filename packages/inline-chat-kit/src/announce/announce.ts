/**
 * A shared live region, for telling a screen reader what just happened.
 *
 * Three things about live regions decide the shape of this file:
 *
 * 1. The region has to be in the document *before* the text goes into it.
 *    Adding a region and its content in the same commit is, to most screen
 *    readers, an ordinary DOM insertion — nothing is spoken. So the node is
 *    created first and written to on a later tick.
 * 2. Writing the same string twice is not a change, and is not announced.
 *    Clearing first makes a repeated answer speak again.
 * 3. One region per politeness, shared by every component on the page. Several
 *    regions competing is how announcements get dropped or interleaved.
 *
 * This is deliberately not a React component: it must not be something a
 * consumer can forget to render.
 */

export type Politeness = "polite" | "assertive";

/** Long enough for the region to be registered before it is written to. */
const WRITE_DELAY = 100;

const regions = new Map<Politeness, HTMLElement>();
const pending = new Map<Politeness, ReturnType<typeof setTimeout>>();

const visuallyHidden = {
  position: "absolute",
  width: "1px",
  height: "1px",
  margin: "-1px",
  padding: "0",
  border: "0",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  whiteSpace: "nowrap",
} as const;

function getRegion(politeness: Politeness): HTMLElement | null {
  // Server render, or a test environment without a DOM.
  if (typeof document === "undefined") return null;

  const existing = regions.get(politeness);
  if (existing?.isConnected) return existing;

  const node = document.createElement("div");
  node.setAttribute("role", politeness === "assertive" ? "alert" : "status");
  node.setAttribute("aria-live", politeness);
  // Answers are read as a whole. Without this a screen reader may read only
  // the part that changed, which for a replaced answer is meaningless.
  node.setAttribute("aria-atomic", "true");
  node.dataset.inlineChatKit = "live-region";
  Object.assign(node.style, visuallyHidden);
  document.body.appendChild(node);
  regions.set(politeness, node);
  return node;
}

/**
 * Speak a message. Empty strings are ignored — clearing is not an announcement.
 */
export function announce(message: string, politeness: Politeness = "polite"): void {
  // Checked before the region is created, so nothing to say leaves no trace.
  if (!message) return;
  const node = getRegion(politeness);
  if (!node) return;

  const queued = pending.get(politeness);
  if (queued) clearTimeout(queued);

  node.textContent = "";
  pending.set(
    politeness,
    setTimeout(() => {
      pending.delete(politeness);
      node.textContent = message;
    }, WRITE_DELAY)
  );
}

/**
 * Drop the regions and anything queued. For tests, so one case cannot hear
 * what a previous one said.
 */
export function resetAnnouncer(): void {
  pending.forEach((timer) => clearTimeout(timer));
  pending.clear();
  regions.forEach((node) => node.remove());
  regions.clear();
}
