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

// A ring of point sources. n drops on a ring and one at the centre, all at
// the same frequency, each sending out circular waves. Where they cross, the
// crests add or cancel. The water heaps where they add and creases where they
// cancel — that still figure is the word — and the ripples themselves keep
// travelling through it, outward from every source.

const float TAU = 6.2831853;
const float W = 2.1;  // rad/s, shared by every source, so the figure stands still

vec4 U;   // the field, complex: Re, Im, and the same times k^2 (for curvature)
vec4 G;   // its gradient: d Re / dp in xy, d Im / dp in zw

void src(vec2 p, vec2 s, float K, float psi, float amp, float dec) {
  vec2 v = p - s;
  float d = sqrt(dot(v, v) + 0.0016);
  vec2 dd = v / d;
  float q = 1.0 / (1.0 + dec * d * d);
  float A = amp * q;
  float dA = -2.0 * dec * d * q * A;
  float ph = K * d + psi;
  float c = cos(ph);
  float sn = sin(ph);
  U += vec4(A * c, A * sn, K * K * A * c, K * K * A * sn);
  G.xy += (dA * c - A * K * sn) * dd;
  G.zw += (dA * sn + A * K * c) * dd;
}

// One word: n sources on a ring, the first straight above the centre so the
// figure stands upright and mirrored, and one at the centre. The word's
// phase sets the ring's size and the centre's phase — never a rotation.
void word(vec2 p, vec3 m, float share, float ringAmp, float centreAmp) {
  float n = m.x;
  float K = m.y * 0.95;
  float h = fract(m.z * 3.183 + m.y * 0.618);
  float R0 = 0.5 + 0.24 * h;
  float psiC = m.z * 2.0 + m.y * 0.5;
  float dec = 1.6;
  float amp = ringAmp * share * inversesqrt(max(n, 1.0)) * 1.5;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= n) break;
    float a = 1.5707963 + TAU * float(i) / n;
    src(p, R0 * vec2(cos(a), sin(a)), K, 0.0, amp, dec);
  }
  src(p, vec2(0.0), K, psiC, centreAmp * share, dec);
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

  // Opens out of the microphone as a soft growing blob, never a hard circle,
  // and is wholly open — the same on both sides — once uOpen reaches 1.
  float span = length(uMic - uCenter) + 1.25 * uRadius;
  float front = uOpen * 2.0 * span;
  float rev = 1.0 - smoothstep(front - 0.8 * span, front, length(frag - uMic));
  rev *= smoothstep(0.0, 0.6, uOpen);
  float alpha = (1.0 - smoothstep(0.35, 1.25, r)) * rev;
  if (alpha < 0.002) { gl_FragColor = vec4(0.0); return; }

  float ph = mod(uTime, TAU / W) * W;
  float lv = clamp(uLevel, 0.0, 1.0);
  float drive = pow(max(lv, 1e-6), 0.6);

  // The waves. Ring sources only while somebody speaks; the centre keeps a
  // faint slow pulse while listening, so silence is not the same as waiting.
  U = vec4(0.0);
  G = vec4(0.0);
  // Gated near silence, so a fading voice leaves no ghost of its word.
  float ringAmp = drive * smoothstep(0.0, 0.08, lv);
  float centreAmp = 0.5 + 0.35 * drive;
  float mB = sin(1.5707963 * uMix);
  float mA = cos(1.5707963 * uMix);
  if (mA > 0.001) word(p, uA, mA, ringAmp, centreAmp);
  word(p, uB, mB, ringAmp, centreAmp);

  // The still figure: how far the water swings at each point, |U|. Softened
  // at the nodes, where the waves cancel, into a crease instead of a cusp;
  // a loud voice folds it sharper. Its curvature comes from the wave
  // equation: every wave here has lap = -k^2 wave.
  float cr = mix(0.16, 0.05, drive);
  float f = sqrt(dot(U.xy, U.xy) + cr * cr);
  vec2 gf = (U.x * G.xy + U.y * G.zw) / f;
  float lf = (dot(G.xy, G.xy) + dot(G.zw, G.zw) - dot(U.xy, U.zw) - dot(gf, gf)) / f;

  // The ripples, travelling outward through the figure: the field turned by
  // the clock. They vanish on the creases, where nothing moves.
  float c = cos(ph);
  float s = sin(ph);
  float hw = U.x * c + U.y * s;
  vec2 gw = G.xy * c + G.zw * s;
  float lw = -(U.z * c + U.w * s);

  float aF = 1.0;
  float aW = 0.55;
  float S = aF * (f - cr) + aW * hw;
  vec2 gS = aF * gf + aW * gw;
  float lS = aF * lf + aW * lw;

  // The figure melts out by r = 1.02 at most, with no slope at its end.
  // A loud voice spreads it further.
  float RE = 0.8 + 0.22 * drive;
  float RE2 = RE * RE;
  float t = max(1.0 - r2 / RE2, 0.0);
  float env = t * t;
  vec2 genv = -4.0 * t / RE2 * p;
  float lenv = 8.0 * r2 / (RE2 * RE2) - 8.0 * t / RE2;

  // Quiet water barely lifts; a loud voice heaps it.
  float amp = uLive * 0.036 * (0.55 + 0.45 * drive);
  // How deep the water stands: thick where the crests pile up.
  float thick = uLive * env * clamp(S * 0.5, 0.0, 1.0);
  vec2 g = amp * (env * gS + S * genv);
  float lap = amp * (env * lS + 2.0 * dot(genv, gS) + S * lenv);

  // The still swell of water.
  float dome = 0.05 * exp(-r2 * 3.0);
  g += -6.0 * p * dome;
  lap += dome * (36.0 * r2 - 12.0);

  vec3 nrm = normalize(vec3(-g, 1.0));
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), nrm);
  // How far the reflection swings across one pixel: a highlight on a tight
  // crest would fall between pixels, so it is widened and dimmed to match.
  float fw = 2.5 * abs(lap) / uRadius;

  // Lit like a dish of milk under a wide soft light: tops face it and are
  // bright, flanks turn away and show the room, creases hold a little shadow.
  // A key light at the top of the screen and a ring of light all round give
  // the gloss; nothing comes from a side, so neither flank of a mirrored
  // figure is brighter.
  float rl = length(R.xy);
  float key = smoothstep(0.18 + fw, 0.02, length((R.xy - vec2(0.0, 0.5)) * vec2(0.7, 1.4))) * (0.18 / (0.18 + fw));
  float rw = 0.06 + fw;
  float ring = smoothstep(rw, 0.0, abs(rl - 0.42)) * smoothstep(-0.3, 0.3, R.y) * (0.06 / rw);
  float top = smoothstep(0.22, 0.0, rl) * smoothstep(0.0, 0.6, -lap * 0.01);
  vec3 L = normalize(vec3(0.0, 0.5, 0.866));
  float rel = dot(nrm, L) - L.z;
  float crease = clamp(lap * 0.012, 0.0, 1.0);
  float lens = clamp(-lap * 0.012, 0.0, 1.0);
  float room = smoothstep(0.04, 0.7, rl);

  // The gentle light under the water, seen through it, so every crest bends it.
  vec2 q = p - g * 1.2;
  float glow = exp(-dot(q, q) * 3.2);

  vec3 col;
  if (uDark < 0.5) {
    // Milk-white water a shade below the paper; deep water scatters the
    // light back and is whiter, the flanks turn to the room and grey.
    vec3 body = mix(uPaper, uInk, 0.035 + 0.05 * glow);
    float shade = room * 0.18 + crease * 0.26 + max(-rel, 0.0) * 0.36;
    col = mix(body, uInk, clamp(shade, 0.0, 0.3));
    float lit = key * 0.9 + ring * 0.5 + top * 0.4 + lens * 0.3 + max(rel, 0.0) * 0.5 + thick * 0.3;
    col = mix(col, vec3(1.0), clamp(lit, 0.0, 1.0));
  } else {
    // Black water: the flat shows the dark above it, deep water glows a
    // little from inside, and every slope catches the dim room.
    vec3 body = mix(uPaper, uInk, 0.03 + 0.05 * glow + 0.09 * thick);
    col = body * (1.0 - crease * 0.15);
    float lit = room * 0.08 + key * 0.55 + ring * 0.4 + top * 0.14 + lens * 0.12 + max(rel, 0.0) * 0.12;
    col = mix(col, uInk * 0.88, clamp(lit, 0.0, 1.0));
  }

  float n1 = hash12(frag) + hash12(frag + 17.31) - 1.0;
  gl_FragColor = vec4(clamp(col * alpha + n1 / 255.0, 0.0, alpha), alpha);
}
