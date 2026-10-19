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

// Ripple: water seen from above, rings running out from under the composer.
// The word's mode does not draw a figure of its own; it bends and gates the
// running rings, so its n-fold symmetry is something the ripples carry.

const float W = 4.5; // angular speed of the main train; 100 * W is whole, so mod(uTime, 200pi) loops cleanly

float gN;     // fold
float gK;     // ripple wavenumber
float gZ;     // the word's turn, used as a phase
float gDepth; // how far the fronts are bent into a star
float gT;
float gAmp;
float gSharp;
float gSigma;

float depthOf(vec3 m) {
  // A fold of n bends a front n times around: past about 0.7/n it zigzags.
  // Deep enough that every word's star reads as a figure, not a wobble.
  return (0.6 + 0.4 * fract(m.z * 2.618 + 0.3)) * 1.05 / max(m.x, 3.0);
}

// Hoskins' hash12: arithmetic, so it holds up on mobile GPUs where a
// sin-of-coordinates hash collapses into visible structure.
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float height(vec2 p) {
  float r = length(p);
  float th = r > 1e-4 ? atan(p.x, p.y) : 0.0; // from straight up
  // The fold leaves the source round and grows in as the rings travel. It is
  // let go of below the horizon, so the seam a fold makes mid-morph (it
  // points straight down) is never drawn: only round rings go under the
  // composer.
  // The whole figure is on screen now, so the fold runs all the way round.
  float fold = smoothstep(0.02, 0.32, r);
  // Each word's star from its own whole fold, then blended: interpolating
  // the fold itself tears the figure where the angle wraps, straight down.
  float aA = uA.x * th + uA.z;
  float aB = uB.x * th + uB.z;
  // 0 on a tip, 1 between two; the small constant rounds the crease, the
  // kind real cymatics shows at its petal tips
  float sA = sin(0.5 * aA);
  float sB = sin(0.5 * aB);
  float star = mix((sqrt(sA * sA + 0.1) - 0.3162) / 0.7326, (sqrt(sB * sB + 0.1) - 0.3162) / 0.7326, uMix);
  float a = mix(aA, aB, uMix);
  // fronts are held back between the tips, so rings become flowers
  float bend = gDepth * gK * r * star * fold;
  // the water is never a perfect drawing: a slow drift bends the fronts
  float drift = 0.9 * sin(4.3 * p.x + 1.1 * gT + gZ) * sin(3.7 * p.y - 0.8 * gT);
  float p1 = gK * r - W * gT + bend + drift;
  // a shorter, faster train (capillary ripples run ahead), so the rings
  // come in groups rather than as a ruler
  float p2 = 1.75 * gK * r - 1.5 * W * gT + 1.75 * bend + gZ - 1.2 * drift;
  float t1 = sin(p1) - 0.5 * gSharp * cos(2.0 * p1);
  float t2 = sin(p2);
  // the petals carry the ripples; between them the water is calmer
  float lobe = mix(0.5 + 0.5 * cos(aA), 0.5 + 0.5 * cos(aB), uMix);
  float petal = mix(1.0, 0.04 + 1.7 * lobe * lobe * lobe, fold);
  // calm right above the source, where the words are written; the rings
  // build as they leave it and die out as they spread
  float env = smoothstep(0.02, 0.16, r) * exp(-(r * r) / (gSigma * gSigma));
  float waves = (t1 + 0.25 * t2) * petal * env * gAmp / gK;
  // a still, broad swell: what the dish shows before it is driven
  float swell = 0.09 * exp(-r * r * 2.5);
  return waves + swell;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;

  // The field opens out of the microphone: a soft glow that grows from it
  // and settles on the centre. No circle, no rim — only a falloff.
  float o = clamp(uOpen, 0.0, 1.0);
  float oe = o * o * (3.0 - 2.0 * o);
  vec2 oc = mix(uMic, uCenter, oe);
  float lvl = clamp(uLevel, 0.0, 1.0);
  float live = clamp(uLive, 0.0, 1.0);
  float reach = uRadius * (0.88 + 0.1 * lvl * live) * mix(0.15, 1.0, oe);
  float q = length(frag - oc) / reach;
  float pres = q < 1.0 ? pow(1.0 - q * q, 3.0) : 0.0;
  pres *= smoothstep(0.0, 0.35, o);
  if (pres <= 0.0) { gl_FragColor = vec4(0.0); return; }

  gN = mix(uA.x, uB.x, uMix);
  gK = mix(uA.y, uB.y, uMix) * 1.6 + 38.0;
  gZ = mix(uA.z, uB.z, uMix);
  // each word bends its fronts by its own amount: some nearly round, some
  // sharp stars; a higher fold needs a deeper bend to read at all
  gDepth = mix(depthOf(uA), depthOf(uB), uMix);
  gT = mod(uTime, 628.3185);
  gAmp = live * 0.75 * mix(0.03, 1.0, pow(lvl, 0.7));
  gSharp = 0.1 + 0.4 * lvl;
  gSigma = mix(0.48, 0.82, lvl);

  float e = 1.0 / uRadius;
  float h = height(p);
  vec2 g = vec2(height(p + vec2(e, 0.0)) - h, height(p + vec2(0.0, e)) - h) / e;
  vec3 nrm = normalize(vec3(-g, 1.0));

  // Shading in proportion to the slope, so a wave twice as high reads twice
  // as strong rather than saturating: the voice's level stays legible.
  float shade = -dot(g, vec2(0.0, 1.0)); // facing the light, straight above: both flanks alike
  float steep = dot(g, g);
  vec3 L = normalize(vec3(0.0, 0.4, 0.92));
  vec3 Hv = normalize(L + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(nrm, Hv), 0.0);
  float spec = pow(nh, 700.0);
  float sheen = max(pow(nh, 24.0) - pow(Hv.z, 24.0), 0.0);

  vec3 bright = mix(uPaper, uInk, uDark);
  vec3 deep = mix(mix(uPaper, uInk, 0.5), uPaper * 0.3, uDark);
  vec3 base = mix(uPaper, uInk, mix(0.1, 0.07, uDark));
  vec3 col = base;
  col = mix(col, bright, clamp(shade * mix(2.8, 1.1, uDark), 0.0, 1.0));
  col = mix(col, deep, clamp(-shade * mix(2.6, 1.4, uDark), 0.0, 1.0));
  // steep water bends the light away: the flanks of a high wave darken
  col = mix(col, deep, clamp(steep * 0.8, 0.0, 0.45));
  col = mix(col, bright, clamp(spec * 1.1 + sheen * 0.7, 0.0, 1.0));

  float alpha = pres * 0.95;
  vec3 rgb = col * alpha;
  float d = (hash(frag) + hash(frag + 17.3) - 1.0) / 255.0;
  rgb += d * min(1.0, alpha * 40.0);
  gl_FragColor = vec4(rgb, alpha);
}
