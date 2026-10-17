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

// Liquid glass: a clear, thick lens of water rising from behind the composer.
// The voice shakes it into a flower of standing ripples; each crest is a lens
// that bends the soft light under it and catches a glossy highlight.

float T;      // wrapped time
float AMP;    // how hard the voice drives the water
float EXT;    // how far the figure reaches
float SHARP;  // how peaked the crests are: loud water is nonlinear

float mode(float r, float a, vec3 m) {
  float n = m.x;
  float k = m.y * 1.8;
  float star = step(0.5, n);
  float ang = a + m.z / max(n, 1.0);
  // Concentric ripples bent into an n-petalled flower, round at the centre
  // and more petalled outward; a second harmonic sharpens the petal tips.
  float c1 = cos(n * ang);
  float c2 = cos(2.0 * n * ang);
  float s = star * (0.07 + 0.05 * fract(m.z * 0.371)) * smoothstep(0.0, 0.45, r);
  // Neighbouring rings point their petals in turn, so the stars interlock
  // into a mandala instead of stacking like contour lines.
  float alt = cos(k * r * 0.5 + m.z);
  float rr = r * (1.0 - s * (c1 * alt + 0.3 * c2));
  // Peaked crests and flat troughs, like real water: thin glass ridges.
  float x = k * rr - T * 1.7;
  float crest = exp((cos(x) - 1.0) * SHARP);
  // The ridges swell on the petals and thin between them.
  float petals = 1.0 + 0.45 * star * c1 * smoothstep(0.05, 0.35, r);
  return crest * petals * inversesqrt(1.0 + 0.12 * k * r);
}

float height(vec2 p) {
  float r = length(p);
  float a = r > 1e-4 ? atan(p.y, p.x) : 0.0;
  // The still swell of water: a lens rising from behind the composer.
  float dome = 0.06 * exp(-r * r * 3.2);
  // A new word's shape ripples outward from the centre.
  float m = smoothstep(0.0, 1.0, (uMix * 1.7 - r) * 2.2);
  float w = mix(mode(r, a, uA), mode(r, a, uB), m);
  // A calm eye under the words; the ripples spread from the swell outward.
  // The figure belongs to the bottom: it thins out well before the water ends.
  float env = exp(-r * r / (EXT * EXT)) * smoothstep(0.03, 0.2, r) * (1.0 - smoothstep(0.45, 0.95, r));
  return dome + AMP * env * w;
}

float hash(vec2 f) {
  return fract(52.9829189 * fract(dot(f, vec2(0.06711056, 0.00583715))));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r = length(p);
  T = mod(uTime, 628.3185);
  float lv = clamp(uLevel, 0.0, 1.0);
  float drive = pow(lv, 0.6);
  AMP = uLive * (0.001 + 0.015 * drive);
  EXT = 0.42 + 0.33 * drive;
  SHARP = 0.9 + 1.9 * drive;

  // Opens out of the microphone as a soft growing blob, never a hard circle.
  float reach = length(uRes) * 2.0;
  float d = length(frag - uMic);
  float rev = 1.0 - smoothstep(0.3, 1.0, d / max(uOpen * reach, 1.0));
  rev *= smoothstep(0.0, 0.6, uOpen);
  // Melts into the paper by r = 1, with no slope at the end.
  float alpha = (1.0 - smoothstep(0.15, 1.0, r)) * rev;
  if (alpha < 0.002) { gl_FragColor = vec4(0.0); return; }

  float e = 1.5 / uRadius;
  float h0 = height(p);
  float hxp = height(p + vec2(e, 0.0));
  float hxm = height(p - vec2(e, 0.0));
  float hyp = height(p + vec2(0.0, e));
  float hym = height(p - vec2(0.0, e));
  vec2 g = vec2(hxp - hxm, hyp - hym) / (2.0 * e);
  float lap = (hxp + hxm + hyp + hym - 4.0 * h0) / (e * e);
  vec3 nrm = normalize(vec3(-g, 1.0));
  float slope = length(g);
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), nrm);
  float rl = length(R.xy);

  // The gentle light under the water — a circular gradient at the bottom —
  // seen through the water, so every crest bends it, a little apart per
  // colour, as glass does.
  vec2 q = p - g * 1.2;
  vec2 qd = g * 0.22;
  vec3 glow = vec3(exp(-dot(q - qd, q - qd) * 3.2), exp(-dot(q, q) * 3.2), exp(-dot(q + qd, q + qd) * 3.2));

  // A ring light all around: thin glints wherever a flank tilts just so.
  // How far the reflection swings across one pixel: on a tight crest a thin
  // glint would fall between pixels, so it is widened and dimmed to match.
  float fw = 2.5 * abs(lap) / uRadius;
  float rw = 0.07 + fw;
  // Split a little per colour, so the glints carry a prism's faint fringe.
  vec3 ring = vec3(smoothstep(rw, 0.0, abs(rl - 0.394)), smoothstep(rw, 0.0, abs(rl - 0.4)), smoothstep(rw, 0.0, abs(rl - 0.406)));
  ring *= smoothstep(-0.2, 0.4, R.y) * (0.07 / rw);
  // A key light from above: glossy highlights on the upper flanks.
  float key = smoothstep(0.18 + fw, 0.04, length((R.xy - vec2(0.0, 0.62)) * vec2(0.7, 1.5))) * (0.18 / (0.18 + fw));
  // A broad soft sheen straight up, so even the still swell shows a crescent of light.
  float sheen = smoothstep(0.16, 0.0, length((R.xy - vec2(0.0, 0.15)) * vec2(0.6, 1.0)));
  // Lensing: convex crests gather light into bright lines, troughs darken.
  float lens = clamp(-lap * 0.03, -1.0, 1.0);
  // Glass edges: where the surface turns away it reflects the room, not the light.
  float edge = smoothstep(0.06, 0.8, slope) * smoothstep(-0.1, 0.45, 0.2 - R.y);

  float ink = mix(1.0, 0.8, uDark);
  vec3 tone = mix(0.12, 0.09, uDark) * glow + mix(0.012, 0.03, uDark);
  tone += vec3(mix(0.5, 0.32, uDark) * edge + 0.1 * max(-lens, 0.0));
  vec3 col = mix(uPaper, uInk, clamp(tone, 0.0, 1.0) * ink);
  vec3 hi = vec3(0.95 * key + mix(0.55, 0.3, uDark) * sheen + mix(0.4, 0.5, uDark) * max(lens, 0.0)) + 0.8 * ring;
  col = mix(col, vec3(1.0), clamp(hi, 0.0, 1.0) * mix(0.97, 0.82, uDark));

  col += (hash(frag) - 0.5) / 255.0;
  gl_FragColor = vec4(col * alpha, alpha);
}
