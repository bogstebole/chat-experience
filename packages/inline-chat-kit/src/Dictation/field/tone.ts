/**
 * The tone of a voice, slowly: where the speaker's pitch sits relative to
 * their own range, followed over seconds rather than syllables.
 *
 * This is what picks the figure. A real Chladni plate makes simpler figures
 * at low frequencies and more intricate ones as the frequency rises; here the
 * speaker's own voice plays the frequency. Relative, so a deep voice and a
 * high one both reach the whole range, and slow, so the figure drifts with
 * the intonation of a sentence instead of jumping with every word.
 */

/**
 * The fundamental of one window of audio, in Hz, or null when it is not
 * voiced. YIN: the difference function from the first lag, its
 * cumulative-mean normalisation, the first dip under a threshold — or, for a
 * breathy or noisy voice that never dips that far, the deepest dip if it is
 * deep enough — and a parabola through it.
 *
 * The first version normalised from the shortest lag considered rather than
 * from the first, and wanted a dip under 0.18: a clean synthetic tone passed
 * and a real voice through a laptop microphone mostly did not, so the figure
 * never changed. The window is halved first (two samples averaged), which
 * keeps every voice and quarters the cost.
 */
export function detectPitch(input: Float32Array, sampleRate: number, lowHz = 70, highHz = 500): number | null {
  const size = input.length >> 1;
  const rate = sampleRate / 2;
  const buf = new Float32Array(size);
  let energy = 0;
  for (let i = 0; i < size; i++) {
    const v = (input[2 * i] + input[2 * i + 1]) * 0.5;
    buf[i] = v;
    energy += v * v;
  }
  // Below this it is the room, not a voice.
  if (Math.sqrt(energy / size) < 0.004) return null;
  const minLag = Math.max(2, Math.floor(rate / highHz));
  const maxLag = Math.min(Math.floor(rate / lowHz), Math.floor(size / 2));
  const span = size - maxLag;
  const d = new Float32Array(maxLag + 1);
  let running = 0;
  d[0] = 1;
  for (let lag = 1; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < span; i++) {
      const delta = buf[i] - buf[i + lag];
      sum += delta * delta;
    }
    running += sum;
    d[lag] = running > 0 ? (sum * lag) / running : 1;
  }
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (d[lag] < 0.2) {
      while (lag + 1 <= maxLag && d[lag + 1] < d[lag]) lag++;
      best = lag;
      break;
    }
  }
  if (best < 0) {
    let low = minLag;
    for (let lag = minLag; lag <= maxLag; lag++) if (d[lag] < d[low]) low = lag;
    if (d[low] < 0.45) best = low;
  }
  if (best < 0) return null;
  const a = d[best - 1];
  const b = d[best];
  const c = best + 1 <= maxLag ? d[best + 1] : d[best];
  const bend = a - 2 * b + c;
  const shift = bend !== 0 ? Math.max(-1, Math.min(1, (a - c) / (2 * bend))) : 0;
  return rate / (best + shift);
}

/** Six figures, simplest to most intricate. */
export const BANDS = 6;

/**
 * Follows the pitch and turns it into a figure's place on the scale of
 * complexity — `band` — with enough hysteresis that a sentence's natural
 * wobble does not flip it.
 */
export class ToneTracker {
  /** Smoothed pitch, in semitones above 55 Hz. */
  private semis = -1;
  /** The speaker's own centre, learned as they talk. */
  private centre = -1;
  private bandNow = Math.floor(BANDS / 2);
  /** 0..1: low for this speaker to high for this speaker. */
  tone = 0.5;
  /** Seconds to follow the voice's pitch. */
  follow = 0.6;
  /** Seconds to learn where the speaker's middle is. */
  learn = 8;
  /** Semitones either side of the middle that span the six figures. */
  range = 3.5;
  /** How far past a band's edge the tone must go before the figure changes (0..0.2). */
  margin = 0.045;

  get band() {
    return this.bandNow;
  }

  private recent: number[] = [];
  private readings = 0;
  /** The last pitch heard, in Hz, for showing; null in a gap. */
  heard: number | null = null;

  /** One reading: a pitch in Hz, or null for a gap. `dt` in seconds. */
  push(hz: number | null, dt: number) {
    this.heard = hz;
    if (hz == null || dt <= 0) return;
    // The median of the last five: one reading an octave off (the commonest
    // mistake a pitch tracker makes) cannot move the figure.
    this.recent.push(12 * Math.log2(hz / 55));
    if (this.recent.length > 5) this.recent.shift();
    const s = [...this.recent].sort((x, y) => x - y)[this.recent.length >> 1];
    this.readings++;
    if (this.semis < 0) {
      this.semis = s;
      this.centre = s;
    }
    // The middle is learned fast over the first second of voice, then slowly:
    // a first reading at the top of a sentence no longer sets it.
    if (this.readings < 20) this.centre += (s - this.centre) * 0.25;
    // About half a second to follow the voice, about eight to learn where its
    // middle is.
    this.semis += (s - this.semis) * (1 - Math.exp(-dt / this.follow));
    this.centre += (s - this.centre) * (1 - Math.exp(-dt / this.learn));
    // ±3.5 semitones around the speaker's middle spans the scale: well inside
    // the reach of ordinary intonation, so a question climbs it and a
    // statement settles back down. ±4.5 with a second's smoothing was
    // measured on real speech moving only between two of the six figures.
    this.setTone(0.5 + (this.semis - this.centre) / (2 * this.range));
  }

  /** Set the tone directly — for the simulated voice. */
  setTone(value: number) {
    this.tone = Math.min(1, Math.max(0, value));
    const edge = (band: number) => band / BANDS;
    // Move a band only when the tone is clearly past its edge.
    const margin = this.margin;
    while (this.bandNow < BANDS - 1 && this.tone > edge(this.bandNow + 1) + margin) this.bandNow++;
    while (this.bandNow > 0 && this.tone < edge(this.bandNow) - margin) this.bandNow--;
  }
}
