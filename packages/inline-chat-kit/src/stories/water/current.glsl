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

float mode(vec2 p, vec3 m) {
  float r = length(p);
  float n = m.x;
  float k = m.y;
  // Turned by the word's phase, and the same turn for both families, so the
  // figure keeps its mirrors — a mandala rather than a maze.
  float a = atan(p.y, p.x) + m.z / max(n, 1.0);
  // A Bessel function's tail, roughly: a cosine that thins out with radius.
  float radial = cos(k * r - (n * 0.5 + 0.25) * PI * 0.5) * inversesqrt(1.0 + 0.8 * k * r);
  float lobes = n < 0.5 ? 1.0 : cos(n * a);
  // A second family at twice the fold, which is what makes petals rather
  // than spokes, fading toward the rim.
  float petals = cos(k * 0.55 * r + 1.3) * cos(2.0 * n * a) * (1.0 - r * 0.8);
  return radial * lobes + 0.32 * petals;
}

float field(vec2 p) {
  return mix(mode(p, uA), mode(p, uB), uMix);
}

float height(vec2 p) {
  float r = length(p);
  // Faraday waves flicker at twice the drive; a standing wave that only
  // breathes in amplitude reads as alive without travelling anywhere.
  // A floor, so a quiet voice still holds the shape; loudness deepens it.
  float drive = uLive * (0.45 + 0.75 * uLevel);
  float flicker = 0.78 + 0.22 * sin(uTime * 19.0);
  float h = field(p) * drive * flicker;
  // Ripples from the centre, only while driven.
  h += 0.025 * drive * sin(r * 46.0 - uTime * 7.0) * (1.0 - r);
  // The drop at the centre, where the transducer is.
  h += 0.22 * exp(-r * r * 320.0);
  // The meniscus climbing the dish wall.
  h += 0.35 * smoothstep(0.8, 1.0, r);
  return h;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - uCenter) / uRadius;
  float r = length(p);

  // The dish opens out of the microphone: a circle from it, growing.
  float reach = length(uRes) * 1.15;
  float revealed = 1.0 - smoothstep(uOpen * reach - 40.0, uOpen * reach, length(frag - uMic));
  float dish = 1.0 - smoothstep(0.985, 1.0, r);
  float mask = revealed * dish;
  if (mask <= 0.0) { gl_FragColor = vec4(0.0); return; }

  float e = 1.25 / uRadius;
  float h = height(p);
  float hx = height(p + vec2(e, 0.0)) - h;
  float hy = height(p + vec2(0.0, e)) - h;
  vec3 nrm = normalize(vec3(-hx / e * 0.018, -hy / e * 0.018, 1.0));

  vec3 light = normalize(vec3(-0.45, 0.55, 0.7));
  vec3 half_ = normalize(light + vec3(0.0, 0.0, 1.0));
  float diffuse = clamp(dot(nrm, light), 0.0, 1.0);
  float spec = pow(clamp(dot(nrm, half_), 0.0, 1.0), 90.0);
  float sheen = pow(clamp(dot(nrm, half_), 0.0, 1.0), 12.0);
  float tilt = 1.0 - nrm.z;

  // Where the plate does not move, the sand gathers: the nodal lines.
  float f = field(p);
  float drive = uLive * (0.5 + 0.5 * uLevel);
  float nodes = exp(-abs(f) * 18.0) * drive;

  // Milk in the light theme, black water in the dark — paper and ink, as the
  // kit already defines them.
  vec3 body = mix(uPaper * 0.94 + uInk * 0.06, uPaper * 0.9 + uInk * 0.1, uDark);
  vec3 shade = mix(uInk, uPaper, 0.55);
  vec3 col = body;
  col = mix(col, shade, clamp(tilt * 6.0, 0.0, 0.55));
  col *= 0.88 + 0.18 * diffuse;
  col += vec3(spec) * mix(0.9, 1.1, uDark) + vec3(sheen) * 0.06;
  // Sand on the lines: darker than the milk in the light, and in the dark
  // the white of the photographs, sand on a black plate.
  vec3 sand = mix(uPaper, uInk, mix(0.35, 0.85, uDark));
  col = mix(col, sand, nodes * mix(0.35, 0.6, uDark));

  // The one note of the marker: the drop glows while the dish is live.
  float core = exp(-r * r * 260.0);
  col = mix(col, uMarker, core * uLive * (0.35 + 0.65 * uLevel) * 0.8);

  // Translucent toward the rim, so the dimmed page shows through the water.
  float alpha = mask * mix(0.94, 0.55, smoothstep(0.55, 1.0, r));
  gl_FragColor = vec4(col * alpha, alpha);
}
