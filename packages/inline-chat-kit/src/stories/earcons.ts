/**
 * The two moments that matter, as sound: a tick when the press lands, and a
 * rising pair when the microphone is actually open. Synthesised, so there is
 * no file to ship, and paired with a short buzz on phones that have one.
 */
let audio: AudioContext | null = null;

/**
 * Make the audio context ahead of time, while nothing is happening.
 *
 * Creating one costs 100–160 ms of main thread, measured in Chromium — made
 * on the press, it froze the first frames of the very animation the press
 * starts. Made early it comes up suspended, which is the browser's rule for
 * sound before a gesture, and resuming it on the press is cheap.
 */
export function warmEarcons() {
  if (audio || typeof window === "undefined") return;
  const make = () => {
    try {
      audio ??= new AudioContext();
    } catch {
      // No sound, then; nothing else depends on it.
    }
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(make, { timeout: 2000 });
  else setTimeout(make, 300);
}

export function tone(kind: "tick" | "start" | "stop" | "cancel") {
  try {
    audio ??= new AudioContext();
  } catch {
    return;
  }
  if (audio.state === "suspended") void audio.resume();
  const notes = kind === "tick" ? [1320] : kind === "start" ? [660, 990] : kind === "stop" ? [990, 740] : [260, 196];
  const level = kind === "tick" ? 0.03 : 0.07;
  notes.forEach((frequency, i) => {
    const ctx = audio!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const at = ctx.currentTime + i * 0.075;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + (kind === "tick" ? 0.04 : 0.14));
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.16);
  });
  navigator.vibrate?.(kind === "cancel" ? [8, 40, 8] : kind === "tick" ? 4 : 12);
}
