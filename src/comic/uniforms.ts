// The uniforms every layer shares (the same objects in each material),
// written once a frame by the driver. See shaders.ts for what each holds.
import { Vector2, Vector3, Vector4 } from "three";

import { MAX_CAPSULES } from "./sim/gate";
import { PAL_SIZE, PALETTES, toLinear } from "./palettes";

export const shared = {
  uAspect: { value: 1 },
  uTime: { value: 0 },
  /** The wipe: edge x (uv), direction, 1 if the comic world is behind the edge, seed. */
  uWipe: { value: new Vector4(10, 1, 0, 0) },
  /** The palette, linear: see palettes.ts for the order. */
  uPal: {
    value: toLinear(PALETTES[0]).map((c) => new Vector3(c.r, c.g, c.b)),
  },
  /** Movement energy 0..1 (with the arrival burst). */
  uEnergy: { value: 0 },
  /** The colour cycle so far. */
  uCycle: { value: 0 },
  /** The burst rays' turn, and the pulse's phase (radians). */
  uSpin: { value: 0 },
  uPulse: { value: 0 },
  /** Where the bursts come from (uv): behind the person's head. */
  uBurstC: { value: new Vector2(0.5, 0.55) },
  /** One screen pixel, in screen heights. */
  uPx: { value: 1 / 800 },
  /** The drawing buffer's size in pixels (for gl_FragCoord). */
  uRes: { value: new Vector2(1, 1) },
};

if (shared.uPal.value.length !== PAL_SIZE) throw new Error("palette size");

/** Where a person can be (see sim/gate.ts), written by the driver. */
export const gate = {
  uCap: { value: Array.from({ length: MAX_CAPSULES }, () => new Vector4()) },
  uCapR: { value: new Array<number>(MAX_CAPSULES).fill(0) },
  uCapCount: { value: 0 },
  /** The face: centre x, y (uv, y up), width, height (uv); width 0 = no face. */
  uFace: { value: new Vector4() },
  /** 1 when no face has been seen for a while: trust the mask everywhere. */
  uTrustAll: { value: 0 },
};

/** The camera picture and the person mask, shared the same way. */
export const media = {
  uCam: { value: null as unknown },
  uCamLinear: { value: 0 },
  uCamTexel: { value: new Vector2(1 / 720, 1 / 1280) },
  uMask: { value: null as unknown },
  /** The person's brightness: mean, spread (from the read-back). */
  uLight: { value: new Vector2(0.45, 0.18) },
};
