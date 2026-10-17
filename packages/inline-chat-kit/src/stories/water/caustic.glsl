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
const float TAU = 6.28318531;

float sinc(float x) {
  return abs(x) < 1e-3 ? 1.0 - x * x / 6.0 : sin(x) / x;
}

float hash(vec2 q) {
  return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453);
}

// A mode's surface as its curvature: (h, Hxx, Hyy, Hxy), normalised by k^2.
// n circular waves from sources on a ring outside the field, meeting in the
// middle, plus a radial standing wave from the transducer.
vec4 mode(vec2 p, vec3 m, float t, float live, float kScale) {
  float n = m.x;
  float K = m.y * kScale;
  float r = length(p);
  // Two words the engine maps close together still differ.
  float v1 = fract(m.y * 0.618034 + m.z * 0.15915494);
  float v2 = fract(m.y * 0.381966 + m.z * 0.37);
  float kr = K * r;
  float c = cos(kr);
  float sn = sinc(kr);
  vec2 u = p / max(r, 1e-4);
  vec3 uu = vec3(u.x * u.x, u.y * u.y, u.x * u.y);
  vec4 ring = vec4(c, -sn + (sn - c) * uu.x, -sn + (sn - c) * uu.y, (sn - c) * uu.z);
  if (n < 0.5) return ring;
  float R0 = 1.35 + 1.1 * v1;
  // The common phase turns slowly while live: the figure breathes but keeps its mirrors.
  float ph = (mod(n, 2.0) > 0.5 ? -0.25 * PI : 0.0) + 0.6 * sin(v2 * TAU) + live * 0.7 * sin(t * 0.7);
  // Always a mirror up the middle: the field rises from the composer, and a
  // figure leaning to one side reads as a maze. The word picks which of the
  // two upright orientations.
  float rot = 0.5 * PI + (PI / n) * step(0.5, v2);
  vec4 acc = vec4(0.0);
  for (int j = 0; j < 8; j++) {
    if (float(j) >= n) break;
    float a = rot + float(j) * TAU / n;
    vec2 q = p - R0 * vec2(cos(a), sin(a));
    float rho = max(length(q), 1e-3);
    vec2 e = q / rho;
    float drift = live * 0.08 * sin(t * 0.9 + float(j) * 2.39);
    float arg = K * (rho - R0) + ph + drift;
    float cs = cos(arg);
    float sw = sin(arg) / (K * rho);
    acc.x += cs;
    acc.y -= cs * e.x * e.x + sw * (1.0 - e.x * e.x);
    acc.z -= cs * e.y * e.y + sw * (1.0 - e.y * e.y);
    acc.w -= (cs - sw) * e.x * e.y;
  }
  acc *= 2.0 / n;
  return mix(acc, ring, 0.12 + 0.3 * v2);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r = length(p);
  float t = mod(uTime, 628.3185);

  float r2 = min(r * r, 1.0);
  float body = pow(1.0 - r2, 2.5);

  float reach = length(uRes) * 1.15;
  float x = length(frag - uMic) / reach;
  float reveal = 1.0 - smoothstep(uOpen * 1.6 - 0.6, uOpen * 1.6, x);
  float presence = body * reveal;
  // Nothing beyond the field, so nothing out there can blow up either.
  if (presence <= 0.0) { gl_FragColor = vec4(0.0); return; }

  // How hard the water focuses: always a web once live, denser when loud.
  float drive = smoothstep(0.0, 0.5, uLive) * (2.2 + 4.0 * uLevel);
  float breathe = 1.0 + 0.1 * uLive * sin(t * 6.0);
  float s = drive * breathe * sqrt(1.0 - r2);

  float kScale = 1.6 * sqrt(uRadius / 315.0);
  // Still water has no curvature: no waves are evaluated until it is live.
  vec4 H = vec4(0.0);
  if (uLive < 0.001) {}
  else if (uMix < 0.001) H = mode(p, uA, t, uLive, kScale);
  else if (uMix > 0.999) H = mode(p, uB, t, uLive, kScale);
  else {
    // The new word spreads out of the transducer as a front; across the
    // front both figures are kept at full strength, so it stays in focus.
    float w = smoothstep(0.0, 1.0, (uMix * 1.5 - r) / 0.5);
    H = mix(mode(p, uA, t, uLive, kScale), mode(p, uB, t, uLive, kScale), w);
    H *= inversesqrt(w * w + (1.0 - w) * (1.0 - w));
  }
  float det = (1.0 + s * H.y) * (1.0 + s * H.z) - s * s * H.w * H.w;
  // Irradiance on the floor, relative to still water. Softer while the
  // water is barely focusing, so a quiet voice is a soft swell, not blobs.
  float eps = 0.045 + 0.12 / (1.0 + s);
  // Filaments get thinner per pixel with focus and frequency, and with a
  // smaller field; saturating the light sooner there keeps them a pixel or
  // so wide instead of breaking into dashes.
  float perPx = s * mix(uA.y, uB.y, uMix) * kScale / uRadius;
  float sat = 0.45 * max(1.0, perPx / 0.3);
  float I = inversesqrt(det * det + eps * eps);
  float v = 1.0 - exp(-sat * I);
  float v0 = 1.0 - exp(-sat);
  float lit = v > v0 ? (v - v0) / (1.0 - v0) : (v - v0) / v0;
  // How much of that light shows: the voice. Silence is a whisper of it.
  float gain = uLive * (0.12 + 0.88 * pow(uLevel, 0.75));
  // Calmer right behind the words and the composer.
  float calm = mix(0.5, 1.0, smoothstep(0.06, 0.32, r));
  lit *= gain * (lit > 0.0 ? calm : mix(0.7, 1.0, calm));

  float amt;
  if (uDark > 0.5) {
    amt = 0.07 + 0.06 * lit + 0.6 * max(lit, 0.0) * max(lit, 0.0);
  } else {
    amt = 0.11 - 0.11 * max(lit, 0.0) - 0.09 * min(lit, 0.0);
  }
  vec3 col = mix(uPaper, uInk, max(amt, 0.0));
  // The one note of the marker: the brightest light near the transducer,
  // and only in the dark, where it reads as light rather than as a stain.
  float hot = max(lit, 0.0);
  col += uMarker * exp(-r2 * 9.0) * hot * hot * uDark * 0.16;
  float alpha = presence * 0.94;

  float n1 = hash(frag) - 0.5;
  float n2 = hash(frag + 17.3) - 0.5;
  vec3 rgb = col * alpha + n1 / 255.0;
  alpha = clamp(alpha + n2 / 255.0, 0.0, 1.0);
  rgb = clamp(rgb, 0.0, alpha);
  gl_FragColor = vec4(rgb, alpha);
}
