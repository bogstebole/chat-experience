/**
 * Cymatics: a dish of water seen from above, made to stand still in shapes by
 * the voice. One fragment shader, no library.
 *
 * The surface is a standing wave — a radial term that falls off like a Bessel
 * function's tail, times an angular one with `n`-fold symmetry. That is the
 * shape of a vibrating circular plate's modes, which is what the photographs
 * are of. Each word picks a mode; the shader morphs from the last one to it.
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
}

/**
 * The figure for a place on the scale of complexity: a low voice shakes the
 * water into few, broad petals, a high one into many fine ones — the way a
 * plate's figures grow more intricate as the frequency rises.
 */
export function modeForOrder(order: number): Mode {
  const o = Math.min(1, Math.max(0, order));
  const step = Math.round(o * 5);
  return { n: 3 + step, k: 11 + step * 3.2, phase: 0.8, order: o };
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

/** The look as it stands. Other looks live in `./water/` and take the same uniforms. */
export const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform vec2 uMic;
uniform float uRadius;
uniform float uTime;
uniform float uLevel;
uniform float uLive;
uniform float uOpen;
uniform float uMix;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uPaper;
uniform vec3 uInk;
uniform vec3 uMarker;
uniform float uDark;

const float PI = 3.14159265;

float mode(vec2 p, vec3 m) {
  float r = length(p);
  float n = m.x;
  float k = m.y;
  // Turned by the word's phase, and the same turn for both families, so the
  // figure keeps its mirrors — a mandala rather than a maze.
  float a = atan(p.y, p.x) + m.z / max(n, 1.0);
  // A Bessel function's tail, roughly: a cosine that thins out with radius.
  float radial = cos(k * r - (n * 0.5 + 0.25) * PI * 0.5) * inversesqrt(1.0 + 0.8 * k * r);
  float lobes = n < 0.5 ? 1.0 : cos(n * a);
  // A second family at twice the fold, which is what makes petals rather
  // than spokes, fading toward the rim.
  float petals = cos(k * 0.55 * r + 1.3) * cos(2.0 * n * a) * (1.0 - r * 0.8);
  return radial * lobes + 0.32 * petals;
}

float field(vec2 p) {
  return mix(mode(p, uA), mode(p, uB), uMix);
}

float height(vec2 p) {
  float r = length(p);
  // Faraday waves flicker at twice the drive; a standing wave that only
  // breathes in amplitude reads as alive without travelling anywhere.
  // A floor, so a quiet voice still holds the shape; loudness deepens it.
  float drive = uLive * (0.45 + 0.75 * uLevel);
  float flicker = 0.78 + 0.22 * sin(uTime * 19.0);
  float h = field(p) * drive * flicker;
  // Ripples from the centre, only while driven.
  h += 0.025 * drive * sin(r * 46.0 - uTime * 7.0) * (1.0 - r);
  // The drop at the centre, where the transducer is.
  h += 0.22 * exp(-r * r * 320.0);
  // The meniscus climbing the dish wall.
  h += 0.35 * smoothstep(0.8, 1.0, r);
  return h;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r = length(p);

  // The dish opens out of the microphone: a circle from it, growing.
  float reach = length(uRes) * 1.15;
  float revealed = 1.0 - smoothstep(uOpen * reach - 40.0, uOpen * reach, length(frag - uMic));
  float dish = 1.0 - smoothstep(0.985, 1.0, r);
  float mask = revealed * dish;
  if (mask <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float e = 1.25 / uRadius;
  float h = height(p);
  float hx = height(p + vec2(e, 0.0)) - h;
  float hy = height(p + vec2(0.0, e)) - h;
  vec3 nrm = normalize(vec3(-hx / e * 0.018, -hy / e * 0.018, 1.0));

  vec3 light = normalize(vec3(-0.45, 0.55, 0.7));
  vec3 half_ = normalize(light + vec3(0.0, 0.0, 1.0));
  float diffuse = clamp(dot(nrm, light), 0.0, 1.0);
  float spec = pow(clamp(dot(nrm, half_), 0.0, 1.0), 90.0);
  float sheen = pow(clamp(dot(nrm, half_), 0.0, 1.0), 12.0);
  float tilt = 1.0 - nrm.z;

  // Where the plate does not move, the sand gathers: the nodal lines.
  float f = field(p);
  float drive = uLive * (0.5 + 0.5 * uLevel);
  float nodes = exp(-abs(f) * 18.0) * drive;

  // Milk in the light theme, black water in the dark — paper and ink, as the
  // kit already defines them.
  vec3 body = mix(uPaper * 0.94 + uInk * 0.06, uPaper * 0.9 + uInk * 0.1, uDark);
  vec3 shade = mix(uInk, uPaper, 0.55);
  vec3 col = body;
  col = mix(col, shade, clamp(tilt * 6.0, 0.0, 0.55));
  col *= 0.88 + 0.18 * diffuse;
  col += vec3(spec) * mix(0.9, 1.1, uDark) + vec3(sheen) * 0.06;
  // Sand on the lines: darker than the milk in the light, and in the dark
  // the white of the photographs, sand on a black plate.
  vec3 sand = mix(uPaper, uInk, mix(0.35, 0.85, uDark));
  col = mix(col, sand, nodes * mix(0.35, 0.6, uDark));

  // The one note of the marker: the drop glows while the dish is live.
  float core = exp(-r * r * 260.0);
  col = mix(col, uMarker, core * uLive * (0.35 + 0.65 * uLevel) * 0.8);

  // Translucent toward the rim, so the dimmed page shows through the water.
  float alpha = mask * mix(0.94, 0.55, smoothstep(0.55, 1.0, r));
  gl_FragColor = vec4(col * alpha, alpha);
}
`;

const channel = (el: Element, name: string, fallback: [number, number, number]): [number, number, number] => {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const parts = raw.split(/[\s,]+/).map(Number);
  return parts.length >= 3 && parts.every((v) => Number.isFinite(v)) ? [parts[0] / 255, parts[1] / 255, parts[2] / 255] : fallback;
};

/** A word, turned into the shape it makes. Same word, same shape. */
export function modeFor(word: string, pitch = 0.5): Mode {
  let hash = 2166136261;
  for (const ch of word.toLowerCase()) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  // Rings are what still water is shaken into before it has a word; a word
  // always has a fold.
  const folds = [3, 4, 5, 6, 6, 7, 8, 4];
  const n = folds[(hash >>> 0) % folds.length];
  const vowels = (word.match(/[aeiou]/gi) ?? []).length;
  const k = 9 + Math.min(word.length, 9) * 1.4 + vowels * 0.8 + pitch * 6;
  const phase = (((hash >>> 8) % 628) / 100) * 1;
  return { n, k, phase };
}

export class Cymatics {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
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

  /** `frag` is the look: any fragment shader that reads the uniforms above. */
  constructor(canvas: HTMLCanvasElement, frag: string = FRAG) {
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
    this.program = program;
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
