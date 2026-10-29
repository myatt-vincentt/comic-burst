// GLSL for Comic Burst. The full-screen passes are quads drawn straight to
// clip space; positions are screen uv (0..1, y up) and sizes are in screen
// heights (x scaled by the aspect ratio). Colours are linear.
import { MAX_CAPSULES } from "./sim/gate";
import { PAL_SIZE } from "./palettes";

/** Shared helpers: noise, the palette, and where the comic world shows. */
const COMMON = /* glsl */ `
  uniform float uAspect;
  uniform float uTime;
  uniform vec4 uWipe;
  uniform vec3 uPal[${PAL_SIZE}];
  uniform float uCycle;
  uniform float uEnergy;

  float hash1(float n) { return fract(sin(n * 127.1 + 11.7) * 43758.5453); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  vec3 fromSrgb(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  }

  // The four shape colours, by slot (wraps round).
  vec3 pal4(float i) {
    float k = mod(floor(i + 0.5), 4.0);
    if (k < 0.5) return uPal[2];
    if (k < 1.5) return uPal[3];
    if (k < 2.5) return uPal[4];
    return uPal[5];
  }
  // A shape colour that moves on with the colour cycle. Each thing has its
  // own offset, so they hand over one by one and the change is a slow fade.
  vec3 cycled(float slot, float offset) {
    float ph = uCycle + offset;
    float i = floor(ph);
    float k = smoothstep(0.55, 1.0, fract(ph));
    return mix(pal4(slot + i), pal4(slot + i + 1.0), k);
  }

  // The wipe's jagged edge: how far it is pushed sideways at height y.
  // Big zigzag teeth with finer ones on top, new for every wipe.
  float jag(float y) {
    float seed = uWipe.w * 91.0;
    float s = y * 9.0 + seed;
    float i = floor(s);
    float f = fract(s);
    float sa = mod(i, 2.0) * 2.0 - 1.0;
    float a = sa * (0.35 + 0.65 * hash1(i + seed));
    float b = -sa * (0.35 + 0.65 * hash1(i + 1.0 + seed));
    float s2 = y * 31.0 + seed * 0.37;
    float i2 = floor(s2);
    float sb = mod(i2, 2.0) * 2.0 - 1.0;
    float c = mix(sb, -sb, fract(s2)) * hash1(i2 + 7.0 + seed);
    return mix(a, b, f) * 0.05 + c * 0.012;
  }
  // Distance from the edge along the wipe (screen widths): below 0 behind
  // the edge (the new world), above 0 ahead of it. Slightly slanted.
  float wipeSide(vec2 uv) {
    float e = uWipe.x + jag(uv.y) + (uv.y - 0.5) * 0.12 * uWipe.y;
    return (uv.x - e) * uWipe.y;
  }
  // 1 where the comic world shows.
  float comicAt(vec2 uv) {
    float behind = step(wipeSide(uv), 0.0);
    return uWipe.z > 0.5 ? behind : 1.0 - behind;
  }
`;

/** Full-screen quad. */
export const screenVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;

/**
 * The world: the camera picture where the room still shows, and the pop-art
 * world where the comic world has wiped in — a flat base, radial burst rays
 * from behind the person, halftone dot fields and big angular shapes with
 * offset print shadows. Movement turns the rays faster, widens them, lights
 * more of them up and pulses the shapes.
 */
export const worldFrag = /* glsl */ `
  ${COMMON}
  uniform sampler2D uCam;
  uniform float uCamLinear;
  uniform vec2 uBurstC;
  uniform float uSpin;
  uniform float uPulse;
  uniform float uPx;
  varying vec2 vUv;

  // Inside a triangle: distance to its nearest edge (positive inside).
  float tri(vec2 p, vec2 a, vec2 b, vec2 c) {
    float o = sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    vec2 e0 = b - a, e1 = c - b, e2 = a - c;
    float d0 = o * (e0.x * (p.y - a.y) - e0.y * (p.x - a.x)) / length(e0);
    float d1 = o * (e1.x * (p.y - b.y) - e1.y * (p.x - b.x)) / length(e1);
    float d2 = o * (e2.x * (p.y - c.y) - e2.y * (p.x - c.x)) / length(e2);
    return min(d0, min(d1, d2));
  }

  // Halftone dots on a turned grid: 1 inside a dot. 'size' 0..1 of the cell.
  float dots(vec2 p, float cell, float size, float turn) {
    vec2 g = rot(turn) * p / cell;
    float d = length(fract(g) - 0.5);
    float r = 0.5 * size * 1.42;
    float aa = uPx / cell * 1.2;
    return 1.0 - smoothstep(r - aa, r + aa, d);
  }

  vec3 art(vec2 uv) {
    float E = uEnergy;
    vec2 p = (uv - uBurstC) * vec2(uAspect, 1.0);
    float r = length(p);
    float ang = atan(p.y, p.x);

    // The burst: wedge rays turning round the centre. With movement they
    // widen, and more of them light up in the shape colours.
    const float N = 24.0;
    float s = (ang + uSpin) / 6.28318 * N;
    float k = floor(s);
    float f = fract(s);
    float w = 0.28 + 0.3 * hash1(k) + 0.14 * E;
    float aaR = uPx / max(r, 0.02) * N / 6.28318 * 1.5;
    float ray = smoothstep(w + aaR, w - aaR, f) * smoothstep(0.0, aaR, f);
    ray *= smoothstep(0.05, 0.12, r);
    vec3 col = mix(uPal[0], uPal[1], ray);
    float hot = step(0.78 - 0.3 * E, hash1(k + 5.0)) * ray;
    col = mix(col, cycled(hash1(k + 9.0) * 4.0, hash1(k + 2.0)), hot * smoothstep(0.22, 0.4, r));

    // Halftone fields, drifting slowly.
    vec2 q = p * 1.3 + vec2(uTime * 0.015, -uTime * 0.01);
    float field = noise(q * 1.6) * 0.65 + noise(q * 3.7 + 4.0) * 0.35;
    float fieldOn = smoothstep(0.5, 0.78, field);
    col = mix(col, uPal[6], 0.9 * dots(p, 0.026, fieldOn * (0.75 + 0.2 * E), 0.52));

    // Big angular shapes, each with an offset print shadow; some are
    // filled with dots instead of flat colour.
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      float h1 = hash1(fi * 3.1 + 1.0), h2 = hash1(fi * 5.7 + 2.0);
      float h3 = hash1(fi * 7.3 + 3.0), h4 = hash1(fi * 2.9 + 4.0);
      float h5 = hash1(fi * 4.3 + 5.0), h6 = hash1(fi * 6.1 + 6.0);
      // Spread round the edges of the screen, away from the middle.
      float side = mod(fi, 2.0) * 2.0 - 1.0;
      vec2 c = vec2(0.5 + side * (0.28 + 0.3 * h1), 0.08 + 0.84 * h2);
      c += 0.025 * vec2(sin(uTime * 0.21 + fi * 1.7), cos(uTime * 0.17 + fi * 2.3));
      vec2 cp = (c - uBurstC) * vec2(uAspect, 1.0);
      float size = (0.16 + 0.22 * h3) * (1.0 + 0.1 * E * sin(uPulse + fi * 1.3));
      float a0 = h4 * 6.28318 + uTime * (0.03 + 0.04 * h5) * side;
      vec2 A = cp + size * vec2(cos(a0), sin(a0));
      vec2 B = cp + size * (0.45 + 0.4 * h5) * vec2(cos(a0 + 2.2 + 0.6 * h6), sin(a0 + 2.2 + 0.6 * h6));
      vec2 C = cp + size * (0.55 + 0.35 * h6) * vec2(cos(a0 + 4.1 + 0.4 * h4), sin(a0 + 4.1 + 0.4 * h4));
      vec2 off = vec2(0.012, -0.012);
      float sh = smoothstep(-uPx, uPx, tri(p - off, A, B, C));
      col = mix(col, uPal[6], sh * 0.85);
      float inside = smoothstep(-uPx, uPx, tri(p, A, B, C));
      vec3 fill = cycled(fi, h1 * 3.0);
      if (mod(fi, 3.0) > 1.5) {
        float d = dots(p, 0.018, 0.85, 0.3 + fi);
        inside *= d;
      }
      col = mix(col, fill, inside);
    }
    return col;
  }

  void main() {
    vec3 cam = texture2D(uCam, vUv).rgb;
    if (uCamLinear < 0.5) cam = fromSrgb(cam);
    vec3 col = cam;
    // Nothing of the comic world while the room shows everywhere.
    if (!(uWipe.x > 5.0 && uWipe.z < 0.5)) {
      float comic = comicAt(vUv);
      if (comic > 0.5) col = art(vUv);
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * You, in the comic world: flat bands of the palette's dark tones from your
 * own light and shade (eyes, brows, mouth and hair fall in the darkest band
 * and keep the face readable), ink lines on strong edges, halftone dots in
 * the middle band, a thin ink outline and a thick two-colour rim, nudged off
 * to one side like a misprinted comic.
 */
export const personFrag = /* glsl */ `
  ${COMMON}
  uniform sampler2D uCam;
  uniform float uCamLinear;
  uniform vec2 uCamTexel;
  uniform sampler2D uMask;
  uniform vec2 uLight;
  uniform float uPx;
  varying vec2 vUv;

  float lum(vec2 uv) {
    vec3 c = texture2D(uCam, uv).rgb;
    // Bands are judged in display (sRGB) brightness, which reads like the eye.
    if (uCamLinear > 0.5) c = pow(c, vec3(1.0 / 2.2));
    return dot(c, vec3(0.299, 0.587, 0.114));
  }

  void main() {
    if (uWipe.x > 5.0 && uWipe.z < 0.5) discard;
    if (comicAt(vUv) < 0.5) discard;
    vec2 asp = vec2(1.0 / uAspect, 1.0);

    float m = textureLod(uMask, vUv, 0.0).r;
    float person = smoothstep(0.45, 0.6, m);
    // The rim: wider and wider versions of you, nudged down and to the side
    // and wobbling a little, so it reads as hand-drawn.
    vec2 wob = (vec2(noise(vUv / asp * 11.0 + uTime * 0.5),
                     noise(vUv / asp * 11.0 - uTime * 0.4 + 7.0)) - 0.5) * 0.014 * asp;
    vec2 nudge = vec2(0.010, -0.008) * asp;
    float outline = smoothstep(0.16, 0.3, textureLod(uMask, vUv, 1.0).r);
    float inner = smoothstep(0.1, 0.17, textureLod(uMask, vUv - nudge * 0.5 + wob * 0.6, 2.6).r);
    float outer = smoothstep(0.045, 0.09, textureLod(uMask, vUv - nudge + wob, 4.0).r);
    // A thin ink line round the outside of the rim, like a printed outline.
    float edgeInk = smoothstep(0.022, 0.04, textureLod(uMask, vUv - nudge + wob, 4.3).r);
    if (edgeInk + outer + inner + outline + person < 0.001) discard;

    // Your light, in flat bands relative to your own mean and spread.
    vec2 t = uCamTexel * 1.6;
    float l0 = lum(vUv);
    float lx0 = lum(vUv - vec2(t.x, 0.0)), lx1 = lum(vUv + vec2(t.x, 0.0));
    float ly0 = lum(vUv - vec2(0.0, t.y)), ly1 = lum(vUv + vec2(0.0, t.y));
    float l = (l0 * 2.0 + lx0 + lx1 + ly0 + ly1) / 6.0;
    float z = (l - uLight.x) / max(uLight.y, 0.05);
    float aa = 0.12;
    float b1 = smoothstep(-0.95 - aa, -0.95 + aa, z);
    float b2 = smoothstep(-0.1 - aa, -0.1 + aa, z);
    float b3 = smoothstep(0.9 - aa, 0.9 + aa, z);
    vec3 col = uPal[7];
    col = mix(col, uPal[8], b1);
    // The middle band: dots of the darker tone, bigger toward the dark side.
    float mid = b2 * (1.0 - b3);
    float depth = clamp((0.9 - z) / 1.0, 0.0, 1.0);
    vec2 sp = vUv / asp;
    vec2 g = rot(0.8) * sp / 0.011;
    float dd = length(fract(g) - 0.5);
    float dr = 0.62 * depth;
    float dotOn = (1.0 - smoothstep(dr - 0.1, dr + 0.1, dd)) * step(0.05, depth);
    col = mix(col, mix(uPal[9], uPal[8], dotOn * 0.85), b2);
    col = mix(col, uPal[10], b3);
    // Ink lines where the light changes sharply (features, folds).
    float grad = length(vec2(lx1 - lx0, ly1 - ly0));
    col = mix(col, uPal[7], smoothstep(0.07, 0.15, grad) * 0.9);
    // Movement makes you glow a touch toward your light band.
    col = mix(col, uPal[10], 0.12 * uEnergy * mid);

    // Layers from the outside in: ink line, outer rim (two colours along
    // it), inner rim, ink outline, you.
    vec2 rp = vUv / asp;
    float split = step(0.55, noise(rp * 4.0 + vec2(uTime * 0.2, 0.0)));
    vec3 outerCol = mix(uPal[12], cycled(0.0, 0.0), split * 0.9);
    vec3 c = mix(uPal[6], outerCol, outer);
    float a = max(edgeInk, outer);
    c = mix(c, uPal[11], inner);
    a = max(a, inner);
    c = mix(c, uPal[6], outline);
    a = max(a, outline);
    c = mix(c, col, person);
    a = max(a, person);
    gl_FragColor = vec4(c * a, a);
    #include <colorspace_fragment>
  }
`;

/**
 * The wipe's edge, on top of everything: a thin ink line on the jagged edge
 * with a bright stripe just behind it and a second, thinner one in the rim
 * colour. Nothing outside a wipe.
 */
export const edgeFrag = /* glsl */ `
  ${COMMON}
  uniform float uPx;
  varying vec2 vUv;

  float band(float s, float a, float b) {
    return smoothstep(a - uPx, a + uPx, s) * (1.0 - smoothstep(b - uPx, b + uPx, s));
  }

  void main() {
    if (uWipe.x > 5.0) discard;
    float s = wipeSide(vUv) * uAspect;
    if (abs(s) > 0.09) discard;
    float ink = band(s, -0.006, 0.003);
    float stripe = band(s, -0.034, -0.006);
    float stripe2 = band(s, -0.058, -0.046);
    // A soft light running just ahead of the edge.
    float glow = (1.0 - smoothstep(0.0, 0.05, s)) * step(0.0, s) * 0.35;
    vec3 c = uPal[13];
    float a = max(stripe, glow);
    c = mix(c, uPal[11], stripe2);
    a = max(a, stripe2);
    c = mix(c, uPal[6], ink);
    a = max(a, ink);
    gl_FragColor = vec4(c * a, a);
    #include <colorspace_fragment>
  }
`;

/**
 * You, kept steady: the portrait mask, trusted only where a person really is
 * (the face with the body below it, and each tracked hand and forearm, see
 * sim/gate.ts), then held with a little hysteresis and blended over a few
 * frames so its outline neither flickers nor leaves stray islands. With no
 * face for a while the mask is trusted everywhere, so you never vanish.
 */
export const steadyFrag = /* glsl */ `
  uniform sampler2D uRaw;
  uniform float uHasRaw;
  uniform vec2 uRawTexel;
  uniform sampler2D uPrev;
  uniform float uFresh;
  uniform float uBlend;
  uniform float uAspect;
  uniform vec4 uFace;
  uniform float uTrustAll;
  uniform vec4 uCap[${MAX_CAPSULES}];
  uniform float uCapR[${MAX_CAPSULES}];
  uniform int uCapCount;
  varying vec2 vUv;

  // Distance from a capsule, in radii.
  float capsule(vec2 p, vec4 s, float r) {
    vec2 a = s.xy, b = s.zw;
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    return length(pa - ba * h) / max(r, 1e-4);
  }

  void main() {
    vec2 p = vUv * vec2(uAspect, 1.0);
    float gate = uTrustAll;
    float sure = 0.0;
    // The face: the head (with room for hair), and the body widening below the chin.
    if (uFace.z > 0.0) {
      vec2 c = uFace.xy * vec2(uAspect, 1.0);
      float w = uFace.z * uAspect;
      float h = uFace.w;
      vec2 hd = (p - (c + vec2(0.0, 0.15 * h))) / vec2(1.15 * w, 1.15 * h);
      gate = max(gate, 1.0 - smoothstep(0.85, 1.15, length(hd)));
      float chin = c.y - 0.45 * h;
      float down = clamp((chin - p.y) / (1.6 * h), 0.0, 1.0);
      float hw = w * (0.8 + 2.8 * down);
      float body = (1.0 - smoothstep(hw * 0.9, hw * 1.25, abs(p.x - c.x)))
        * (1.0 - smoothstep(chin - 0.1 * h, chin + 0.25 * h, p.y));
      gate = max(gate, body);
    }
    // The hands and forearms.
    for (int i = 0; i < ${MAX_CAPSULES}; i++) {
      if (i >= uCapCount) break;
      float d = capsule(p, uCap[i], uCapR[i]);
      gate = max(gate, 1.0 - smoothstep(0.95, 1.2, d));
      sure = max(sure, 1.0 - smoothstep(0.55, 0.8, d));
    }

    // The mask, softened a little so single pixels can't flicker.
    float m = 0.0;
    if (uHasRaw > 0.5) {
      m = texture2D(uRaw, vUv).g * 0.4;
      for (int k = 0; k < 6; k++) {
        float a = float(k) * 1.0472;
        m += texture2D(uRaw, vUv + vec2(cos(a), sin(a)) * uRawTexel * 2.0).g * 0.1;
      }
    }
    float target = max(m * gate, sure * step(0.5, uHasRaw));
    // Hysteresis: what is already you stays you down to a lower level.
    float prev = texture2D(uPrev, vUv).r;
    float thr = prev > 0.5 ? 0.32 : 0.6;
    float bin = smoothstep(thr - 0.18, thr + 0.18, target);
    float k = uFresh > 0.5 ? 1.0 : uBlend;
    float v = mix(prev, bin, k);
    gl_FragColor = vec4(v, v, v, 1.0);
  }
`;

/** The tiny read-back picture: red is brightness, green the steadied mask. */
export const statsFrag = /* glsl */ `
  uniform sampler2D uCam;
  uniform float uCamLinear;
  uniform sampler2D uMask;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(uCam, vUv).rgb;
    if (uCamLinear > 0.5) c = pow(c, vec3(1.0 / 2.2));
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    float m = textureLod(uMask, vUv, 2.0).r;
    gl_FragColor = vec4(l, m, 0.0, 1.0);
  }
`;

/** Plain full-screen quad for the off-screen passes. */
export const flatVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`;

/**
 * The flying 3D pieces (cubes, shards, confetti): flat toon shading in
 * three tones of a cycled shape colour, ink edges on the cubes, and only
 * where the comic world shows.
 */
export const flyerVert = /* glsl */ `
  attribute float aSlot;
  varying vec3 vN;
  varying vec2 vUv2;
  varying float vSlot;
  void main() {
    mat4 mv = modelViewMatrix * instanceMatrix;
    vN = normalize(mat3(mv) * normal);
    vUv2 = uv;
    vSlot = aSlot;
    gl_Position = projectionMatrix * mv * vec4(position, 1.0);
  }
`;

export const flyerFrag = /* glsl */ `
  ${COMMON}
  uniform vec2 uRes;
  uniform float uEdges;
  varying vec3 vN;
  varying vec2 vUv2;
  varying float vSlot;
  void main() {
    if (comicAt(gl_FragCoord.xy / uRes) < 0.5) discard;
    vec3 base = cycled(vSlot, vSlot * 0.37);
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float d = dot(n, normalize(vec3(-0.45, 0.75, 0.5)));
    vec3 c = d > 0.5 ? mix(base, vec3(1.0), 0.32) : d > -0.05 ? base : mix(base, uPal[6], 0.5);
    if (uEdges > 0.5) {
      float e = min(min(vUv2.x, 1.0 - vUv2.x), min(vUv2.y, 1.0 - vUv2.y));
      c = mix(c, uPal[6], 1.0 - smoothstep(0.045, 0.075, e));
    }
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Shards flying off the wipe's edge: small screen-space triangles. */
export const shardVert = /* glsl */ `
  uniform float uAspect;
  uniform vec3 uPal[${PAL_SIZE}];
  attribute vec4 aP;   // x, y (uv), turn, size (screen heights)
  attribute vec4 aC;   // palette index, alpha, stretch, -
  varying vec3 vCol;
  varying float vA;
  void main() {
    vec2 v = position.xy * vec2(aC.z, 1.0) * aP.w;
    float c = cos(aP.z), s = sin(aP.z);
    v = mat2(c, -s, s, c) * v;
    vec2 uv = aP.xy + v / vec2(uAspect, 1.0);
    vCol = uPal[int(aC.x + 0.5)];
    vA = aC.y;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  }
`;

export const shardFrag = /* glsl */ `
  varying vec3 vCol;
  varying float vA;
  void main() {
    gl_FragColor = vec4(vCol * vA, vA);
    #include <colorspace_fragment>
  }
`;

/** Sound-effect lettering: pieces of the painted atlas, only in the comic world. */
export const letterVert = /* glsl */ `
  uniform float uAspect;
  attribute vec4 aPos;   // x, y (uv), turn, -
  attribute vec4 aSize;  // width, height (screen heights), alpha, -
  attribute vec4 aRect;  // atlas uv rectangle
  varying vec2 vTex;
  varying vec2 vScreen;
  varying float vA;
  void main() {
    vec2 q = position.xy;
    vec2 v = q * aSize.xy;
    float c = cos(aPos.z), s = sin(aPos.z);
    v = vec2(c * v.x - s * v.y, s * v.x + c * v.y);
    vec2 uv = aPos.xy + v / vec2(uAspect, 1.0);
    vScreen = uv;
    vTex = mix(aRect.xy, aRect.zw, q + 0.5);
    vA = aSize.z;
    gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  }
`;

export const letterFrag = /* glsl */ `
  ${COMMON}
  uniform sampler2D uAtlas;
  varying vec2 vTex;
  varying vec2 vScreen;
  varying float vA;
  void main() {
    if (vA <= 0.001 || comicAt(vScreen) < 0.5) discard;
    vec4 t = texture2D(uAtlas, vTex);
    float a = t.a * vA;
    if (a < 0.003) discard;
    gl_FragColor = vec4(t.rgb * a, a);
    #include <colorspace_fragment>
  }
`;
