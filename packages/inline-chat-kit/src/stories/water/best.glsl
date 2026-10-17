precision highp float;
// Interference water. Nothing here is drawn: the figure is the relief that
// circular waves make where they cross, rendered as a glossy surface.
//
// The waves (all coherent, one frequency, so the pattern stands):
//   one drop at the centre, short waves at 0.7 k, fading fast with distance;
//   n drops on an invisible wall at 0.92 R, the first straight up, long waves
//   (about n / R across, so a fold always has room for its petals) that only
//   run inward; folds 3 and 4 also drive their corners, weaker and later.
// Each pixel sums the complex field U, its exact gradient and its curvature
// (Helmholtz: lap = -k^2 U) in one pass, at most 9 waves a word, 18 in a
// morph. The relief is |U| over the incoherent sum sqrt(sum |A|^2): water
// heaps where the waves add, creases where they cancel, and the falloff of
// the drops themselves carries no relief at all. A small share travels:
// Re(U e^-iwt), at 0.15 of the relief's gain, ripples running out through
// the standing figure, one every 4 s; in silence only the drop's ripple is
// left. Lit from above and mirrored about the vertical, so no flank is
// brighter than its twin.
//
// Where it came from:
//   sources  - coherent point sources, complex sum and analytic gradient,
//              softened distance, the compact window, the travelling term.
//   hybrid   - long rim waves against short centre waves, the wall taper,
//              subtracting the incoherent mean, the rim-to-centre phase
//              (word phase + 2.3 k: never a rotation), the 4 s beat.
//   dish     - the morph that grows from the centre with cos/sin weights and
//              similarity normalisation, reach that grows with the voice,
//              highlights read from the un-windowed surface and faded with
//              it, light gathered under the crests in the dark, the room in
//              the flanks, coverage dither.
//   plane    - slopes not heights: every wave is scaled by 1/k; a quiet voice
//              gets more relief in the light theme.
//   glass/milk (round one) - the material: a milk-white body that melts into
//              the paper, a soft box mirrored in the crests, the swell and its
//              crescent of sheen, the light under the water seen through it.
//   new here - the relief mixed per word rather than per intensity (so a
//              morph neither dims nor flattens); crease softness tied to the
//              pixel footprint; highlights that skip tight folds; a smooth
//              drop where the voice drives the water; silence that rings the
//              same whatever the last word was.

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
uniform float uDark;

#define KC 0.7
#define KSIL 18.0
#define KRMIN 8.0
#define KRN 1.4
#define R0 0.92
#define SUBN 4.0
#define SUBA 0.8
#define SUBA4 0.7
#define SUBR 0.85
#define SUBP 1.6
#define AC 0.7
#define AC3 1.3
#define AR 1.0
#define RSL 10.0
#define DECC 4.0
#define DECR 0.4
#define WIN 0.1
#define WOUT 0.25
#define PHK 2.3
#define CR 0.15
#define CRC 2.0
#define CB 1.5
#define GAIN 0.05
#define LQ 0.9
#define DQ 0.45
#define TSIL 0.85
#define TMOV 0.15
#define DOME 0.05
#define DROP 0.25
#define DS 2.6
#define WE0 0.6
#define ROOMA 0.13
#define KY 0.45
#define KW 0.05
#define CURVB 25.0
#define KEYL 0.9
#define DKEY 0.1
#define DKC 0.4
#define DTHICK 0.1
#define LTHICK 0.03
#define DROOM 0.1
#define ROOML 0.16
#define CREASEL 0.12
#define BODYG 0.11
#define VEXL 0.3
#define DLENS 0.4

const float TAU = 6.2831853;
const float OMEGA = 1.5707963;

vec2 U;
vec4 G;
vec2 LK;
float I;
vec2 GI;

void src(vec2 p, vec2 s, float K, float psi, float amp, float dec) {
  vec2 v = p - s;
  float d2 = dot(v, v) + 0.0016;
  float id = inversesqrt(d2);
  float d = d2 * id;
  vec2 dd = v * id;
  float q = 1.0 / (1.0 + dec * d2);
  float A = amp * q;
  float dA = -2.0 * dec * d * q * A;
  float ph = K * d + psi;
  float c = cos(ph);
  float sn = sin(ph);
  U += A * vec2(c, sn);
  LK += K * K * A * vec2(c, sn);
  G.xy += (dA * c - A * K * sn) * dd;
  G.zw += (dA * sn + A * K * c) * dd;
  I += A * A;
  GI += 2.0 * A * dA * dd;
}

void word(vec2 p, float rho, vec3 m, float ring) {
  U = vec2(0.0); G = vec4(0.0); LK = vec2(0.0); I = 0.0; GI = vec2(0.0);
  float n = m.x;
  float K = m.y;
  // In silence the drop rings at one length whatever the last word was.
  float Kc = mix(KSIL, K, ring) * KC;
  if (ring > 0.0) {
    // A low fold's wall drives its corners too, more weakly and later, so
    // the figure has petals between its points rather than bare bands.
    float sub = n < SUBN + 0.5 ? 2.0 : 1.0;
    float m2 = n * sub;
    // Three corners lean in, so the drop stays the heart of the figure;
    // four stand on the wall, so four petals open between them.
    float three = step(n, 3.5);
    float sA = mix(SUBA4, SUBA, three);
    float sR = mix(1.0, SUBR, three);
    float kr = max(KRMIN, KRN * m2 / R0) * (0.85 + 0.015 * (K - 10.0));
    float psi = m.z + PHK * K;
    // Every ring wave tilts the water alike, whatever its length.
    float ar = AR * ring * (RSL / kr) * inversesqrt(max(m2, 1.0)) * 2.0;
    if (n < 0.5) {
      float rs = sqrt(rho * rho + 0.0016);
      float d = R0 - rs;
      float A = ar * 2.0;
      float ph = kr * d + psi;
      float c = cos(ph);
      float sn = sin(ph);
      vec2 dd = -p / rs;
      U += A * vec2(c, sn);
      LK += kr * kr * A * vec2(c, sn);
      G.xy += -A * kr * sn * dd;
      G.zw += A * kr * c * dd;
      I += A * A;
    } else {
      // The first source straight above the centre, the rest a turn of the
      // ring apart, so every figure stands upright and mirrored.
      float st = TAU / n;
      vec2 cs = vec2(cos(st), sin(st));
      vec2 ch = vec2(cos(0.5 * st), sin(0.5 * st));
      vec2 q = vec2(0.0, R0);
      for (int i = 0; i < 8; i++) {
        if (float(i) >= n) break;
        src(p, q, kr, psi, ar, DECR);
        if (sub > 1.5) src(p, sR * vec2(q.x * ch.x - q.y * ch.y, q.x * ch.y + q.y * ch.x), kr, psi + SUBP, ar * sA, DECR);
        q = vec2(q.x * cs.x - q.y * cs.y, q.x * cs.y + q.y * cs.x);
      }
    }
    // The ring sits on the dish wall: its waves run in, never out past it.
    float x = clamp((rho - R0 + WIN) / (WIN + WOUT), 0.0, 1.0);
    float w = 1.0 - x * x * (3.0 - 2.0 * x);
    vec2 gw = -6.0 * x * (1.0 - x) / (WIN + WOUT) * p / max(rho, 1e-4);
    G = G * w + vec4(U.x * gw, U.y * gw);
    U *= w;
    LK *= w;
    GI = GI * w * w + 2.0 * w * I * gw;
    I *= w * w;
  }
  src(p, vec2(0.0), Kc, 0.0, 14.0 / Kc * AC * mix(1.0, n < 3.5 ? AC3 : 1.0, ring), DECC);
}

// The relief one word's waves make: |U| over the incoherent sum, softened
// where they cancel, so a node folds into a crease rather than a cusp, and
// never thinner than a pixel or two.
vec4 relief(vec2 Uw, vec4 Gw, vec2 Lw, float Iw, vec2 GIw, float crr) {
  float Q = dot(Uw, Uw);
  vec2 gQ = 2.0 * (Uw.x * Gw.xy + Uw.y * Gw.zw);
  float g2 = dot(Gw, Gw);
  float lQ = 2.0 * g2 - 2.0 * dot(Uw, Lw);
  float c2 = crr * Iw + CB * CB * g2 / (uRadius * uRadius);
  float f = sqrt(Q + c2);
  float fm = sqrt(Iw + c2);
  vec2 gq = gQ + crr * GIw;
  vec2 gS = gq / (2.0 * f) - (1.0 + crr) * GIw / (2.0 * fm);
  float lS = lQ / (2.0 * f) - dot(gq, gq) / (4.0 * f * f * f);
  return vec4(f - fm, gS, lS);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r2 = dot(p, p);
  float r = sqrt(r2);

  float dm = length(frag - uMic);
  float span = length(uMic - uCenter) + 1.25 * uRadius;
  float front = (0.48 + 1.18 * uOpen) * span;
  float rev = (1.0 - smoothstep(front - 0.5 * span, front, dm)) * smoothstep(0.0, 0.25, uOpen);
  float alpha = (1.0 - smoothstep(0.55, 1.25, r)) * rev;
  if (alpha < 0.5 / 255.0) { gl_FragColor = vec4(0.0); return; }

  float dome = DOME * exp(-r2 * DS);
  vec2 g = -2.0 * DS * p * dome;
  float lap = dome * (4.0 * DS * DS * r2 - 4.0 * DS);
  vec2 gu = g;
  vec2 g0 = g;
  float lapu = lap;
  float cw = 0.0;
  float drive = 0.0;
  float thick = 0.0;
  float figure = 0.0;

  if (uLive > 0.0) {
    float lv = clamp(uLevel, 0.0, 1.0);
    drive = pow(max(lv, 1e-6), 0.6);
    float ring = smoothstep(0.02, 0.14, lv);
    figure = ring;

    float t = clamp(uMix * 1.6 - 0.5 * r, 0.0, 1.0);
    float th = 1.5707963 * t * t * (3.0 - 2.0 * t);
    vec2 gth = 1.5707963 * 6.0 * t * (1.0 - t) * -0.5 * p / max(r, 1e-4);
    float wa = cos(th);
    float wb = sin(th);
    if (uMix >= 1.0) { wa = 0.0; wb = 1.0; gth = vec2(0.0); }
    if (uMix <= 0.0) { wa = 1.0; wb = 0.0; gth = vec2(0.0); }

    vec2 UA = vec2(0.0); vec4 GA = vec4(0.0); vec2 LA = vec2(0.0); float IA = 0.0; vec2 GIA = vec2(0.0);
    if (wa > 0.0) { word(p, r, uA, ring); UA = U; GA = G; LA = LK; IA = I; GIA = GI; }
    vec2 UB = vec2(0.0); vec4 GB = vec4(0.0); vec2 LB = vec2(0.0); float IB = 0.0; vec2 GIB = vec2(0.0);
    if (wb > 0.0) { word(p, r, uB, ring); UB = U; GB = G; LB = LK; IB = I; GIB = GI; }

    // The still figure, word by word: how hard the water swings at each
    // point, over what it would swing if the waves did not interfere, so
    // only the crossings carry relief. The two words then mix with a cosine
    // and a sine: unlike figures keep their energy, and a word that follows
    // itself is scaled back so it does not swell.
    float crr = CR * CR + CRC * exp(-r2 * 12.0);
    vec4 RA = wa > 0.0 ? relief(UA, GA, LA, IA, GIA, crr) : vec4(0.0);
    vec4 RB = wb > 0.0 ? relief(UB, GB, LB, IB, GIB, crr) : vec4(0.0);
    vec3 dAB = uA - uB;
    float sim = exp(-dot(dAB * dAB, vec3(4.0, 0.5, 1.0)));
    float ns = inversesqrt(1.0 + 2.0 * wa * wb * sim);
    float S = (wa * RA.x + wb * RB.x) * ns;
    vec2 gS = (wa * RA.yz + wb * RB.yz + (wa * RB.x - wb * RA.x) * gth) * ns;
    float lS = (wa * RA.w + wb * RB.w) * ns;

    // The waves themselves, riding slowly outward through the figure.
    float T = mod(uTime, 4.0) * OMEGA;
    float ct = cos(T);
    float st = sin(T);
    // Both words ring the same drop: where their lengths agree, their
    // ripples add in step, so the sum is scaled back to one ripple's worth.
    float dK = (uA.y - uB.y) * ring;
    float nt = inversesqrt(1.0 + 2.0 * wa * wb * exp(-dK * dK * 0.1));
    vec2 Ut = (wa * UA + wb * UB) * nt;
    vec4 Gt = (wa * GA + wb * GB + vec4(-wb * UA.x * gth + wa * UB.x * gth, -wb * UA.y * gth + wa * UB.y * gth)) * nt;
    vec2 Lt = -(wa * LA + wb * LB) * nt;
    float ht = Ut.x * ct + Ut.y * st;
    vec2 ght = Gt.xy * ct + Gt.zw * st;
    float lht = Lt.x * ct + Lt.y * st;

    float AF = uLive * GAIN * mix(uDark > 0.5 ? DQ : LQ, 1.0, drive);
    float AT = uLive * GAIN * (TSIL * (1.0 - ring) + TMOV * ring) * (0.55 + 0.45 * drive);
    vec2 gH = AF * gS + AT * ght;
    float lH = AF * lS + AT * lht;

    float E = 0.66 + 0.28 * pow(max(lv, 1e-6), 0.75);
    float win = 1.0 - smoothstep(WE0 * E, E, r);
    // How much deeper than still water: the eye reads it through the water.
    thick = clamp((AF * S + AT * ht) * win * smoothstep(0.03, 0.2, r) / GAIN, -1.0, 1.0);
    // The drop at the centre, where the voice drives the water: a smooth
    // bead the waves gather round, rather than their own tangle there.
    float calm = smoothstep(0.03, 0.2, r);
    float dh = uLive * GAIN * DROP * (0.6 + 0.4 * drive);
    float de = exp(-r2 * 90.0);
    vec2 gd = -180.0 * p * de * dh;
    float ld = dh * de * (32400.0 * r2 - 360.0);
    g += win * calm * gH + gd;
    lap += win * calm * lH + ld;
    gu += calm * gH + gd;
    lapu += calm * lH + ld;
    cw = win * smoothstep(0.05, 0.3, drive);
  }

  // Seen from straight above, the surface mirrors the direction
  // -2 g / (1 + g.g): exact, with no normalising.
  vec2 R = -2.0 * g / (1.0 + dot(g, g));
  vec2 Ru = -2.0 * gu / (1.0 + dot(gu, gu));
  float fw = 2.0 * abs(lap) / uRadius;
  float fu = 2.0 * abs(lapu) / uRadius;

  vec2 q = p - g * 1.2;
  float glow = exp(-dot(q, q) * 3.0);
  float s2 = dot(R, R);
  float room = s2 / (s2 + 0.36);
  float ryn = R.y / (sqrt(s2) + 0.05);
  // How broad the curve is here: highlights belong to broad crests and
  // flanks, never to the tight fold of a crease, where they would trace it.
  float broad = 1.0 / (1.0 + lapu * lapu / (CURVB * CURVB));
  // The soft box above the dish, mirrored about the vertical, with a soft
  // but definite edge, as a wet surface shows it: glossy streaks on every
  // flank that faces it.
  vec2 qa = abs(Ru - vec2(0.0, KY)) - vec2(0.22, 0.07);
  float da = length(max(qa, 0.0)) + min(max(qa.x, qa.y), 0.0) - 0.06;
  float ew = KW + fu;
  float key = smoothstep(ew, -ew, da) * (KW / ew) * cw * broad;
  // Overhead, for dark water: the crowns of the heaps catch it, the folds
  // between them stay dark.
  float keys = smoothstep(0.34 + fu, 0.0, length(Ru * vec2(1.0, 1.25))) * cw * broad * smoothstep(0.0, 10.0, -lapu);
  // The sheen of the swell itself; the waves bend it only once the figure
  // stands, so silent ripples show as whole rings, never as arcs of it.
  vec2 gs = mix(g0, g, 0.3 + 0.7 * figure);
  vec2 Rs = -2.0 * gs / (1.0 + dot(gs, gs));
  float sheen = smoothstep(0.16 + fw, 0.0, length((Rs - vec2(0.0, 0.15)) * vec2(0.6, 1.0))) / (1.0 + lap * lap / (8.0 * 8.0));
  float cv = max(-lap, 0.0) * 0.02 / (1.0 + lap * lap / (CURVB * CURVB));
  float crease = smoothstep(0.05, 0.6, lap * 0.012) / (1.0 + fw);

  vec3 col;
  if (uDark < 0.5) {
    float tone = 0.01 + BODYG * glow + room * (ROOMA + ROOML * (0.5 - 0.5 * ryn)) + CREASEL * crease - LTHICK * thick;
    col = mix(uPaper, uInk, clamp(tone, 0.0, 0.25));
    float hi = KEYL * key * (0.5 + 0.5 * drive) + 0.45 * sheen + VEXL * cv;
    col = mix(col, uPaper, clamp(hi, 0.0, 1.0));
  } else {
    float tone = 0.02 + 0.07 * glow + DLENS * cv * (0.45 + 0.55 * figure) + DROOM * room * broad * (0.5 + 0.5 * ryn) + DTHICK * thick;
    col = mix(uPaper, uInk, clamp(tone, 0.0, 1.0) * 0.85);
    col *= 1.0 - 0.25 * crease;
    float hi = (DKEY * keys + DKC * key) * (0.25 + 0.75 * drive) + 0.18 * sheen;
    col = mix(col, uInk * 0.9, clamp(hi, 0.0, 1.0));
  }

  float n1 = hash12(frag) + hash12(frag + 17.31) - 1.0;
  float n2 = hash12(frag + 41.7) + hash12(frag + 73.9) - 1.0;
  vec3 dc = abs(col - uPaper);
  float wide = clamp(min(1.0 / max(max(uPaper.r, uPaper.g), uPaper.b), 1.0 / max(max(dc.r, dc.g), max(dc.b, 1e-3))), 1.0, 4.0);
  float a = clamp(alpha + n2 * wide / 255.0 * min(1.0, alpha * 32.0), 0.0, 1.0);
  gl_FragColor = vec4(clamp(col * a + n1 / 255.0 * min(1.0, a * 32.0), 0.0, a), a);
}
