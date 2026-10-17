import type { Frame, Mode } from "./cymatics";

/**
 * Chladni sand: fine grains on an invisible vibrating plate.
 *
 * The figure is not drawn, it is found. Each grain is kicked at random in
 * proportion to how much the plate moves under it and drifts down the slope
 * of that motion, so grains on the parts that vibrate are thrown about and
 * grains on the nodal lines — where the plate stands still — stay put. Left
 * alone, the sand gathers into the figure by itself, which is what a real
 * plate does. When the word changes the mode, the grains on the old lines
 * find themselves on moving ground and walk, over a second or two, to the
 * new ones: one shape passes into the next rather than being replaced.
 *
 * The plate is the classic Chladni square, cos(aπx)cos(bπy) ∓ cos(bπx)cos(aπy),
 * never drawn. The sand thins out radially, so there is no plate and no frame
 * — only grains, fewer and fainter toward the outside.
 *
 * Simulated on the CPU and drawn as points: WebGL1 has no transform feedback.
 * What keeps it affordable on a phone, measured with the CPU throttled:
 * - a cosine table instead of eight `Math.cos`/`Math.sin` calls per grain;
 * - grains that have settled on a line are stepped one frame in three;
 * - the CPU uploads only where each grain is — its fade, colour and place on
 *   screen are the vertex shader's;
 * - the count follows the figure's area, and drops by itself if a frame
 *   still costs too much on the device it is running on.
 */

/**
 * The plates the sand lies on. Two kinds, because one kind gave too few
 * figures: the classic square, cos(aπx)cos(bπy) ∓ cos(bπx)cos(aπy) — crosses
 * and diagonals — and a round one, J_n(αr)·cos(nθ) + c·J₀(βr) — petals and
 * rings. Neither is drawn; only the sand on its still lines is.
 */
type Plate =
  | { kind: "square"; a: number; b: number; s: number; rank: number }
  | { kind: "round"; n: number; alpha: number; c: number; beta: number; rank: number; table?: RoundTable };

interface RoundTable {
  /** J_n(αr), α·J_n′(αr), J₀(βr), β·J₀′(βr), sampled over r in [0, R_MAX]. */
  jn: Float32Array;
  djn: Float32Array;
  j0: Float32Array;
  dj0: Float32Array;
}

const R_MAX = 1.5;
const R_STEPS = 1024;

/** Bessel J_n by its integral, J_n(x) = (1/π)∫₀^π cos(nτ − x sin τ) dτ. Exact enough, and only run when a figure is chosen. */
function besselJ(n: number, x: number) {
  const steps = 64;
  let sum = 0;
  for (let i = 0; i <= steps; i++) {
    const tau = (i / steps) * Math.PI;
    const w = i === 0 || i === steps ? 0.5 : 1;
    sum += w * Math.cos(n * tau - x * Math.sin(tau));
  }
  return sum / steps;
}

function tableFor(p: Extract<Plate, { kind: "round" }>): RoundTable {
  if (p.table) return p.table;
  const jn = new Float32Array(R_STEPS + 1);
  const djn = new Float32Array(R_STEPS + 1);
  const j0 = new Float32Array(R_STEPS + 1);
  const dj0 = new Float32Array(R_STEPS + 1);
  for (let i = 0; i <= R_STEPS; i++) {
    const r = (i / R_STEPS) * R_MAX;
    jn[i] = besselJ(p.n, p.alpha * r);
    djn[i] = (p.alpha * (besselJ(p.n - 1, p.alpha * r) - besselJ(p.n + 1, p.alpha * r))) / 2;
    j0[i] = besselJ(0, p.beta * r);
    dj0[i] = -p.beta * besselJ(1, p.beta * r);
  }
  p.table = { jn, djn, j0, dj0 };
  return p.table;
}

/** Simplest to most intricate; the voice's tone picks a place on this list. */
const PLATES: Plate[] = [];
for (let a = 1; a <= 4; a++) {
  for (let b = a + 1; b <= Math.min(5, a + 3); b++) {
    PLATES.push({ kind: "square", a, b, s: 1, rank: a * a + b * b }, { kind: "square", a, b, s: -1, rank: a * a + b * b + 0.5 });
  }
}
for (const n of [2, 3, 4, 5, 6, 8]) {
  // Every round figure carries a ring term. Without one, J_n(αr) is flat for
  // a long way out from the middle and the sand piled there in a blob — a
  // figure no plate makes.
  for (const [alpha, c, beta] of [
    [7.5, 0.6, 6.5],
    [10.5, 0.55, 9],
    [13.5, 0.45, 12.5],
  ]) {
    PLATES.push({ kind: "round", n, alpha, c, beta, rank: n * 2.2 + alpha * 0.9 });
  }
}
PLATES.sort((p, q) => p.rank - q.rank);

/** How many figures there are, for a story that shows them all. */
export const PLATE_COUNT = PLATES.length;

/**
 * The figure for a mode. Chosen by tone, it is the plate at that place on the
 * list — or one of its neighbours, by `variant`, so a voice that keeps
 * returning to the same pitch still sees new figures.
 */
const plateFor = (mode: Mode): Plate => {
  if (mode.order != null) {
    const at = Math.round(Math.min(1, Math.max(0, mode.order)) * (PLATES.length - 1));
    const shift = [0, 1, -1, 2, -2][(mode.variant ?? 0) % 5];
    return PLATES[Math.min(PLATES.length - 1, Math.max(0, at + shift))];
  }
  const index = Math.abs(Math.round(mode.k * 7 + mode.n * 13 + mode.phase * 31)) % PLATES.length;
  return PLATES[index];
};

/** The plate under a point: its displacement and slope, written into `out`. */
function sample(p: Plate, x: number, y: number, out: Float32Array) {
  if (p.kind === "square") {
    const { a, b, s } = p;
    const pa = Math.PI * a;
    const pb = Math.PI * b;
    const ca = cosPi(a * x);
    const sa = sinPi(a * x);
    const cbx = cosPi(b * x);
    const sbx = sinPi(b * x);
    const cay = cosPi(a * y);
    const say = sinPi(a * y);
    const cb = cosPi(b * y);
    const sb = sinPi(b * y);
    out[0] = (ca * cb - s * cbx * cay) * 0.5;
    out[1] = (-pa * sa * cb + s * pb * sbx * cay) * 0.5;
    out[2] = (-pb * ca * sb + s * pa * cbx * say) * 0.5;
    return;
  }
  const tb = p.table ?? tableFor(p);
  const r = Math.sqrt(x * x + y * y);
  const f = Math.min(R_STEPS - 1, (r / R_MAX) * R_STEPS);
  const i = f | 0;
  const w = f - i;
  const lerp = (arr: Float32Array) => arr[i] + (arr[i + 1] - arr[i]) * w;
  // cos(nθ) and sin(nθ) by raising the unit vector to the nth power, with a
  // petal pointing straight up.
  const ux = r > 1e-5 ? y / r : 1;
  const uy = r > 1e-5 ? -x / r : 0;
  let cn = 1;
  let sn = 0;
  for (let k = 0; k < p.n; k++) {
    const c2 = cn * ux - sn * uy;
    sn = cn * uy + sn * ux;
    cn = c2;
  }
  const jn = lerp(tb.jn);
  const fr = lerp(tb.djn) * cn + p.c * lerp(tb.dj0);
  // ∂f/∂θ divided by r; J_n vanishes like rⁿ at the centre, so this is finite.
  const ft = r > 1e-4 ? (-p.n * jn * sn) / r : 0;
  out[0] = (jn * cn + p.c * lerp(tb.j0)) * 1.6;
  // Back from the turned frame: θ was measured from straight up.
  const rx = r > 1e-5 ? x / r : 0;
  const ry = r > 1e-5 ? y / r : 1;
  out[1] = (fr * rx - ft * ry) * 1.6;
  out[2] = (fr * ry + ft * rx) * 1.6;
}

/** cos(πt), from a table: one period in 4096 steps, linearly interpolated. */
const STEPS = 4096;
const TABLE = new Float32Array(STEPS + 1);
for (let i = 0; i <= STEPS; i++) TABLE[i] = Math.cos((i / STEPS) * Math.PI * 2);
const cosPi = (t: number) => {
  const u = t * 0.5;
  const f = (u - Math.floor(u)) * STEPS;
  const i = f | 0;
  return TABLE[i] + (TABLE[i + 1] - TABLE[i]) * (f - i);
};
const sinPi = (t: number) => cosPi(t - 0.5);

const VERT = `
attribute vec2 aPos;    // plate units: the figure's radius is 1
attribute vec2 aMeta;   // shade, born (0..1 while a fresh grain fades in)
attribute vec2 aLaunch; // when this grain lands (0..1), and from which side it settles (-1..1)
uniform vec2 uView;     // css px
uniform vec2 uCenter;   // css px
uniform float uRadius;  // css px
uniform float uPour;    // 0..1: how far the sprinkling has got, on the sand's own clock
uniform float uSize;    // device px
uniform float uAlpha;
varying float vAlpha;
varying float vShade;
void main() {
  // Sprinkled from above, seen from above: each grain lands at its own
  // random moment, a little large and a little off its place — still in the
  // air, nearer the eye — and settles small onto it. Run backwards, the sand
  // lifts off the same way, faster.
  float r = length(aPos);
  const float FALL = 0.32;
  float k = clamp((uPour - aLaunch.x * (1.0 - FALL)) / FALL, 0.0, 1.0);
  k = 1.0 - (1.0 - k) * (1.0 - k) * (1.0 - k); // ease-out: lands, then settles
  float turn = aLaunch.y * 3.14159;
  vec2 home = uCenter + aPos * uRadius;
  vec2 css = home + vec2(cos(turn), sin(turn)) * 7.0 * (1.0 - k);
  vec2 clip = css / uView * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = uSize * mix(2.1, 1.0, k);
  // No fade: every grain is sand at full strength. The edge is made by there
  // being fewer grains, lying loose — see drop() and step().
  vAlpha = uAlpha * aMeta.y * k;
  vShade = aMeta.x;
}
`;

const FRAG = `
precision mediump float;
uniform vec3 uGrain;
varying float vAlpha;
varying float vShade;
void main() {
  // A soft round grain rather than a square pixel.
  float d = length(gl_PointCoord - 0.5);
  float a = vAlpha * smoothstep(0.5, 0.15, d);
  gl_FragColor = vec4(uGrain * vShade * a, a);
}
`;

const channel = (el: Element, name: string, fallback: [number, number, number]): [number, number, number] => {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const parts = raw.split(/[\s,]+/).map(Number);
  return parts.length >= 3 && parts.every((v) => Number.isFinite(v)) ? [parts[0] / 255, parts[1] / 255, parts[2] / 255] : fallback;
};

/** A small, fast, seedable generator, so a still frame is the same every time. */
const mulberry = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Tuning, all in plate units (the figure's radius is 1) and seconds. */
const TUNE = {
  /** Grains per css px² of the figure's disc. */
  density: 0.6,
  minGrains: 5000,
  maxGrains: 42000,
  /** How far a grain on the loudest part of the plate is thrown per √s. */
  kick: 0.12,
  /** How hard grains slide toward stillness. Low: a figure takes seconds to gather. */
  drift: 0.05,
  /** What silence still does while listening: barely anything. */
  idle: 0.2,
  /** The shortest time a figure holds before the next word may change it. */
  hold: 1.6,
  /** Seconds for the stream to pour out of the microphone, and back into it. */
  pourOut: 1.1,
  pourBack: 0.45,
  /** The kick a grain gets even where the plate is still, as a share of the full kick. */
  jostle: 0.15,
  /** Where the sand starts to run out, and where there is none left (the figure's radius is 1). */
  edgeFrom: 0.55,
  edgeTo: 1.2,
  /** How hard, and for how long, the plate shakes everything when the figure changes. */
  scatter: 2.4,
  scatterFor: 0.55,
  /** The share of grains that barely gather — the dust left lying across a real plate. */
  dust: 0.1,
  /** Below this, a grain is on a line and only needs stepping now and then. */
  calm: 0.04,
  /** Frame cost, in ms of main thread, past which the sand thins itself. */
  budget: 5,
};

export class Sand {
  readonly canvas: HTMLCanvasElement;
  center = { x: 0, y: 0 };
  mic = { x: 0, y: 0 };
  radius = 160;

  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private posBuffer: WebGLBuffer;
  private metaBuffer: WebGLBuffer;
  private u: Record<string, WebGLUniformLocation | null> = {};
  /** Grains allocated, and how many of them are in play. */
  private size = 0;
  private count = 0;
  private pos = new Float32Array(0);
  /** shade, born — interleaved for the GPU. */
  private meta = new Float32Array(0);
  private metaDirty = true;
  private launchBuffer: WebGLBuffer;
  private minmax: EXT_blend_minmax | null = null;
  private launch = new Float32Array(0);
  private launchDirty = true;
  /** How far the stream has run, 0..1 — slower than the composer's spring on purpose. */
  private pour = 0;
  private growing = 0;
  private calm = new Uint8Array(0);
  /** How firmly each grain is drawn to the lines: most fully, the dust hardly. */
  private grip = new Float32Array(0);
  private frameNo = 0;
  private cost = 0;
  private costFrames = 0;
  private rand = mulberry(7);
  private plate: Plate = PLATES[0];
  private here = new Float32Array(3);
  private pending: Plate | null = null;
  private changedAt = -Infinity;
  private lastTime = -1;
  private scattered = false;
  private colours: { at: number; grain: [number, number, number] } | null = null;
  /** Dark grains on paper read heavier than light ones on black; this evens them out. */
  private weight = 1;

  static supported(): boolean {
    try {
      return !!document.createElement("canvas").getContext("webgl");
    } catch {
      return false;
    }
  }

  constructor(canvas: HTMLCanvasElement) {
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
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
    this.program = program;
    this.posBuffer = gl.createBuffer()!;
    this.metaBuffer = gl.createBuffer()!;
    this.launchBuffer = gl.createBuffer()!;
    this.minmax = gl.getExtension("EXT_blend_minmax");
    for (const name of ["uView", "uCenter", "uRadius", "uPour", "uSize", "uAlpha", "uGrain"]) this.u[name] = gl.getUniformLocation(program, name);
  }

  /** Still drawing: the stream runs on after the composer has settled. */
  get active() {
    return this.pour > 0;
  }

  /** How many grains are in play — for measuring. */
  get grains() {
    return this.count;
  }

  /** The next word's figure. It waits its turn: a figure holds before the next replaces it. */
  setMode(mode: Mode) {
    this.pending = plateFor(mode);
  }

  /** Jump straight to a settled figure — for reduced motion, where nothing should travel. */
  setModeNow(mode: Mode) {
    this.plate = plateFor(mode);
    this.pending = null;
    this.ensure();
    this.scatter();
    // Let the sand find the lines out of sight, then show where it came to
    // rest — not all the way, or the lines come out drawn rather than poured.
    for (let i = 0; i < 120; i++) this.step(1 / 30, 1, 1, true);
  }

  private ensure() {
    const want = Math.round(Math.min(TUNE.maxGrains, Math.max(TUNE.minGrains, Math.PI * this.radius * this.radius * TUNE.density)));
    if (want === this.size) return;
    this.size = want;
    this.count = want;
    this.pos = new Float32Array(want * 2);
    this.meta = new Float32Array(want * 2);
    this.calm = new Uint8Array(want);
    this.grip = new Float32Array(want);
    for (let i = 0; i < want; i++) this.grip[i] = this.rand() < TUNE.dust ? 0.12 : 1;
    for (let i = 0; i < want; i++) this.meta[i * 2] = 0.55 + 0.45 * this.rand();
    this.launch = new Float32Array(want * 2);
    for (let i = 0; i < want; i++) {
      this.launch[i * 2] = this.rand();
      this.launch[i * 2 + 1] = this.rand() * 2 - 1;
    }
    this.launchDirty = true;
    this.scatter();
  }

  /** A grain dropped somewhere on the heap: dense in the middle, thinning out, no edge. */
  private drop(i: number) {
    // Evenly over the middle of the plate, as sand is poured on a real one —
    // a heap dense in the middle left the outer lines with nothing to gather
    // from. Past that, ever fewer grains, out to nothing: the edge of the
    // figure is sand running out, not sand fading.
    let r = 0;
    for (let tries = 0; tries < 8; tries++) {
      r = 1.25 * Math.sqrt(this.rand());
      if (this.rand() < 1 - smooth(TUNE.edgeFrom, TUNE.edgeTo, r)) break;
    }
    const t = this.rand() * Math.PI * 2;
    this.pos[i * 2] = Math.cos(t) * r;
    this.pos[i * 2 + 1] = Math.sin(t) * r;
    this.calm[i] = 0;
  }

  private scatter() {
    for (let i = 0; i < this.size; i++) {
      this.drop(i);
      this.meta[i * 2 + 1] = 1;
    }
    this.growing = 0;
    this.metaDirty = true;
    this.scattered = true;
  }

  /**
   * One step of the plate. `drive` is how hard it is shaken (the voice);
   * `live` is whether it is shaken at all.
   */
  private step(dt: number, drive: number, live: number, every = false, scatter = 0) {
    if (live <= 0) return;
    const plate = this.plate;
    const here = this.here;
    // A square root, so ordinary speech already shakes the plate properly: a
    // quiet voice left the figures half-gathered when the next one came.
    const shake = live * (TUNE.idle + (1 - TUNE.idle) * Math.sqrt(Math.max(0, drive)));
    const kick = TUNE.kick * shake * Math.sqrt(dt);
    const drift = TUNE.drift * shake * dt * 60 * 0.02;
    // A settled grain is stepped one frame in three, with three frames' worth.
    const kickCalm = kick * Math.sqrt(3);
    const driftCalm = drift * 3;
    const slot = this.frameNo++ % 3;
    const { pos, calm, meta } = this;
    for (let i = 0; i < this.count; i++) {
      const settled = calm[i] === 1;
      if (settled && !every && i % 3 !== slot) continue;
      const x = pos[i * 2];
      const y = pos[i * 2 + 1];
      // The plate's displacement under the grain, and its slope.
      sample(plate, x, y, here);
      const f = here[0];
      const fx = here[1];
      const fy = here[2];
      const amp = Math.min(1, Math.abs(f));
      calm[i] = amp < TUNE.calm ? 1 : 0;
      // Never quite still: a floor under the kick keeps the grains on a line
      // jostling, so a line is a band of sand with strays around it, the way
      // it is on a real plate, rather than a pencil stroke one grain wide.
      // A syllable jostles every grain a little, even on a line; the plate
      // gathers them back within the next few frames.
      // Just after a change the whole plate shakes hard for a moment, lines
      // and all, so the sand spreads out again before it gathers. Without it
      // grains walked only to the nearest new line: those piled up dark and
      // the lines further off stayed empty.
      const k = (settled && !every ? kickCalm : kick) * (amp + TUNE.jostle + TUNE.scatter * scatter);
      const d = settled && !every ? driftCalm : drift;
      // Thrown about where the plate moves, still where it does not…
      let nx = x + k * (this.rand() + this.rand() - 1) * 1.7;
      let ny = y + k * (this.rand() + this.rand() - 1) * 1.7;
      // …and sliding toward where it does not. Divided by the slope squared,
      // so a grain closes on its line at the same pace however steep the
      // plate is there: steep places used to pull the sand into a hairline
      // while gentle ones left a wide smear.
      // Toward the edge the plate barely gathers: the last grains lie loose,
      // scattered, instead of drawing lines that stop at a circle.
      // Never wholly: loose grains spread evenly and read as a grey ring.
      const loose = 1 - 0.75 * smooth(TUNE.edgeFrom + 0.05, TUNE.edgeTo, Math.sqrt(x * x + y * y));
      const pull = ((d * 150) / (fx * fx + fy * fy + 4)) * this.grip[i] * loose;
      nx -= pull * f * fx;
      ny -= pull * f * fy;
      if (nx * nx + ny * ny > 1.35 * 1.35) {
        // Off the heap: it comes back as a fresh grain somewhere in the middle.
        this.drop(i);
        if (meta[i * 2 + 1] >= 1) this.growing++;
        meta[i * 2 + 1] = 0;
        this.metaDirty = true;
        continue;
      }
      pos[i * 2] = nx;
      pos[i * 2 + 1] = ny;
    }
  }

  draw(frame: Frame, now = performance.now()) {
    const started = performance.now();
    const { gl, canvas } = this;
    this.ensure();
    const dt = this.lastTime < 0 ? 0 : Math.min(0.05, Math.max(0, frame.time - this.lastTime));
    this.lastTime = frame.time;
    // The sand keeps its own time: about a second to settle, under half a
    // second to lift off — arriving is the event, leaving is not.
    const target = frame.open > 0.5 ? 1 : 0;
    if (dt > 0) this.pour = target ? Math.min(1, this.pour + dt / TUNE.pourOut) : Math.max(0, this.pour - dt / TUNE.pourBack);
    // No time passing is a still frame — reduced motion, a vocabulary cell:
    // the sand is simply where it is going.
    else this.pour = target;
    if (this.pour <= 0) {
      // Home in the microphone: the next opening starts from fresh sand.
      if (!this.scattered) this.scatter();
    } else {
      this.scattered = false;
    }
    if (this.pending && frame.time - this.changedAt >= TUNE.hold) {
      this.plate = this.pending;
      this.pending = null;
      this.changedAt = frame.time;
      // Every grain is on new ground now; none of them is settled.
      this.calm.fill(0);
    }
    const scatter = Math.max(0, 1 - (frame.time - this.changedAt) / TUNE.scatterFor);
    if (dt > 0) this.step(dt, frame.level, frame.live, false, scatter * scatter);

    // Fresh grains fade in over about a third of a second.
    if (this.growing > 0 && dt > 0) {
      const grow = Math.min(1, dt * 3);
      let still = 0;
      for (let i = 0; i < this.count; i++) {
        const born = this.meta[i * 2 + 1];
        if (born >= 1) continue;
        const next = Math.min(1, born + grow);
        this.meta[i * 2 + 1] = next;
        if (next < 1) still++;
      }
      this.growing = still;
      this.metaDirty = true;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.pour <= 0) return;

    if (!this.colours || now - this.colours.at > 500) {
      this.colours = { at: now, grain: channel(canvas, "--ick-ink-rgb", [0.07, 0.07, 0.07]) };
      const [r, g, b] = this.colours.grain;
      // With the strongest grain winning, a band is as dark as one grain:
      // 72% on paper, which is what reads as sand there.
      this.weight = this.minmax ? (r + g + b < 1.5 ? 0.85 : 0.95) : r + g + b < 1.5 ? 0.5 : 0.8;
    }

    gl.useProgram(this.program);
    const posLoc = gl.getAttribLocation(this.program, "aPos");
    const metaLoc = gl.getAttribLocation(this.program, "aMeta");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.pos.subarray(0, this.count * 2), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.metaBuffer);
    if (this.metaDirty) {
      gl.bufferData(gl.ARRAY_BUFFER, this.meta, gl.DYNAMIC_DRAW);
      this.metaDirty = false;
    }
    gl.enableVertexAttribArray(metaLoc);
    gl.vertexAttribPointer(metaLoc, 2, gl.FLOAT, false, 0, 0);
    const launchLoc = gl.getAttribLocation(this.program, "aLaunch");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.launchBuffer);
    if (this.launchDirty) {
      gl.bufferData(gl.ARRAY_BUFFER, this.launch, gl.STATIC_DRAW);
      this.launchDirty = false;
    }
    gl.enableVertexAttribArray(launchLoc);
    gl.vertexAttribPointer(launchLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.u.uView, canvas.clientWidth, canvas.clientHeight);
    gl.uniform2f(this.u.uCenter, this.center.x, this.center.y);
    gl.uniform1f(this.u.uRadius, this.radius);
    gl.uniform1f(this.u.uPour, this.pour);
    gl.uniform1f(this.u.uSize, 1.6 * dpr);
    // Waiting, the sand lies scattered and faint — present, not a disc.
    gl.uniform1f(this.u.uAlpha, (0.2 + 0.65 * frame.live) * this.weight);
    gl.uniform3f(this.u.uGrain, ...this.colours.grain);
    gl.enable(gl.BLEND);
    if (this.minmax) {
      // The strongest grain at a pixel wins rather than all of them adding up:
      // a dense band is solid sand at one grain's strength, never black, and
      // a stray grain still reads as a grain.
      gl.blendEquation(this.minmax.MAX_EXT);
    } else {
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
    gl.drawArrays(gl.POINTS, 0, this.count);

    // A device that cannot keep up gets less sand rather than a stutter.
    const spent = performance.now() - started;
    this.cost = this.costFrames === 0 ? spent : this.cost * 0.9 + spent * 0.1;
    this.costFrames++;
    if (this.costFrames > 30 && this.cost > TUNE.budget && this.count > TUNE.minGrains) {
      this.count = Math.max(TUNE.minGrains, Math.floor(this.count * 0.8));
      this.costFrames = 0;
    }
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

function smooth(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
