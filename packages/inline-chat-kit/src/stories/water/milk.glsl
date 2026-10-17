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
uniform vec3 uPaper;
uniform vec3 uInk;
uniform float uDark;

float T;      // wrapped time
float DRIVE;  // how hard the dish is shaken
float REACH;  // how far the figure swells out of the origin
float CREASE; // softness of the creases: a loud voice folds them sharp
float N;      // the word's fold, rings across, and turn, part-way morphed
float K;
float PH;
float MIX;    // the radial morph weight, shared with heap()

// One word's figure, as heaped milk: rings bent into an n-pointed star,
// pointed at the tips and with a petal swelling toward each. Milk heaps up
// between the nodal lines and creases along them, so the height is |wave|,
// softened. Angle is measured from straight up, so the figure sits balanced
// over the composer and the seam a half-way fold makes points down.
float heap(vec2 p, float r, float a, float n, float k, float ph) {
  float fold = smoothstep(0.0, 1.0, n);
  float w = smoothstep(0.06, 0.32, r) * fold;
  // Each word's points from its own whole fold, then blended: interpolating
  // the fold itself tears the figure where the angle wraps, straight down.
  float tipA = 0.5 + 0.5 * cos(uA.x * a + uA.z);
  float tipB = 0.5 + 0.5 * cos(uB.x * a + uB.z);
  float tip = mix(tipA * tipA * tipA, tipB * tipB * tipB, MIX);
  // The star's reach saturates outward, smoothly, so the rings nest.
  float rho = r - 0.2 * (1.0 - exp(-r / 0.45)) * tip * w;
  float wave = cos(k * rho - T * 2.0) + 0.55 * w * (2.0 * tip - 0.4);
  // Calm in the eye of the figure, a wide oval where the words are.
  // A small calm eye: the words sit below the figure now, not inside it.
  float calm = smoothstep(0.03, 0.14, r);
  // Creases soften toward the eye and outward, so the rings rise out of the
  // calm and melt away again instead of ending in lines.
  float hp = sqrt(wave * wave + CREASE + 0.22 * r * r + 0.3 * (1.0 - calm));
  float env = exp(-rho * rho / (REACH * REACH) * 1.6);
  hp = mix(0.75, hp, calm);
  return (hp - 0.6) * env;
}

// `a` is passed in: atan once per pixel, its neighbours by its derivative.
float height(vec2 p, float a) {
  float r = length(p);
  float h = heap(p, r, a, N, K, PH) * DRIVE;
  // The still pool's gentle dome.
  h += 0.03 * exp(-r * r * 2.5);
  return h;
}

// Hoskins' hash12: arithmetic, so it holds up on mobile GPUs where a
// sin-of-coordinates hash collapses into visible structure.
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r = length(p);

  // Opens out of the microphone, with a wide soft front.
  float span = uRadius + length(uMic - uCenter);
  float front = uOpen * 1.6 * span;
  float revealed = 1.0 - smoothstep(front - 0.6 * span, front, length(frag - uMic));
  float fade = 1.0 - smoothstep(0.0, 1.0, r);
  float alpha = revealed * fade;
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }

  T = mod(uTime, 628.3185);
  // Loudness, eased so a quiet voice still shows and a loud one still adds.
  float lv = pow(clamp(uLevel, 0.0, 1.0), 0.65);
  // No flicker on top of the voice: the figure swells with it and holds.
  DRIVE = uLive * (0.12 + 0.88 * lv) * 0.055;
  REACH = 0.42 + 0.48 * lv;
  CREASE = mix(0.07, 0.015, lv);

  // A new word bends the whole figure at once, the centre a little ahead,
  // so the shape flows into the next rather than cross-fading.
  float m = clamp(uMix * 1.3 - 0.3 * r, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  MIX = m;
  N = mix(uA.x, uB.x, m);
  K = mix(uA.y, uB.y, m) * 1.3;
  PH = mix(uA.z, uB.z, m);

  float e = 1.5 / uRadius;
  float a = atan(p.x, p.y + 1e-6);
  vec2 da = vec2(p.y, -p.x) / max(r * r, 1e-6) * e;
  float h0 = height(p, a);
  float hx1 = height(p + vec2(e, 0.0), a + da.x);
  float hx0 = height(p - vec2(e, 0.0), a - da.x);
  float hy1 = height(p + vec2(0.0, e), a + da.y);
  float hy0 = height(p - vec2(0.0, e), a - da.y);
  vec2 g = vec2(hx1 - hx0, hy1 - hy0) / (2.0 * e);
  float lap = (hx1 + hx0 + hy1 + hy0 - 4.0 * h0) / (e * e);

  vec3 nrm = normalize(vec3(-g, 1.0));
  vec3 L = normalize(vec3(0.0, 0.7, 0.7));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = dot(nrm, L) - L.z;
  float nh = max(dot(nrm, H), 0.0);
  float spec = pow(nh, 50.0);
  float gloss = pow(nh, 10.0) - pow(H.z, 10.0);
  float crest = smoothstep(0.0, 1.0, -lap * 0.02);
  float cavity = smoothstep(0.0, 1.0, lap * 0.02);

  float pool = fade;
  vec3 col;
  if (uDark < 0.5) {
    vec3 base = mix(uPaper, uInk, 0.1 * pool);
    float shadow = clamp(-diff * 1.5 + cavity * 0.7, 0.0, 1.0);
    col = mix(base, uInk, shadow * 0.4);
    col = mix(col, vec3(1.0), clamp(spec + crest * 0.35 + max(gloss, 0.0) * 1.6, 0.0, 1.0));
  } else {
    vec3 base = mix(uPaper, uInk, 0.07 * pool);
    float shadow = clamp(-diff * 1.5 + cavity * 0.6, 0.0, 1.0);
    col = base * (1.0 - shadow * 0.85);
    col = mix(col, uInk * 0.9, clamp(spec * 0.85 + crest * 0.1 + max(gloss, 0.0) * 0.3, 0.0, 1.0));
  }

  // Dither, so the long gradients do not band on 8-bit screens. Colour gets
  // a triangular noise of one step. Coverage needs its own: a compositor
  // that rounds paper * (1 - alpha) to whole steps bands it every 1/paper
  // steps of alpha, so its noise is that wide, but never so wide that it
  // shows through the colour's own difference from the paper.
  float n1 = hash(frag) + hash(frag + vec2(0.37, 0.71)) - 1.0;
  float n2 = hash(frag + vec2(0.53, 0.29)) + hash(frag + vec2(0.11, 0.83)) - 1.0;
  vec3 dc = abs(col - uPaper);
  float wide = clamp(min(1.0 / max(max(uPaper.r, uPaper.g), uPaper.b), 1.0 / max(max(dc.r, dc.g), dc.b)), 1.0, 16.0);
  alpha = clamp(alpha + n2 * wide / 255.0, 0.0, 1.0);
  gl_FragColor = vec4(clamp(col * alpha + n1 / 255.0, 0.0, alpha), alpha);
}
