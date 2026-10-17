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

float T, AMP, SHARP;
float gN, gK, gO, gS, gHar, gAlt, gZ, gFold, gWob;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// x: orientation (+1 tip up, -1 gap up), y: bend, z: alternation, w: 2n harmonic
vec4 traits(vec3 m) {
  float h1 = fract(m.y * 1.618034 + m.z * 0.7071);
  float h2 = fract(m.y * 0.618034 + m.z * 2.236068);
  float h3 = fract(m.y * 2.618034 + m.z * 1.414214);
  return vec4(h1 < 0.5 ? 1.0 : -1.0, 0.07 + 0.05 * h2, 0.5 + 0.5 * h3, 0.3);
}

float mode(float r, float th, float sharp) {
  float c1 = gO * cos(gN * th);
  float c2 = cos(2.0 * gN * th);
  float s = gS * gFold * smoothstep(0.0, 0.45, r);
  float alt = mix(1.0, cos(gK * r * 0.5 + gZ), gAlt);
  float rr = r * (1.0 - s * (c1 * alt + gHar * c2));
  float x = gK * rr - T * 1.7 + gWob;
  float crest = exp((cos(x) - 1.0) * sharp);
  float petals = 1.0 + 0.45 * gFold * c1 * smoothstep(0.05, 0.35, r);
  return crest * petals * inversesqrt(1.0 + 0.12 * gK * r);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r2 = dot(p, p);
  if (r2 >= 1.0) { gl_FragColor = vec4(0.0); return; }
  float r = sqrt(r2);

  float span = uRadius + length(uMic - uCenter);
  float front = uOpen * 1.6 * span;
  float rev = 1.0 - smoothstep(front - 0.6 * span, front, length(frag - uMic));
  float fall = 1.0 - r2;
  float alpha = 0.94 * fall * fall * sqrt(fall) * rev;
  if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }

  T = mod(uTime, 628.3185);
  float live = clamp(uLive, 0.0, 1.0);
  float lv = clamp(uLevel, 0.0, 1.0);
  float drive = pow(lv, 0.55);
  AMP = live * (0.06 + 0.94 * drive) * 0.011;
  float EXT = 0.42 + 0.33 * drive;
  SHARP = 0.7 + 2.0 * drive;

  float c = length(vec2(p.x * 0.38, p.y));
  float calm = smoothstep(0.1, 0.34, c);
  float env = exp(-r2 / (EXT * EXT)) * calm * (1.0 - smoothstep(0.4, 0.72, r));

  vec2 g = vec2(0.0);
  float lap = 0.0;
  if (AMP * env > 1e-7) {
    float m = smoothstep(0.0, 1.0, (uMix * 1.7 - r) * 2.2);
    vec4 t = mix(traits(uA), traits(uB), m);
    gN = mix(uA.x, uB.x, m);
    gK = 30.0 + 1.4 * mix(uA.y, uB.y, m);
    gZ = mix(uA.z, uB.z, m);
    gO = t.x; gS = t.y; gAlt = t.z; gHar = t.w;
    float up = p.y / max(r, 1e-4);
    gFold = smoothstep(-0.8, -0.3, up) * smoothstep(0.0, 0.3, drive);
    gWob = live * (0.5 * cos(2.7 * p.x) * sin(2.1 * p.y - 0.7 * T) + 0.35 * sin(3.3 * r - 1.1 * T));
    float sharp = SHARP * mix(1.0, 0.75, uDark) * (1.0 - 0.6 * smoothstep(0.3, 0.7, r));

    float e = 1.5 / uRadius;
    float th = r > 1e-4 ? atan(p.x, p.y) : 0.0;
    vec2 da = vec2(p.y, -p.x) / max(r2, 1e-6) * e;
    float h0 = mode(r, th, sharp);
    float hxp = mode(length(p + vec2(e, 0.0)), th + da.x, sharp);
    float hxm = mode(length(p - vec2(e, 0.0)), th - da.x, sharp);
    float hyp = mode(length(p + vec2(0.0, e)), th + da.y, sharp);
    float hym = mode(length(p - vec2(0.0, e)), th - da.y, sharp);
    float H = AMP * env;
    g = H * vec2(hxp - hxm, hyp - hym) / (2.0 * e);
    lap = H * (hxp + hxm + hyp + hym - 4.0 * h0) / (e * e);
  }
  // Listening but silent: a slow, round swell breathes outward, so an open
  // microphone never looks like the waiting state. Round, so it carries no
  // word; gone once the voice drives the water.
  float breath = live * (1.0 - smoothstep(0.0, 0.35, drive)) * calm * exp(-r2 * 4.0) * (1.0 - smoothstep(0.35, 0.7, r));
  if (breath > 0.0) g -= breath * mix(0.06, 0.035, uDark) * sin(14.0 * r - 1.3 * T) * p / max(r, 1e-4);
  vec3 nrm = normalize(vec3(-g, 1.0));
  float slope = length(g);
  vec2 R = 2.0 * nrm.z * nrm.xy;
  float rl = length(R);
  vec2 dir = p / max(r, 1e-4);
  float rad = dot(g, dir);
  float glint = smoothstep(0.05, 0.35, drive);

  vec2 q = p - g * mix(0.6, 0.25, uDark);
  float glow = exp(-dot(q, q) * 3.2);
  float fw = 2.5 * abs(lap) / uRadius;
  float rw = 0.07 + fw;
  float ring = (1.0 - smoothstep(0.0, rw, abs(rl - 0.4))) * smoothstep(-0.2, 0.4, R.y) * (0.07 / rw) * glint;
  float kw = 0.18 + fw;
  float key = (1.0 - smoothstep(0.04, kw, length((R - vec2(0.0, 0.62)) * vec2(0.7, 1.5)))) * (0.18 / kw);
  float sheen = (1.0 - smoothstep(0.0, 0.14, length((R - vec2(0.0, 0.15)) * vec2(0.6, 1.0)))) * glint;
  float lens = clamp(-lap * 0.03, -1.0, 1.0);
  float edge = smoothstep(0.03, 0.7, slope) * smoothstep(-0.1, 0.45, 0.2 - R.y);
  float guard = smoothstep(0.12, 0.4, c);

  vec3 col;
  if (uDark < 0.5) {
    float tone = 0.105 * glow + 0.008 + 0.5 * edge + 0.12 * max(-lens, 0.0) + 0.5 * max(rad, 0.0);
    col = mix(uPaper, uInk, clamp(tone, 0.0, 0.6));
    float hi = 0.95 * key + 0.55 * sheen + 0.4 * max(lens, 0.0) + 0.8 * ring + 0.6 * max(-rad, 0.0);
    col = mix(col, vec3(1.0), clamp(hi, 0.0, 1.0) * 0.97);
  } else {
    vec3 body = mix(uPaper, uInk, 0.085 * glow);
    // a broad softbox overhead, measured from flat water so still water shows none of it
    vec2 bd = (R - vec2(0.0, 0.42)) / vec2(0.9, 0.3);
    float box = max(exp(-dot(bd, bd)) - exp(-1.96), 0.0) / (1.0 - exp(-1.96)) * (0.3 / (0.3 + fw));
    float shadow = clamp(0.8 * max(rad, 0.0) + 0.35 * edge + 0.3 * max(-lens, 0.0), 0.0, 1.0);
    col = body * (1.0 - 0.4 * shadow);
    float hi = 0.7 * box + 0.55 * key + 0.25 * sheen + 0.3 * max(lens, 0.0) + 0.15 * ring + 0.55 * max(-rad, 0.0);
    col = mix(col, uInk * mix(0.42, 0.72, guard), clamp(hi, 0.0, 1.0));
  }

  float n1 = hash12(frag) + hash12(frag + vec2(17.17, 3.71)) - 1.0;
  float n2 = hash12(frag + vec2(41.3, 9.1)) + hash12(frag + vec2(5.9, 73.9)) - 1.0;
  vec3 dc = abs(col - uPaper);
  float wide = clamp(min(1.0 / max(max(uPaper.r, uPaper.g), uPaper.b), 1.0 / max(max(dc.r, dc.g), max(dc.b, 1e-4))), 1.0, 16.0);
  float a = clamp(alpha + n2 * min(wide / 255.0, alpha), 0.0, 1.0);
  gl_FragColor = vec4(clamp(col * a + n1 / 255.0, 0.0, a), a);
}
