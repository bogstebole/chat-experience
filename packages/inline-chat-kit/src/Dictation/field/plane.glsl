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

// Faraday waves: shaken water stands in plane waves. N of them, crossing at
// i * pi / N, reinforce where their crests meet and cancel where a crest meets
// a trough: two make squares, three hexagons, four and more the 8-, 10-, 12-
// fold quasi-crystals of the photographs. A circular wave of the same length,
// from the dish, crosses them too. The figure is that sum, nothing drawn.

const float PI = 3.14159265;

float T;
float STOKES; // how much sharper than its troughs each wave's crests are

// One word: the field, its gradient and its Laplacian, in one pass.
// x: n fold -> N = n - 1 standing waves (fold 2N); y: wavenumber; z: where the
// circular wave stands against the plane ones (a radial offset: keeps every mirror).
vec4 word(vec2 p, float rho, vec3 m) {
  float N = clamp(m.x - 1.0, 2.0, 7.0);
  // Many waves need more crests across the dish before their crossings
  // show a star rather than rings; few waves make wide cells.
  float k = m.y * (0.66 + 0.07 * N);
  float st = PI / N;
  vec2 rot = vec2(cos(st), sin(st));
  vec2 d = vec2(0.0, 1.0);
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 7; i++) {
    if (float(i) >= N) break;
    // A standing wave with Stokes's second harmonic: crests pointed, troughs flat.
    float x = k * dot(p, d);
    float cx = cos(x);
    float sx = sin(x);
    float c2x = 2.0 * cx * cx - 1.0;
    acc += vec4(cx + STOKES * c2x, -k * (sx + 4.0 * STOKES * sx * cx) * d, -k * k * (cx + 4.0 * STOKES * c2x));
    d = vec2(d.x * rot.x - d.y * rot.y, d.x * rot.y + d.y * rot.x);
  }
  acc *= inversesqrt(N);
  // At the very centre every crest meets every other; the water there cannot
  // climb N times as high, it spills, so the eye of the figure is held lower
  // and stays a small bead instead of a plateau.
  float ea = 0.25 * k * k;
  float eg = exp(-ea * rho * rho);
  float E = 1.0 - 0.45 * eg;
  vec2 gE = 0.9 * ea * eg * p;
  float lE = 1.8 * ea * eg * (1.0 - ea * rho * rho);
  acc = vec4(acc.x * E, acc.yz * E + acc.x * gE, acc.w * E + 2.0 * dot(gE, acc.yz) + acc.x * lE);
  // The circular wave: all plane waves at once, which is why it is round.
  // It thins out toward the centre, so the drop there stays a small bead.
  // Where it stands against them is the word's phase, and its length too:
  // two words of one fold that differ by a letter still meet differently.
  float ph = k * rho - m.z - 2.3 * m.y;
  float kp = k * rho;
  float a = kp / (2.0 + kp);
  float da = 2.0 * k / ((2.0 + kp) * (2.0 + kp));
  float b = inversesqrt(1.0 + 0.35 * kp);
  float db = -0.175 * k * b * b * b;
  float D = 0.6 * a * b;
  float dD = 0.6 * (da * b + a * db);
  float c = cos(ph) * D;
  vec2 gc = (-k * sin(ph) * D + cos(ph) * dD) * p / rho;
  return vec4(acc.x + c, acc.yz + gc, acc.w - k * k * c);
}

float hash12(vec2 q) {
  vec3 p3 = fract(vec3(q.xyx) * 0.1031);
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
  float rev = 1.0 - smoothstep(0.3, 1.0, dm / max(uOpen * reach, 1.0));
  rev *= smoothstep(0.0, 0.6, uOpen);
  float alpha = (1.0 - smoothstep(0.35, 1.25, r)) * rev;
  if (alpha < 0.002) { gl_FragColor = vec4(0.0); return; }

  // Still water: a shallow lens.
  float dome = 0.05 * exp(-r * r * 3.0);
  vec2 g = p * (-6.0 * dome);
  float h = dome;
  float lap = dome * (36.0 * r * r - 12.0);
  float lv = clamp(uLevel, 0.0, 1.0);
  float drive = 0.0;

  if (uLive > 0.0) {
    T = mod(uTime, 628.3185);
    drive = pow(lv, 0.45);
    STOKES = 0.06 + 0.15 * drive;
    float rho = sqrt(r * r + 0.004);
    // A new word's waves spread out from the centre; old and new are weighed
    // by cos and sin, so the energy of the water stays the same throughout.
    float t = clamp((uMix - 0.45 * rho) / 0.42, 0.0, 1.0);
    float mm = t * t * (3.0 - 2.0 * t);
    float dmdr = -6.0 * t * (1.0 - t) * 0.45 / 0.42;
    float wa = cos(mm * PI * 0.5);
    float wb = sin(mm * PI * 0.5);
    vec4 B = word(p, rho, uB);
    vec4 F = B * wb;
    if (wa > 0.0) {
      vec4 A = word(p, rho, uA);
      F += A * wa;
      F.yz += (A.x * -wb + B.x * wa) * PI * 0.5 * dmdr * p / rho;
      // Two words of one fold and nearly one length are nearly one wave:
      // their sum would swell, so it is weighed down by how alike they are.
      // Two unlike words half-cancel through the crests' sharpening instead,
      // so they are lifted a little. Either way the water keeps its energy.
      float sim = (1.0 - step(0.5, abs(uA.x - uB.x))) * exp(-pow((uA.y - uB.y) * 0.32, 2.0));
      float S = sin(mm * PI);
      float lift = 0.08 * (1.0 - sim);
      float iv = inversesqrt(1.0 + sim * S);
      float q = (1.0 + lift * S) * iv;
      float dq = PI * cos(mm * PI) * (lift * iv - 0.5 * sim * (1.0 + lift * S) * iv * iv * iv) * dmdr;
      F.yz = F.yz * q + F.x * dq * p / rho;
      F.xw *= q;
    }
    // Above the threshold the plane waves grow out of still water. Slopes,
    // not heights, are what the eye reads, so a long wave stands as tall.
    float kr = mix(uA.y * (0.59 + 0.07 * uA.x), uB.y * (0.59 + 0.07 * uB.x), mm);
    // White on white shows relief only by its shading, so the light theme
    // holds a quiet voice a little taller.
    float amp = uLive * smoothstep(0.0, 0.1, lv) * (0.004 + 0.01 * drive) / kr
              * mix(25.0 * (1.0 + 0.3 * (1.0 - drive)), 21.0, uDark);
    float ext = 0.42 + 0.26 * drive;
    float env = exp(-r * r / (ext * ext));
    vec2 genv = env * (-2.0 / (ext * ext)) * p;
    // Crests sharper than troughs, as real Faraday waves are.
    // Soft-limited first, so the centre, where every crest meets, stays a bump.
    float s = 0.6 + 0.9 * drive;
    float c2 = 1.0 / (1.7 * 1.7);
    float w2 = 1.0 + F.x * F.x * c2;
    float u = F.x * inversesqrt(w2);
    float u1 = pow(w2, -1.5);
    float u2 = -3.0 * F.x * c2 * pow(w2, -2.5);
    float e = exp(s * u);
    float gF = (e - 1.0) / s;
    float g1 = e * u1;
    float g2 = s * e * u1 * u1 + e * u2;
    h += amp * env * gF;
    g += amp * (genv * gF + env * g1 * F.yz);
    lap += amp * env * (g2 * dot(F.yz, F.yz) + g1 * F.w);

    // A slow ring leaving the drop at the centre, crossing the standing
    // waves; alone in silence, it is the only sign the water is listening.
    float ph = kr * rho - T * 1.3;
    float rip = uLive * (mix(0.003, 0.0017, uDark) + 0.002 * drive) * exp(-r * r * 2.5);
    h += rip * cos(ph);
    g += rip * (-kr * sin(ph) - 5.0 * r * cos(ph)) * p / rho;
    lap += -kr * kr * rip * cos(ph);
  }

  vec3 nrm = normalize(vec3(-g, 1.0));
  float slope = length(g);
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), nrm);
  float rl = length(R.xy);

  // The soft light under the water, seen through it: every crest bends it.
  vec2 qq = p - g * 1.2;
  float glow = exp(-dot(qq, qq) * 3.2);
  // How far the reflection swings across one pixel: on a tight crest a thin
  // glint would fall between pixels, so it is widened and dimmed to match.
  float fw = 2.5 * abs(lap) / uRadius;
  float gloss = smoothstep(0.0, 0.25, drive);
  // A ring light all around: glints wherever a flank tilts just so.
  float rw = 0.07 + fw;
  float ring = smoothstep(rw, 0.0, abs(rl - 0.4)) * smoothstep(-0.2, 0.4, R.y) * (0.07 / rw) * gloss;
  // A soft key high above the top of the figure, on the vertical through its
  // centre, so left and right flanks are lit alike.
  float key = smoothstep(0.2 + fw, 0.04, length((R.xy - vec2(0.0, 0.5)) * vec2(0.8, 1.4))) * (0.2 / (0.2 + fw));
  // Lensing: convex crests gather light into bright lines, troughs darken.
  float lens = clamp(-lap * 0.1, -1.0, 1.0);
  // The light straight overhead, a small bright image on every crest's top.
  float top = smoothstep(0.25 + fw, 0.03, rl) * smoothstep(0.0, 0.5, lens) * gloss;
  // A broad soft sheen straight up, so even the still swell shows a crescent of light.
  float sheen = smoothstep(0.16, 0.0, length((R.xy - vec2(0.0, 0.15)) * vec2(0.6, 1.0)));
  // Where the surface turns steeply away it reflects the room, not the light.
  float edge = smoothstep(0.03, 0.7, slope) * (0.6 + 0.4 * smoothstep(-0.1, 0.45, 0.2 - R.y));

  float ink = mix(1.0, 0.55, uDark);
  float tone = mix(0.12, 0.08, uDark) * glow + mix(0.012, 0.02, uDark);
  tone += mix(0.4, 0.2, uDark) * edge + mix(0.22, 0.1, uDark) * max(-lens, 0.0);
  vec3 col = mix(uPaper, uInk, clamp(tone, 0.0, 1.0) * ink);
  float hi = mix(0.5, 0.35, uDark) * key + mix(0.9, 0.7, uDark) * top + mix(0.5, 0.25, uDark) * sheen
           + mix(0.4, 0.3, uDark) * max(lens, 0.0) + mix(0.35, 0.25, uDark) * ring;
  col = mix(col, vec3(1.0), clamp(hi, 0.0, 1.0) * mix(0.97, 0.5, uDark));

  // Dither: colour a triangular step, coverage only where there is coverage.
  float n1 = hash12(frag) + hash12(frag + 17.13) - 1.0;
  float n2 = hash12(frag + 41.7) + hash12(frag + 5.31) - 1.0;
  float a = clamp(alpha + n2 / 255.0 * smoothstep(0.0, 0.03, alpha), 0.0, 1.0);
  gl_FragColor = vec4(clamp(col * a + n1 / 255.0, 0.0, a), a);
}
