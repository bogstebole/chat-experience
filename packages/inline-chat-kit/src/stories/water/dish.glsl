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
uniform float uDark;

// A dish: the voice drives the water at the centre, the wave runs out, meets
// the dish's invisible n-sided rim and comes back. Each straight side
// reflects it as if from a mirror image of the source behind that side, so
// the water carries one outgoing ring and n returning ones; where they cross
// in step the water heaps, where they cross out of step it stays flat. The
// petals, creases and ripples are those crossings, nothing drawn on top.

// Waves: wavenumber scale, the rim's distance, the strobe's sway, how much
// comes back, how fast a ring thins, slope at full voice and in silence.
#define KS 1.0
#define WALL 1.08
#define OMEGA 0.8
#define SWAYA 0.25
#define ODDOFF -1.05
#define RETURN 2.0
#define SPREAD 0.08
#define SLOPE 0.6
#define SILENT 0.2
#define REACHMAX 1.4
#define CW 1.0
#define NNORM 8.0
#define SIGMA -0.6
// The studio: ring light, room, soft box and key, creases and depth.
#define RINGS 0.4
#define RINGW 0.07
#define ROOMS 0.6
#define RINGL 0.7
#define ROOML 0.16
#define CREASEL 0.3
#define THICKL 0.12
#define BOXR 0.35
#define BOXL 0.12
#define KEYA 0.14
#define KEYB 0.1
#define DUNDER 0.05
#define DLENS 0.2
#define DTHICK 0.14

float SWAY;   // the strobe's slow drift: the phase sways about the figure
float REACH;  // how far a wave runs before the water stills it
float RET;    // how much comes back from the rim

// One circular wave from s: accumulates height and its gradient.
void wave(vec2 p, vec2 s, float K, float c, float w, float PH, inout vec3 acc) {
  vec2 v = p - s;
  float d = sqrt(dot(v, v) + 2e-3);
  float sp = 1.0 + SPREAD * K * d;
  float a = w * exp(-d / REACH) * inversesqrt(sp);
  float da = a * (-1.0 / REACH - 0.5 * SPREAD * K / sp);
  float ph = K * d - PH + c;
  float cs = cos(ph);
  float sn = sin(ph);
  acc += vec3(a * cs, (da * cs - a * K * sn) / d * v);
}

// One word's water: the outgoing wave and what the rim sends back.
vec3 mode(vec2 p, vec3 m) {
  float n = m.x;
  float K = m.y * KS;
  vec3 acc = vec3(0.0);
  // Seen in a strobe tuned to the drive: the moment the returning waves
  // meet at the centre in a crest, swaying a little either side of it.
  // An odd fold's images are not opposite one another, so its petals peak
  // out of step with its rings; its strobe sits between the two, or the
  // petals would never show.
  float PH = K * 2.0 * WALL + m.z + SWAY + (mod(n, 2.0) > 0.5 ? ODDOFF : 0.0);
  wave(p, vec2(0.0), K, 0.0, CW, PH, acc);
  if (n < 0.5) {
    // A round rim focuses the wave back onto the centre.
    float r = sqrt(dot(p, p) + 4e-4);
    float d = 2.0 * WALL - r;
    float sp = 1.0 + SPREAD * K * d;
    float a = RET * exp(-d / REACH) * inversesqrt(sp);
    float da = a * (-1.0 / REACH - 0.5 * SPREAD * K / sp);
    float ph = K * d - PH + m.z;
    acc += vec3(a * cos(ph), -(da * cos(ph) - a * K * sin(ph)) / r * p);
  } else {
    float w = RET * inversesqrt(n / NNORM);
    for (int i = 0; i < 8; i++) {
      if (float(i) >= n) break;
      float th = 6.2831853 * float(i) / n;
      wave(p, 2.0 * WALL * vec2(sin(th), cos(th)), K, m.z, w, PH, acc);
    }
  }
  // Every word as deep: slope, not height, is what reads.
  return acc / K;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r = length(p);

  // Opens out of the microphone as a soft growing blob, never a hard circle.
  float reach = length(uRes) * 2.0;
  float dm = length(frag - uMic);
  float rev = (1.0 - smoothstep(0.3, 1.0, dm / max(uOpen * reach, 1.0))) * smoothstep(0.0, 0.6, uOpen);
  float alpha = (1.0 - smoothstep(0.6, 1.2, r)) * rev;
  if (alpha < 0.5 / 255.0) { gl_FragColor = vec4(0.0); return; }

  // The still water: a gentle swell over the light under the dish.
  float sw = exp(-r * r * 3.0);
  float h = 0.05 * sw;
  vec2 g = p * (-0.3 * sw);
  float lap = 0.0;
  float thick = 0.0;
  // The waves as they are before they calm toward the edge, and how much of
  // them is left: the crisp reflections are read from these, so none of them
  // can trace the circle where the water calms.
  vec2 gu = g;
  float lapu = 0.0;
  float cw = 0.0;

  if (uLive > 0.0) {
    // 20 pi: whole turns of the sway, so the wrap never shows.
    float T = mod(uTime, 62.831853);
    float lv = clamp(uLevel, 0.0, 1.0);
    float drv = pow(lv, 0.6);
    // A quiet voice: the waves die out before they reach the rim, and only
    // the centre ripples. A voice: they run to the rim and come back.
    float back = smoothstep(0.0, 0.2, drv);
    REACH = mix(0.45, REACHMAX, back);
    RET = RETURN * back;
    // Silent water breathes wider, so listening shows it is alive.
    SWAY = SWAYA * (1.0 + 2.5 * (1.0 - back)) * (0.7 * sin(T * OMEGA) + 0.3 * sin(T * 1.9 + 1.0));
    float S = uLive * mix(SILENT, SLOPE, drv);
    // The louder, the further the figure spreads across the dish.
    float E = 0.55 + 0.45 * pow(lv, 0.75);

    // A new word's waves leave the centre first.
    float m = clamp(uMix * 1.6 - 0.48 * r, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    float wa = cos(m * 1.5707963);
    float wb = sin(m * 1.5707963);
    vec3 dAB = uA - uB;
    float sim = exp(-dot(dAB, dAB) * 4.0);
    vec3 f = wb * mode(p, uB);
    if (uMix < 1.0) f += wa * mode(p, uA);
    f *= inversesqrt(1.0 + 2.0 * wa * wb * sim);

    // Deep water is not linear: crests heap up sharp, troughs flatten.
    float K = mix(uA.y, uB.y, m) * KS;
    float sg = SIGMA * drv * K;
    float lapf = 0.0;
    if (abs(sg) > 1e-3) {
      float ex = exp(clamp(sg * f.x, -4.0, 4.0));
      lapf = ex * sg * dot(f.yz, f.yz);
      f = vec3((ex - 1.0) / sg, f.yz * ex);
    }
    // The waves calm before the water ends, so nothing traces where it does.
    float x = clamp((r - 0.5 * E) / (0.45 * E), 0.0, 1.0);
    float win = 1.0 - x * x * (3.0 - 2.0 * x);
    float dwin = -6.0 * x * (1.0 - x) / (0.45 * E);
    h += S * f.x * win;
    g += S * (f.yz * win + f.x * dwin * p / max(r, 1e-4));
    lapu = S * (-K * K * f.x + lapf);
    lap = lapu * win;
    gu += S * f.yz;
    // No glints until the figure stands: silence only breathes.
    cw = win * back;
    // How much deeper or shallower than still water, in slopes: what the
    // eye reads through it even where the surface is nearly flat.
    thick = clamp(S * win * f.x * K, -1.0, 1.0);
  }

  vec3 nrm = normalize(vec3(-g, 1.0));
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), nrm);
  float slope = length(g);
  // How far the reflection swings across one pixel: a tight crest's glint is
  // widened and dimmed to match, so it never falls between pixels.
  float fw = 2.0 * abs(lap) / uRadius;
  // The studio, mirror-true about the vertical: a soft box straight up the
  // screen, a ring light round the dish, and the room, dimmer toward the
  // horizon, in every steep flank.
  float s2 = dot(R.xy, R.xy);
  float s = sqrt(s2);
  float room = s2 / (s2 + ROOMS * ROOMS);
  float sheen = smoothstep(0.16, 0.0, length((R.xy - vec2(0.0, 0.15)) * vec2(0.6, 1.0)));
  vec3 Ru = reflect(vec3(0.0, 0.0, -1.0), normalize(vec3(-gu, 1.0)));
  float su = length(Ru.xy);
  float fu = 2.0 * abs(lapu) / uRadius;
  float key = smoothstep(KEYA + fu, KEYB, length((Ru.xy - vec2(0.0, 0.62)) * vec2(0.7, 1.5))) * (KEYA / (KEYA + fu)) * cw;
  float rw = RINGW + fu;
  float ring = smoothstep(rw, 0.0, abs(su - RINGS)) * smoothstep(-0.3, 0.3, Ru.y) * (RINGW / rw) * cw;
  // The soft box's reflection ends crisply, as a glossy surface shows it.
  float box = smoothstep(BOXR - 0.05 - fu, BOXR + 0.05 + fu, su) * cw;
  // Flanks turned down, away from the soft box, show the room.
  float under = smoothstep(0.06, 0.8, slope) * smoothstep(-0.1, 0.45, 0.2 - R.y);
  // Crests gather the light under the water like lenses; troughs hold shade.
  float cv = clamp(-lap * 0.025, -1.0, 1.0);
  // The soft light under the water, seen through it, so every crest bends it.
  vec2 q = p - g * 1.2;
  float glow = exp(-dot(q, q) * 2.6);

  // Sharp troughs are the creases where the heaped water folds.
  float crease = smoothstep(0.15, 1.0, lap * 0.012);

  vec3 col;
  if (uDark < 0.5) {
    float tone = 0.06 * glow + ROOML * room + BOXL * box + 0.1 * under + CREASEL * crease - THICKL * thick;
    col = mix(uPaper, uInk, clamp(tone, 0.0, 1.0));
    float hi = 0.85 * key + 0.35 * sheen + 0.3 * max(cv, 0.0) + RINGL * ring;
    col = mix(col, vec3(1.0), clamp(hi, 0.0, 1.0));
  } else {
    // Dark water: little of its own colour, the light under it gathered by
    // the crests, and the studio in its gloss.
    float tone = 0.06 * glow + 0.015 + DUNDER * under + 0.05 * room + DLENS * max(cv, 0.0) + DTHICK * thick;
    col = mix(uPaper, uInk, clamp(tone, 0.0, 1.0) * 0.85);
    col *= 1.0 - 0.3 * crease;
    float hi = 0.75 * key + 0.22 * sheen + 0.35 * ring;
    col = mix(col, uInk * 0.92, clamp(hi, 0.0, 1.0) * 0.72);
  }

  // Dither colour and coverage, so long gradients never band. Colour gets a
  // triangular noise of one step. Coverage needs its own: a compositor that
  // rounds paper * (1 - alpha) to whole steps bands it every 1/paper steps
  // of alpha, so its noise is that wide, but never so wide that it shows
  // through the colour's own difference from the paper, and it thins out
  // where the water does, so nothing speckles.
  float n1 = hash12(frag) + hash12(frag + 17.31) - 1.0;
  float n2 = hash12(frag + 41.7) + hash12(frag + 73.9) - 1.0;
  vec3 dc = abs(col - uPaper);
  float wide = clamp(min(1.0 / max(max(uPaper.r, uPaper.g), uPaper.b), 1.0 / max(max(dc.r, dc.g), dc.b)), 1.0, 16.0);
  float a = clamp(alpha + n2 * wide / 255.0 * min(1.0, alpha * 32.0), 0.0, 1.0);
  gl_FragColor = vec4(clamp(col * a + n1 / 255.0 * min(1.0, a * 32.0), 0.0, a), a);
}
