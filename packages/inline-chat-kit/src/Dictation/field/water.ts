/**
 * Water: a dish seen from above, made to stand still in shapes by the voice.
 * One fragment shader per look — `plane.glsl`, `ripple.glsl` — and no library.
 *
 * The surface is a standing wave — a radial term that falls off like a Bessel
 * function's tail, times an angular one with `n`-fold symmetry. That is the
 * shape of a vibrating circular plate's modes, which is what the photographs
 * are of. The voice's tone picks a mode; the shader morphs from the last one
 * to it.
 * The level of the voice is how hard the dish is shaken: silence is still
 * water, and still water is what the dish shows while the browser is asking.
 *
 * Colours are read from the kit's own channels (`--ick-ink-rgb`,
 * `--ick-paper-rgb`, `--ick-marker-rgb`) so a theme reaches the water too.
 */

export interface Mode {
  /** Fold of symmetry: 0 is rings, 6 is a six-petalled flower. */
  n: number;
  /** Rings across the radius. */
  k: number;
  /** Turn of the pattern, so two words with the same symmetry differ. */
  phase: number;
  /**
   * Where the figure sits from simplest (0) to most intricate (1), when it
   * was chosen by the voice's tone rather than by a word.
   */
  order?: number;
  /** Which of the figures near that place: a voice that returns to a pitch sees a new one. */
  variant?: number;
}

/**
 * The figure for a place on the scale of complexity: a low voice shakes the
 * water into few, broad petals, a high one into many fine ones — the way a
 * plate's figures grow more intricate as the frequency rises.
 */
export function modeForOrder(order: number, variant = 0): Mode {
  const o = Math.min(1, Math.max(0, order));
  const step = Math.round(o * 5);
  // Variants keep the fold and change what the water does with it: how
  // finely it rings, and the phase between its two wave families.
  const v = variant % 4;
  return { n: 3 + step, k: 11 + step * 3.2 + [0, 4.5, -2.5, 7][v], phase: [0.8, 2.6, 4.3, 5.7][v], order: o, variant };
}

export interface Frame {
  time: number;
  /** 0..1, smoothed. How hard the water is driven. */
  level: number;
  /** 0 still water, 1 vibrating. Never 1 while the browser is asking. */
  live: number;
  /** 0..1: how far the dish has opened out of the microphone. */
  open: number;
}

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const channel = (el: Element, name: string, fallback: [number, number, number]): [number, number, number] => {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const parts = raw.split(/[\s,]+/).map(Number);
  return parts.length >= 3 && parts.every((v) => Number.isFinite(v)) ? [parts[0] / 255, parts[1] / 255, parts[2] / 255] : fallback;
};

export class Water {
  private gl: WebGLRenderingContext;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private from: Mode = { n: 0, k: 12, phase: 0 };
  private to: Mode = { n: 0, k: 12, phase: 0 };
  private morphStart = -1;
  /**
   * Slow on purpose. A shape that changed with every word pulsed at the rate
   * of speech; one that holds, then pours into the next over a second and a
   * half, reads as the same water finding a new figure.
   */
  private morphMs = 1600;
  /** The shortest time a figure holds before the next word may replace it. */
  private holdMs = 2600;
  private pending: Mode | null = null;
  private changedAt = -Infinity;
  private colours: { at: number; paper: [number, number, number]; ink: [number, number, number]; marker: [number, number, number] } | null = null;
  readonly canvas: HTMLCanvasElement;
  /** Where the dish is, and where it opens from, in CSS pixels. */
  center = { x: 0, y: 0 };
  mic = { x: 0, y: 0 };
  radius = 160;

  static supported(): boolean {
    try {
      return !!document.createElement("canvas").getContext("webgl");
    } catch {
      return false;
    }
  }

  /** `frag` is the look: a fragment shader that reads the uniforms `draw` sets. */
  constructor(canvas: HTMLCanvasElement, frag: string) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) throw new Error("WebGL is not available");
    this.gl = gl;
    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
      return shader;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const pos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    for (const name of ["uRes", "uCenter", "uMic", "uRadius", "uTime", "uLevel", "uLive", "uOpen", "uMix", "uA", "uB", "uPaper", "uInk", "uMarker", "uDark"]) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
  }

  /**
   * The next word's shape. It waits its turn: a figure holds before the next
   * replaces it, and only the latest word waiting is kept.
   */
  setMode(next: Mode, now = performance.now()) {
    this.pending = next;
    this.advance(now);
  }

  private advance(now: number) {
    if (!this.pending || now - this.changedAt < this.holdMs || this.mix(now) < 1) return;
    this.from = this.to;
    this.to = this.pending;
    this.pending = null;
    this.morphStart = now;
    this.changedAt = now;
  }

  /** Jump without morphing — for a still frame. */
  setModeNow(mode: Mode) {
    this.from = mode;
    this.to = mode;
    this.pending = null;
    this.morphStart = -1;
  }

  private mix(now: number) {
    if (this.morphStart < 0) return 1;
    const t = Math.min(1, (now - this.morphStart) / this.morphMs);
    return t * t * (3 - 2 * t);
  }

  draw(frame: Frame, now = performance.now()) {
    this.advance(now);
    const { gl, canvas, uniforms: u } = this;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Read twice a second rather than every frame: a style recalculation per
    // frame for a value that changes when somebody flips the theme.
    if (!this.colours || now - this.colours.at > 500) {
      this.colours = {
        at: now,
        paper: channel(canvas, "--ick-paper-rgb", [1, 1, 1]),
        ink: channel(canvas, "--ick-ink-rgb", [0.07, 0.07, 0.07]),
        marker: channel(canvas, "--ick-marker-rgb", [0.8, 1, 0]),
      };
    }
    const { paper, ink, marker } = this.colours;
    // Dark when the paper is the darker of the two.
    const dark = paper[0] + paper[1] + paper[2] < ink[0] + ink[1] + ink[2] ? 1 : 0;
    gl.uniform2f(u.uRes, w, h);
    // GL's y runs up.
    gl.uniform2f(u.uCenter, this.center.x * dpr, h - this.center.y * dpr);
    gl.uniform2f(u.uMic, this.mic.x * dpr, h - this.mic.y * dpr);
    gl.uniform1f(u.uRadius, this.radius * dpr);
    // The water's own motion at a little over half speed: calmer, still alive.
    gl.uniform1f(u.uTime, frame.time * 0.55);
    gl.uniform1f(u.uLevel, frame.level);
    gl.uniform1f(u.uLive, frame.live);
    gl.uniform1f(u.uOpen, frame.open);
    gl.uniform1f(u.uMix, this.mix(now));
    gl.uniform3f(u.uA, this.from.n, this.from.k, this.from.phase);
    gl.uniform3f(u.uB, this.to.n, this.to.k, this.to.phase);
    gl.uniform3f(u.uPaper, ...paper);
    gl.uniform3f(u.uInk, ...ink);
    gl.uniform3f(u.uMarker, ...marker);
    gl.uniform1f(u.uDark, dark);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
