/**
 * How long something took, in words somebody reads rather than in the number
 * the clock handed over.
 *
 * `840ms` under a second, `1.2s` over it, whole seconds past ten. Nobody reads
 * `1173ms`, and the tenth stops mattering once there are two digits in front
 * of it.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
}
