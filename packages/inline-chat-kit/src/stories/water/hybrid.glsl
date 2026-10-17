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

// Hybrid interference. Nothing here is drawn: the figure is what two
// families of waves make where they cross.
//   The centre source, the transducer under the drop: short waves running
//   out, partly standing against their own echo, so they ring the drop.
//   A ring of n sources near the rim, one straight up: the dish's n-fold
//   resonance, driven by the voice, with long waves running in.
// Where the two meet, the rings are bent into the polygon and the petals.
// Every wave is summed as a complex amplitude with its analytic gradient;
// the water heaps where the sum reinforces and creases where it cancels.

const float PI = 3.14159265;
const float TAU = 6.2831853;
const float OMEGA = 1.5707963; // the ripples' slow beat: one cycle in 4 s

#ifndef FS
#define FS 1.22
#endif
#ifndef KC
#define KC 1.0
#endif
#ifndef KR
#define KR 0.5
#endif
#ifndef AC
#define AC 1.0
#endif
#ifndef DC
#define DC 0.8
#endif
#ifndef TAUC
#define TAUC 0.35
#endif
#ifndef AR
#define AR 1.4
#endif
#ifndef DR
#define DR 1.35
#endif
#ifndef TAUR
#define TAUR 0.25
#endif
#ifndef R0
#define R0 0.88
#endif
#ifndef SIGR
#define SIGR 0.1
#endif
#ifndef GAMMA
#define GAMMA 0.6
#endif
#ifndef GW
#define GW 0.6
#endif
#ifndef SPREAD
#define SPREAD 0.2
#endif
#ifndef WIN
#define WIN 0.1
#endif
#ifndef WOUT
#define WOUT 0.35
#endif
#ifndef PHK
#define PHK 2.3
#endif
#ifndef CAVK
#define CAVK 0.035
#endif
#ifndef TILTK
#define TILTK 0.35
#endif
#ifndef NPOW
#define NPOW 0.3
#endif
#ifndef MOV
#define MOV 0.25
#endif

// Accumulated by wave(): the complex sum, the gradients of its two parts,
// its Laplacian (Helmholtz: -k^2 times each wave), the incoherent intensity
// and its gradient.
vec2 U;
vec2 GX;
vec2 GY;
vec2 LU;
float I;
vec2 GI;

// One circular wave. `sig` gives the source a size, so nothing is singular at
// distance 0. tau = 1 is a wave running out of its source, tau = 0 a standing
// one (its own echo summed in); between, the creases it makes are soft.
void wave(vec2 p, vec2 src, float k, float ph, float amp, float damp, float sig, float tau) {
  vec2 dv = p - src;
  float d = sqrt(dot(dv, dv) + sig * sig);
  vec2 gd = dv / d;
  float sp = inversesqrt(1.0 + SPREAD * k * d);
  float a = amp * sp * exp(-damp * d);
  float da = a * (-0.5 * SPREAD * k * sp * sp - damp);
  float psi = k * d + ph;
  float c = cos(psi);
  float s = sin(psi);
  U += a * vec2(c, tau * s);
  GX += (da * c - a * k * s) * gd;
  GY += tau * (da * s + a * k * c) * gd;
  LU -= k * k * a * vec2(c, tau * s);
  float w2 = 0.5 * (1.0 + tau * tau);
  I += w2 * a * a;
  GI += w2 * 2.0 * a * da * gd;
}

float RING; // how strongly the voice drives the rim

void mode(vec2 p, vec3 m) {
  float n = m.x;
  float k = m.y;
  float ph = m.z;
  if (n > 0.5 && RING > 0.0) {
    float kr = k * KR;
    float st = TAU / n;
    vec2 cs = vec2(cos(st), sin(st));
    vec2 q = vec2(0.0, R0);
    // Amplitudes go as 1/k, so a short wave and a long one tilt the water
    // alike, and fall a little with n, so a many-fold figure does not pile
    // up where all its waves meet.
    float amp = AR * RING * 20.0 / kr * pow(n / 4.0, -NPOW);
    // The phase between the rim and the centre comes from the word, its
    // turn and its length both, so two words of one fold still differ. It
    // moves where their crests meet; it never turns the figure off its mirror.
    float phr = ph + PHK * k;
    for (int i = 0; i < 8; i++) {
      if (float(i) >= n) break;
      wave(p, q, kr, phr, amp, DR, SIGR, TAUR);
      q = vec2(q.x * cs.x - q.y * cs.y, q.x * cs.y + q.y * cs.x);
    }
    // The sources sit on the wall: their waves run in, not out past it.
    float rho = length(p);
    float w = 1.0 - smoothstep(R0 - WIN, R0 + WOUT, rho);
    float t = clamp((rho - R0 + WIN) / (WIN + WOUT), 0.0, 1.0);
    vec2 gw = -6.0 * t * (1.0 - t) / (WIN + WOUT) * p / max(rho, 1e-3);
    GX = GX * w + U.x * gw;
    GY = GY * w + U.y * gw;
    U *= w;
    LU *= w;
    GI = GI * w * w + 2.0 * w * I * gw;
    I *= w * w;
  }
  float kc = k * KC;
  wave(p, vec2(0.0), kc, 0.0, AC * 20.0 / kc, DC, 0.06, TAUC);
}

// Hoskins' hash: arithmetic, so no pattern of its own.
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

  // Opens out of the microphone as a soft growing blob, never a hard circle.
  float reach = length(uRes) * 2.0;
  float dm = length(frag - uMic);
  float rev = 1.0 - smoothstep(0.3, 1.0, dm / max(uOpen * reach, 1.0));
  rev *= smoothstep(0.0, 0.6, uOpen);
  // Melts into the page by r = 1.25, with no slope at the end.
  float alpha = (1.0 - smoothstep(0.45, 1.25, r)) * rev;
  if (alpha < 0.002) { gl_FragColor = vec4(0.0); return; }

  float T = mod(uTime, 400.0);
  float lv = clamp(uLevel, 0.0, 1.0);
  float drive = pow(lv, 0.6);

  // The still swell: a lens of water, there while the browser asks. Only its
  // slope and curvature are needed; the height itself never is.
  float dome = 0.05 * exp(-r2 * 2.6);
  vec2 g = dome * -5.2 * p;
  float lap = dome * (27.04 * r2 - 10.4);

  if (uLive > 0.0) {
    RING = smoothstep(0.0, 0.25, lv);
    vec2 f = p * FS;
    // The new word's waves spread from the centre outward; the weights are
    // a cosine and a sine, so the energy holds through the change.
    float t = clamp(uMix * 1.625 - 0.4 * r2, 0.0, 1.0);
    float th = 0.5 * PI * t * t * (3.0 - 2.0 * t);
    vec2 gth = 0.5 * PI * 6.0 * t * (1.0 - t) * -0.8 * p;
    float wa = cos(th);
    float wb = sin(th);
    vec2 Ua = vec2(0.0), Ub = vec2(0.0);
    vec2 GXa = vec2(0.0), GYa = vec2(0.0), GXb = vec2(0.0), GYb = vec2(0.0);
    vec2 La = vec2(0.0), Lb = vec2(0.0);
    float Ia = 0.0, Ib = 0.0;
    vec2 GIa = vec2(0.0), GIb = vec2(0.0);
    if (uMix < 1.0) {
      U = vec2(0.0); GX = vec2(0.0); GY = vec2(0.0); LU = vec2(0.0); I = 0.0; GI = vec2(0.0);
      mode(f, uA);
      Ua = U; GXa = GX * FS; GYa = GY * FS; La = LU * FS * FS; Ia = I; GIa = GI * FS;
    }
    if (uMix > 0.0) {
      U = vec2(0.0); GX = vec2(0.0); GY = vec2(0.0); LU = vec2(0.0); I = 0.0; GI = vec2(0.0);
      mode(f, uB);
      Ub = U; GXb = GX * FS; GYb = GY * FS; Lb = LU * FS * FS; Ib = I; GIb = GI * FS;
    }
    if (uMix >= 1.0) { wa = 0.0; wb = 1.0; gth = vec2(0.0); }
    if (uMix <= 0.0) { wa = 1.0; wb = 0.0; gth = vec2(0.0); }
    vec2 gwa = -wb * gth;
    vec2 gwb = wa * gth;
    U = wa * Ua + wb * Ub;
    GX = wa * GXa + wb * GXb + Ua.x * gwa + Ub.x * gwb;
    GY = wa * GYa + wb * GYb + Ua.y * gwa + Ub.y * gwb;
    LU = wa * La + wb * Lb;
    I = wa * wa * Ia + wb * wb * Ib;
    GI = wa * wa * GIa + wb * wb * GIb + 2.0 * (wa * Ia * gwa + wb * Ib * gwb);

    // The heap: |U|^gamma over the incoherent mean's, so only the crossings
    // have relief. Softened at the cancellations, so they fold into creases
    // rather than cusps; a loud voice folds them sharper.
    float eps = mix(0.06, 0.02, drive);
    float Q = dot(U, U);
    vec2 gQ = 2.0 * (U.x * GX + U.y * GY);
    float lapQ = 2.0 * (dot(GX, GX) + dot(GY, GY)) + 2.0 * dot(U, LU);
    float qe = Q + eps;
    float ie = I + eps;
    float hq = pow(qe, 0.5 * GAMMA);
    float hm = pow(ie, 0.5 * GAMMA);
    float fig = (hq - hm) / GAMMA * GW;
    vec2 gfig = 0.5 * (hq / qe * gQ - hm / ie * GI) * GW;
    float lfig = 0.5 * hq / qe * (lapQ + (0.5 * GAMMA - 1.0) * dot(gQ, gQ) / qe) * GW;

    // The waves themselves, riding through the figure, slowly.
    float ct = cos(OMEGA * T);
    float stt = sin(OMEGA * T);
    float mov = U.x * ct + U.y * stt;
    vec2 gmov = GX * ct + GY * stt;
    float lmov = LU.x * ct + LU.y * stt;

    // The figure lives inside r = 1 and has let go by 1.2.
    // A louder voice carries the figure further out.
    float ew = 0.62 + 0.2 * drive;
    float e2 = r2 / ew;
    float env = exp(-e2 * e2);
    vec2 genv = env * (-2.0 * e2 / ew) * 2.0 * p;

    float AF = uLive * (0.004 + 0.026 * drive);
    float AM = AF * MOV;
    float w = AF * fig + AM * mov;
    g += env * (AF * gfig + AM * gmov) + genv * w;
    lap += env * (AF * lfig + AM * lmov);
  }

  vec3 nrm = normalize(vec3(-g, 1.0));
  float slope = length(g);
  vec3 R = reflect(vec3(0.0, 0.0, -1.0), nrm);
  float rl = length(R.xy);

  // The gentle light under the water, seen through it: every crest bends it.
  vec2 q = p - g * 1.2;
  float glow = exp(-dot(q, q) * 2.4);

  // How far the reflection swings across one pixel: a glint on a tight crest
  // would fall between pixels, so it is widened and dimmed to match.
  float fw = 2.5 * abs(lap) / uRadius;
  // A ring light all around: thin glints wherever a flank tilts just so.
  float rw = 0.07 + fw;
  float ring = smoothstep(rw, 0.0, abs(rl - 0.4)) * (0.55 + 0.45 * smoothstep(-0.4, 0.4, R.y)) * (0.07 / rw);
  ring *= uLive * smoothstep(0.03, 0.25, lv);
  // A key light from straight above the figure: glossy highlights.
  float key = smoothstep(0.18 + fw, 0.04, length((R.xy - vec2(0.0, 0.62)) * vec2(0.7, 1.5))) * (0.18 / (0.18 + fw));
  float sheen = smoothstep(0.16, 0.0, length((R.xy - vec2(0.0, 0.15)) * vec2(0.6, 1.0)));
  // Curvature: crests gather light, hollows and creases hold shadow.
  float cav = smoothstep(0.0, 1.0, lap * CAVK);
  float vex = smoothstep(0.0, 1.0, -lap * CAVK);
  // Flanks turned away from the light above reflect the room, not the light.
  float lower = smoothstep(-0.25, 0.35, -R.y);
  float tilt = smoothstep(0.0, TILTK, slope);

  vec3 col;
  if (uDark < 0.5) {
    // Milk-white water on white: a pale body, shade in the hollows and on
    // the flanks turned from the light, and the light itself back to paper.
    float tone = 0.11 * glow + 0.006;
    tone += tilt * (0.13 + 0.22 * lower) + 0.26 * cav;
    col = mix(uPaper, uInk, clamp(tone, 0.0, 1.0));
    float hi = 0.9 * key + 0.5 * sheen + 0.45 * vex + 0.8 * ring;
    col = mix(col, uPaper, clamp(hi, 0.0, 1.0));
  } else {
    // Dark water: lit a little from inside, so it is a body and never darker
    // than the page; what shows of the figure is the room's light mirrored
    // on it — a soft box above, a ring all around — not a matte sheen.
    float tone = 0.06 * glow + 0.012 + 0.1 * vex;
    col = mix(uPaper, uInk, clamp(tone, 0.0, 1.0));
    col = mix(col, uPaper * 0.75, 0.45 * cav);
    float hi = 0.7 * key + 0.2 * sheen + 0.9 * ring;
    col = mix(col, uInk, clamp(hi, 0.0, 1.0) * 0.62);
  }

  float n1 = hash12(frag) + hash12(frag + 17.13) - 1.0;
  vec3 pm = col * alpha + n1 / 255.0;
  gl_FragColor = vec4(clamp(pm, 0.0, alpha), alpha);
}
