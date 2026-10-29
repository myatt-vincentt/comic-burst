// The only hint, wordless: a small see-through ghost hand low in the centre
// (the SDK's HandGestureHint, open palm), sweeping sideways across, one way
// and then the other. It shows after a moment, steps aside while the comic
// world is on, and goes for good once a real hand or finger has wiped the
// world in.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { defineGltfAsset, useXRAsset } from "@vincentt-xr/sdk";
import { HandGestureHint } from "@vincentt-xr/sdk/instructions";

import { comicState } from "./state";

const HINT = {
  /** Seconds after the start before it shows, and fade times. */
  delay: 1.2,
  fade: 0.3,
  /** Low centre (world units at the camera's z = 0 plane). */
  y: -1.25,
  height: 0.46,
  /** How far each side the sweep goes. */
  reach: 0.55,
  renderOrder: 40,
};

/** One sweep: fade in, sweep across, hold, fade out, rest (seconds). */
const SWEEP = { in: 0.3, move: 0.9, hold: 0.25, out: 0.3, rest: 0.45 };
const PERIOD = SWEEP.in + SWEEP.move + SWEEP.hold + SWEEP.out + SWEEP.rest;

const handAsset = defineGltfAsset("/models/hand-v1.glb");
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;

const LOOK = { halo: false as const, glow: false as const };

export const Hint = () => {
  const { value: hand } = useXRAsset(handAsset);
  const g = useRef<Group>(null);
  const t0 = useRef(-1);
  const shown = useRef(0);
  const done = useRef(false);

  useFrame((state, rawDt) => {
    const o = g.current;
    if (!o || done.current) return;
    const dt = Math.min(rawDt, 0.1);
    const t = state.clock.elapsedTime;
    if (t0.current < 0) t0.current = t;
    const age = t - t0.current - HINT.delay;
    // Wanted: after the delay, while the room shows, until the first real wipe.
    const want =
      age > 0 && comicState.wipe.phase === "normal" && !comicState.played
        ? 1
        : 0;
    const step = dt / HINT.fade;
    shown.current = want
      ? Math.min(1, shown.current + step)
      : Math.max(0, shown.current - step);
    if (comicState.played && shown.current <= 0) {
      done.current = true;
      o.visible = false;
      return;
    }
    // The sweep, alternating direction each time.
    const cyc = Math.max(0, age) / PERIOD;
    const dir = Math.floor(cyc) % 2 === 0 ? 1 : -1;
    const s = (cyc % 1) * PERIOD;
    const move = easeOut((s - SWEEP.in) / SWEEP.move);
    const fadeIn = easeOut(s / SWEEP.in);
    const fadeOut =
      1 - easeOut((s - SWEEP.in - SWEEP.move - SWEEP.hold) / SWEEP.out);
    const k = easeOut(shown.current) * Math.min(fadeIn, fadeOut);
    o.position.x = dir * HINT.reach * (2 * move - 1);
    o.rotation.z = -dir * 0.18 * (1 - move);
    o.visible = k > 0.001;
    o.scale.setScalar(Math.max(1e-4, k));
  });

  if (!hand) return null;
  return (
    <group ref={g} position={[0, HINT.y, 0]} visible={false}>
      <HandGestureHint
        gesture="palm"
        model={hand.scene}
        poses={hand.animations}
        height={HINT.height}
        look={LOOK}
        orbit={0}
        renderOrder={HINT.renderOrder}
      />
    </group>
  );
};
