// Comic Burst: swipe a hand sideways across the screen and the room wipes
// into a pop-art comic world behind your hand — you become a flat, posterised
// cut-out with a thick two-colour rim, in front of burst rays, halftone dots,
// big angular shapes and tumbling 3D cubes and shards. Move and it all
// answers: the bursts flare, shapes pulse, cubes spin faster and the colours
// slowly shift. Swipe again (either way) to wipe back to the room. On a
// touch screen a finger swipe does the same. Each new wipe-in takes the next
// of four palettes.
//
// This file is the driver (useFrame priority -1, before every layer): it
// reads the hands, the face and the touches, runs the swipe and the wipe,
// measures movement, and writes the shared uniforms. Positions are screen
// uv; tracker points map straight onto it because the camera picture fills
// the screen (and is already mirrored for the webcam, so the wipe follows
// the hand you see).
import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { XRModel } from "@vincentt-xr/sdk";
import {
  useXRModelNode,
  type XRModelNodeHandTracking,
} from "@vincentt-xr/sdk/low-level";
import { HandTracker, useFaceInfo } from "@vincentt-xr/sdk/tracking";

import { beginWipe } from "./actions";
import { FACE_FPS, HAND, MOTION, PERSON, TOUCH } from "./config";
import { EdgeShards } from "./EdgeShards";
import { Flyers } from "./Flyers";
import { Hint } from "./Hint";
import { Lettering } from "./Lettering";
import { World } from "./World";
import { buildCapsules, createCapsules } from "./sim/gate";
import { stepMotion } from "./sim/motion";
import { fastestPalm, stepSwipe, trackX } from "./sim/swipe";
import { stepWipe, wipeUniform } from "./sim/wipe";
import { comicState } from "./state";
import { gate, shared } from "./uniforms";

/** MediaPipe hand joints for the palm centre. */
const PALM = [0, 5, 9, 13, 17];
const capsules = createCapsules();

/** A finger swipe on a touch screen (read in the driver). */
const touch = {
  id: -1,
  x0: 0,
  y0: 0,
  t0: 0,
  x: 0,
  fired: false,
  pending: null as null | { dir: 1 | -1; x: number },
};

/** The face's bounds, for where a person can be and where the bursts come from. */
const FaceGate = () => {
  const face = useFaceInfo({ targetFps: FACE_FPS });
  useEffect(() => {
    const b = face?.bounds;
    comicState.face = b
      ? { x: b.centerX, y: 1 - b.centerY, w: b.width, h: b.height }
      : null;
    if (b) comicState.faceSeen = performance.now() / 1000;
  }, [face]);
  return null;
};

/** Finger swipes: sideways, quick, clearly more sideways than up or down. */
const TouchSwipe = () => {
  useEffect(() => {
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || touch.id >= 0) return;
      touch.id = e.pointerId;
      touch.x0 = e.clientX / window.innerWidth;
      touch.y0 = e.clientY / window.innerHeight;
      touch.x = touch.x0;
      touch.t0 = performance.now() / 1000;
      touch.fired = false;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== touch.id) return;
      touch.x = e.clientX / window.innerWidth;
      if (touch.fired) return;
      const dx = touch.x - touch.x0;
      const dy = e.clientY / window.innerHeight - touch.y0;
      const quick = performance.now() / 1000 - touch.t0 <= TOUCH.time;
      if (
        quick &&
        Math.abs(dx) >= TOUCH.travel &&
        Math.abs(dx) >= TOUCH.ratio * Math.abs(dy)
      ) {
        touch.fired = true;
        touch.pending = { dir: dx > 0 ? 1 : -1, x: touch.x };
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== touch.id) return;
      touch.id = -1;
      if (comicState.leader?.kind === "touch") comicState.leader = null;
    };
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  return null;
};

export const ComicScene = () => {
  const handsNode = useXRModelNode<XRModelNodeHandTracking>(
    XRModel.HAND_TRACKER,
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const now = state.clock.elapsedTime;
    const s = comicState;
    const { width, height } = state.size;
    const aspect = width / Math.max(1, height);
    shared.uAspect.value = aspect;
    shared.uTime.value = now;
    shared.uPx.value = 1 / Math.max(1, height);
    state.gl.getDrawingBufferSize(shared.uRes.value);

    // The hands: screen uv, eased a little for the person outline.
    const node = handsNode;
    const raw = node?.hands?.length
      ? node.hands.map((h) => h.coordinates)
      : [node?.coordinates];
    const hands = raw.filter(
      (c): c is NonNullable<typeof c> => !!c && c.length >= 21,
    );
    s.hands = hands.length;
    const prev = s.handPts;
    const ease = 1 - Math.exp(-18 * dt);
    s.handPts = hands.map((pts) => {
      const uv = pts.map((p) => ({ x: p.x * 0.5 + 0.5, y: p.y * 0.5 + 0.5 }));
      const last = prev.find(
        (p) => Math.hypot(p[0].x - uv[0].x, p[0].y - uv[0].y) < 0.15,
      );
      if (!last) return uv;
      return uv.map((p, j) => ({
        x: last[j].x + (p.x - last[j].x) * ease,
        y: last[j].y + (p.y - last[j].y) * ease,
      }));
    });
    const palms = hands.map((pts) => {
      const x = PALM.reduce((sum, i) => sum + pts[i].x, 0) / PALM.length;
      const y = PALM.reduce((sum, i) => sum + pts[i].y, 0) / PALM.length;
      return { x: x * 0.5 + 0.5, y: y * 0.5 + 0.5 };
    });

    // A swipe (hand or finger) starts a wipe the other way round.
    const swipe = stepSwipe(s.swipe, palms, now);
    if (swipe)
      beginWipe(swipe.dir, "hand", { kind: "hand", id: swipe.track }, now);
    if (touch.pending) {
      const { dir, x } = touch.pending;
      touch.pending = null;
      beginWipe(dir, "touch", { kind: "touch", x }, now);
    }

    // The running wipe follows whatever leads it.
    let leaderX: number | null = null;
    if (s.leader?.kind === "hand") leaderX = trackX(s.swipe, s.leader.id, now);
    else if (s.leader?.kind === "touch") leaderX = touch.x;
    s.leaderX = leaderX;
    if (stepWipe(s.wipe, dt, leaderX)) {
      s.leader = null;
      if (s.wipe.phase === "comic") s.arrived = 0;
    }
    s.arrived += dt;
    shared.uWipe.value.set(...wipeUniform(s.wipe));

    // Movement: the frame difference and the fastest palm, plus a burst of
    // energy as the world arrives.
    s.palmSpeed = fastestPalm(s.swipe, now);
    const level = stepMotion(s.motion, s.palmSpeed, dt);
    const measured = s.devMotion ?? level;
    const arrive = MOTION.arrive * Math.exp(-s.arrived * MOTION.arriveFade);
    s.energy = Math.min(1, measured + arrive);
    shared.uEnergy.value = s.energy;
    s.cycle += dt * (0.02 + MOTION.cycle * s.energy);
    shared.uCycle.value = s.cycle;
    shared.uSpin.value += dt * (0.04 + 0.55 * s.energy);
    shared.uPulse.value += dt * (1.1 + 2.0 * s.energy);

    // Where a person can be: the tracked face (held for a moment when lost)
    // and hands (see sim/gate.ts).
    buildCapsules(capsules, s.handPts, [], aspect);
    for (let i = 0; i < capsules.count; i += 1) {
      gate.uCap.value[i].fromArray(capsules.seg, i * 4);
      gate.uCapR.value[i] = capsules.radius[i];
    }
    gate.uCapCount.value = capsules.count;
    const face = gate.uFace.value;
    const lostFor = performance.now() / 1000 - s.faceSeen;
    if (s.face) {
      const k = face.z > 0 ? 1 - Math.exp(-12 * dt) : 1;
      face.x += (s.face.x - face.x) * k;
      face.y += (s.face.y - face.y) * k;
      face.z += (s.face.w - face.z) * k;
      face.w += (s.face.h - face.w) * k;
    } else if (lostFor > PERSON.faceHold) {
      face.set(0, 0, 0, 0);
    }
    gate.uTrustAll.value = lostFor > PERSON.faceHold ? 1 : 0;

    // The bursts come from behind your head.
    const c = shared.uBurstC.value;
    const tx = face.z > 0 ? face.x : 0.5;
    const ty = face.z > 0 ? face.y - 0.02 : 0.55;
    const kc = 1 - Math.exp(-2.5 * dt);
    c.x += (tx - c.x) * kc;
    c.y += (ty - c.y) * kc;
  }, -1);

  return (
    <>
      <HandTracker targetFps={HAND.fps} />
      <FaceGate />
      <TouchSwipe />
      <World />
      <Flyers />
      <Lettering />
      <EdgeShards />
      <Hint />
    </>
  );
};
