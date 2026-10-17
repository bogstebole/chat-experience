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

interface Plate {
  a: number;
  b: number;
  /** +1 or −1: which of the two degenerate combinations. */
  s: number;
}

/**
 * Low-order modes only. Past about five the figure turns into a lattice of
 * cells — correct, and nothing like the simple, open figures that make a
 * plate worth watching. A word picks one; the same word always picks the same.
 */
const PLATES: Plate[] = [];
for (let a = 1; a <= 4; a++) {
  for (let b = a + 1; b <= Math.min(5, a + 3); b++) {
    PLATES.push({ a, b, s: 1 }, { a, b, s: -1 });
  }
}

/** The same plates from simplest to most intricate, for a figure chosen by tone. */
const BY_ORDER = [...PLATES].sort((p, q) => p.a * p.a + p.b * p.b - (q.a * q.a + q.b * q.b) || p.s - q.s);

const plateFor = (mode: Mode): Plate => {
  if (mode.order != null) {
    return BY_ORDER[Math.round(Math.min(1, Math.max(0, mode.order)) * (BY_ORDER.length - 1))];
  }
  const index = Math.abs(Math.round(mode.k * 7 + mode.n * 13 + mode.phase * 31)) % PLATES.length;
  return PLATES[index];
};

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
  // Thinning toward the outside, never stopping at a line.
  float fade = 1.0 - smoothstep(0.3, 1.0, r);
  vAlpha = uAlpha * fade * aMeta.y * k;
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
  density: 0.24,
  minGrains: 5000,
  maxGrains: 22000,
  /** How far a grain on the loudest part of the plate is thrown per √s. */
  kick: 0.1,
  /** How hard grains slide toward stillness. Low: a figure takes seconds to gather. */
  drift: 0.028,
  /** What silence still does while listening: barely anything. */
  idle: 0.08,
  /** The shortest time a figure holds before the next word may change it. */
  hold: 2.2,
  /** Seconds for the stream to pour out of the microphone, and back into it. */
  pourOut: 1.1,
  pourBack: 0.45,
  /** Sand is scattered as a soft heap of this width. */
  spread: 0.62,
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
  private launch = new Float32Array(0);
  private launchDirty = true;
  /** How far the stream has run, 0..1 — slower than the composer's spring on purpose. */
  private pour = 0;
  private growing = 0;
  private calm = new Uint8Array(0);
  private frameNo = 0;
  private cost = 0;
  private costFrames = 0;
  private rand = mulberry(7);
  private plate: Plate = PLATES[0];
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
    // Box–Muller, then a soft cap so the odd grain does not land far out.
    const u = Math.max(1e-6, this.rand());
    const v = this.rand();
    const r = Math.min(1.15, Math.sqrt(-2 * Math.log(u)) * TUNE.spread);
    const t = v * Math.PI * 2;
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
  private step(dt: number, drive: number, live: number, every = false) {
    if (live <= 0) return;
    const { a, b, s } = this.plate;
    const pa = Math.PI * a;
    const pb = Math.PI * b;
    const shake = live * (TUNE.idle + (1 - TUNE.idle) * drive);
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
      // The plate's displacement under the grain, and its slope. The plate
      // spans [-1, 1] in both directions; the figure lives inside it.
      const ca = cosPi(a * x);
      const sa = sinPi(a * x);
      const cbx = cosPi(b * x);
      const sbx = sinPi(b * x);
      const cay = cosPi(a * y);
      const say = sinPi(a * y);
      const cb = cosPi(b * y);
      const sb = sinPi(b * y);
      const f = ca * cb - s * cbx * cay;
      const fx = -pa * sa * cb + s * pb * sbx * cay;
      const fy = -pb * ca * sb + s * pa * cbx * say;
      const amp = Math.min(1, Math.abs(f) * 0.5);
      calm[i] = amp < TUNE.calm ? 1 : 0;
      const k = (settled && !every ? kickCalm : kick) * amp;
      const d = settled && !every ? driftCalm : drift;
      // Thrown about where the plate moves, still where it does not…
      let nx = x + k * (this.rand() + this.rand() - 1) * 1.7;
      let ny = y + k * (this.rand() + this.rand() - 1) * 1.7;
      // …and sliding toward where it does not, down the slope of f².
      nx -= d * f * fx;
      ny -= d * f * fy;
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
    if (dt > 0) this.step(dt, frame.level, frame.live);

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
      this.weight = r + g + b < 1.5 ? 0.72 : 1;
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
    gl.uniform1f(this.u.uSize, 1.5 * dpr);
    // Waiting, the sand lies scattered and faint — present, not a disc.
    gl.uniform1f(this.u.uAlpha, (0.2 + 0.65 * frame.live) * this.weight);
    gl.uniform3f(this.u.uGrain, ...this.colours.grain);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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
