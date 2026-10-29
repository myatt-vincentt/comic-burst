// Shared per-frame state: written by the driver in ComicScene.tsx (useFrame
// priority -1, before every layer), read by the layers.
import type { WebGLRenderTarget } from "three";

import { createMotion } from "./sim/motion";
import { createSwipe } from "./sim/swipe";
import { createWipe } from "./sim/wipe";

export type WipeSource = "hand" | "touch" | "key";

export const comicState = {
  wipe: createWipe(),
  swipe: createSwipe(),
  motion: createMotion(),
  /** Which palette is showing, and which the next wipe-in takes. */
  palette: 0,
  nextPalette: 0,
  /** What leads the running wipe: a tracked hand (its id), a finger, or nothing. */
  leader: null as
    | null
    | { kind: "hand"; id: number }
    | { kind: "touch"; x: number },
  /** The leader's x as last seen (screen uv), for the debug readout. */
  leaderX: null as number | null,
  /** Hands in view, and the fastest palm's speed (screen widths per second). */
  hands: 0,
  palmSpeed: 0,
  /** This frame's tracked hands (21 points each, screen uv), eased. */
  handPts: [] as Array<Array<{ x: number; y: number }>>,
  /** The tracked face (screen uv, y up) and when it was last seen. */
  face: null as null | { x: number; y: number; w: number; h: number },
  faceSeen: -1e9,
  /** The movement level the world answers to, 0..1 (after the dev override). */
  energy: 0,
  /** Seconds since the comic world arrived (for its arrival burst). */
  arrived: 1e9,
  /** The colour cycle so far (whole numbers are one shift of every colour). */
  cycle: 0,
  /** Sound-effect words up right now. */
  sfxCount: 0,
  /** Set once a real hand or finger has wiped the world in (the hint then goes). */
  played: false,
  /** Every wipe, for the debug readout: time, source, direction. */
  log: [] as Array<{ t: number; source: WipeSource; dir: number; to: string }>,
  /** The steadied person mask's latest buffer. */
  person: null as WebGLRenderTarget | null,
  /** Development only: pretend big movement (null = measured). */
  devMotion: null as number | null,
};
