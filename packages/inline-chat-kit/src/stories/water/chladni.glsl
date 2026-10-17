precision highp float;
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
uniform vec3 uInk;
uniform vec3 uMarker;
uniform float uDark;

const float PI = 3.14159265;
const float LIFT = 0.25;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// A square plate's standing wave, the formula behind the photographs:
// cos(a x) cos(b y) -/+ cos(b x) cos(a y), plus a ring from the centre where
// the plate is driven. Every term is even in x, so each figure is mirrored
// about the composer's middle. The word picks (a, b), the mix of the two
// families, and how far the plate's centre sits above the composer.
// Returns the height and its gradient, analytically, in p units.
vec3 mode(vec2 p, vec3 m, float drift) {
  float n = m.x;
  float k = m.y;
  float z = m.z;
  float r = length(p);
  vec2 rh = p / max(r, 1e-4);
  float ph = k * r - drift;
  if (n < 0.5) return vec3(cos(ph - z), -k * sin(ph - z) * rh);
  float a = floor(k * 0.26);
  float b = a + 1.0 + mod(n, 4.0);
  float cz = cos(z);
  float s = sign(cz + 1e-3) * (0.6 + 0.4 * abs(cz));
  float lambda = 0.25 + 0.35 * (0.5 + 0.5 * sin(z * 1.7));
  const float F = PI * 0.9;
  vec2 q = vec2(p.x, p.y - LIFT * fract(k)) * F;
  float cax = cos(a * q.x), sax = sin(a * q.x);
  float cbx = cos(b * q.x), sbx = sin(b * q.x);
  float cay = cos(a * q.y + drift), say = sin(a * q.y + drift);
  float cby = cos(b * q.y + drift), sby = sin(b * q.y + drift);
  float f = cax * cby + s * cbx * cay + lambda * cos(ph);
  vec2 g = F * vec2(-a * sax * cby - s * b * sbx * cay, -b * cax * sby - s * a * cbx * say);
  g -= lambda * k * sin(ph) * rh;
  return vec3(f, g);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r = length(p);
  float t = mod(uTime, 628.3185);

  // The glow rises out of the microphone and settles behind the composer.
  float o = smoothstep(0.0, 1.0, uOpen);
  vec2 c = mix(uMic, uCenter, o);
  float re = length(frag - c) / (uRadius * mix(0.18, 1.0, o));
  float env = exp(-2.4 * re * re) * (1.0 - smoothstep(0.5, 1.0, re));

  float live = uLive;
  float L = clamp(uLevel, 0.0, 1.0);
  float drift = live * 0.3 * sin(t * 0.55);

  // The nodal lines, measured in pixels: |f| / |grad f|.
  vec3 fg = mix(mode(p, uA, drift), mode(p, uB, drift), uMix);
  float d = abs(fg.x) / max(length(fg.yz), 1e-3) * uRadius;

  float sc = clamp(uRadius / 800.0, 0.5, 1.5);
  float conc = live * (0.08 + 0.92 * pow(L, 0.75)); // how gathered the sand is
  float morph = 4.0 * uMix * (1.0 - uMix);         // 1 halfway between words
  float wc = mix(5.0, 1.9, conc) * (1.0 + 0.8 * morph) * sc;
  float core = exp(-(d * d) / (wc * wc));
  float scatter = exp(-d / (wc * 3.0));
  float halo = exp(-d / (6.0 * sc));
  float bloom = exp(-d / (22.0 * sc));

  // Louder reaches further from the composer; the words sit in a calm pool,
  // wider than it is tall, as the composer is.
  float reach = 0.1 + 0.75 * L;
  float pool = smoothstep(0.08, 0.3, length(p * vec2(0.45, 1.0)));
  float lineEnv = (1.0 - smoothstep(reach, reach + 0.3, r)) * mix(0.18, 1.0, pool);

  // Sand: settled grains on the line are still; the loose ones around it
  // are thrown about, more of them the louder the voice.
  vec2 cell = floor(frag);
  float h = hash12(cell);
  float hb = hash12(cell + vec2(floor(t * 24.0) * 7.13, 3.7));
  float hs = mix(h, hb, step(hash12(cell + 91.7), 0.7 * conc));
  float settled = smoothstep(h, h + 0.15, core * (0.6 + 0.4 * conc));
  float loose = smoothstep(hs, hs + 0.15, scatter * mix(0.22, 0.06, conc) * (1.0 + 1.5 * morph));
  float grain = max(settled, loose);

  float strength = conc * lineEnv * (1.0 - 0.45 * morph) * env * o * mix(1.0, 0.3, smoothstep(0.3, 0.95, r));
  float lineA = (grain * mix(0.72, 0.95, uDark) + (halo * mix(0.12, 0.22, uDark) + bloom * mix(0.035, 0.1, uDark)) * (0.4 + 0.6 * L)) * strength;

  // Still water: a soft gradient with the sand lying scattered in it.
  float still = step(h, 0.05) * mix(0.07, 0.22, uDark) * (1.0 - conc);
  float bodyA = env * sqrt(o) * (mix(0.1, 0.15, uDark) + 0.06 * live * L + still);

  vec3 lineC = mix(uInk, mix(uInk, uMarker, 0.3 * L), uDark * (1.0 - core));
  float A = bodyA;
  vec3 C = uInk * bodyA;
  float la = clamp(lineA, 0.0, 1.0);
  C = lineC * la + C * (1.0 - la);
  A = la + A * (1.0 - la);

  float n1 = hash12(frag + 17.3) - 0.5;
  float n2 = hash12(frag.yx + 41.9) - 0.5;
  A = clamp(A + n1 / 255.0, 0.0, 1.0);
  C = clamp(C + n2 / 255.0, 0.0, 1.0);
  C = min(C, vec3(A));
  gl_FragColor = vec4(C, A);
}
