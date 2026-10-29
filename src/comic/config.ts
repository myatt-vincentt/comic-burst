// Comic Burst tuning. Positions are screen uv (0..1, y up); sizes are
// fractions of the screen width unless noted; times are seconds.

/** How the hand is read. */
export const HAND = {
  /** Hand tracking rate (fps). */
  fps: 20,
};

/** Face tracking rate (fps): only to know where the person is. */
export const FACE_FPS = 15;

/** The hand swipe that wipes the world in or out. */
export const SWIPE = {
  /** The latest one-way run is measured over at most this long... */
  window: 0.5,
  /** ...and must cover at least this much of the screen's width... */
  travel: 0.33,
  /** ...at least this fast on average (screen widths per second)... */
  speed: 0.75,
  /** ...mostly sideways (vertical travel at most this share of it)... */
  level: 0.7,
  /** ...and start from rest: in the `before` seconds ahead of it the hand
   * may have gone the other way by at most `backAllowed` (a wave turns back). */
  before: 0.6,
  backAllowed: 0.06,
  /** Steps smaller than this (screen widths) are tracking noise. */
  noise: 0.012,
  /** After a swipe, the hand must slow below this before another counts. */
  rearmSpeed: 0.35,
  /** And at least this long must pass before the next one. */
  cooldown: 0.9,
  /** A palm further than this from where a hand was is another hand. */
  jump: 0.2,
  /** A hand unseen this long is gone. */
  lost: 0.3,
  /** The first moments of a newly found hand don't count (it settles). */
  settle: 0.1,
};

/** A finger swipe on a touch screen does the same. */
export const TOUCH = {
  /** Sideways distance (screen widths) before it counts, within `time`. */
  travel: 0.12,
  time: 0.8,
  /** It must be at least this much more sideways than up or down. */
  ratio: 1.5,
};

/** The wipe between the room and the comic world. */
export const WIPE = {
  /** Where the edge starts and ends (past the screen, for the jagged edge). */
  from: -0.28,
  to: 1.28,
  /** Seconds the wipe takes on its own when the hand stops leading it. */
  auto: 1.15,
  /** How quickly the edge catches up with the hand (per second). */
  follow: 11,
  /** The edge runs this far ahead of the hand. */
  lead: 0.02,
};

/** How much the person moves, and how the world answers. */
export const MOTION = {
  /** Frame difference below this is camera noise; at `full` it is big movement. */
  floor: 0.018,
  full: 0.11,
  /** Palm speed (screen widths per second) for no and full motion. */
  handFrom: 0.5,
  handFull: 2.2,
  /** How quickly the level rises and settles (per second). */
  rise: 3.2,
  fall: 0.9,
  /** Colour cycles per second at full motion (kept slow: no flashing). */
  cycle: 0.55,
  /** The extra energy when the world arrives, and how fast it settles. */
  arrive: 0.7,
  arriveFade: 1.6,
};

/** The steadied person mask: size (share of the screen) and how fast it follows (per second). */
export const PERSON = {
  scale: 0.5,
  max: 720,
  rate: 14,
  /** Seconds a lost face still marks where the person is. */
  faceHold: 2,
};

/** The small read-back of the picture used for movement and light. */
export const STATS = {
  width: 64,
  height: 36,
  /** Read every this many frames. */
  every: 3,
};

/** The flying 3D pieces. */
export const FLYERS = {
  cubes: 14,
  shards: 12,
  confetti: 90,
  /** Share of the confetti drawn in front of the person. */
  front: 0.35,
};

/** Shard particles flying off the wipe's edge. */
export const EDGE_SHARDS = {
  max: 90,
  /** Pieces per second while the edge crosses the screen. */
  rate: 70,
};
