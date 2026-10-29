// Development only (Scene.tsx lazy-loads this behind a NODE_ENV check):
//   W  wipe the comic world in or out (an animated sweep)
//   P  next palette
//   M  pretend big movement (press again for the measured movement)
//
// Also `window.__comic` for scripted checks: `phase`, `palette`, `motion`,
// `swipe` (the swipe detector's numbers), `log` (every wipe), `state`, and
// `wipe(dir?)`, `setPalette(i)`, `setMotion(v | null)`.
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { beginWipe, showPalette } from "./actions";
import { PALETTES } from "./palettes";
import { comicState } from "./state";

const now = () => performance.now() / 1000;

/** W: in from the left, out to the left (or `dir`). */
const wipe = (dir?: 1 | -1) =>
  beginWipe(
    dir ?? (comicState.wipe.phase === "normal" ? 1 : -1),
    "key",
    null,
    now(),
  );

const debug = {
  state: comicState,
  get phase() {
    return comicState.wipe.phase;
  },
  get palette() {
    return PALETTES[comicState.palette].name;
  },
  get motion() {
    const s = comicState;
    return {
      level: s.motion.level,
      raw: s.motion.raw,
      energy: s.energy,
      palmSpeed: s.palmSpeed,
      light: s.motion.light,
      fake: s.devMotion,
      sfx: s.sfxCount,
    };
  },
  get swipe() {
    const d = comicState.swipe;
    return {
      armed: d.armed,
      last: d.last,
      hands: comicState.hands,
      tracks: d.tracks.map((t) => ({ id: t.id, samples: t.samples.length })),
      ...d.probe,
      leaderX: comicState.leaderX,
    };
  },
  get log() {
    return comicState.log;
  },
  wipe,
  setPalette: (i: number) => showPalette(i),
  setMotion: (v: number | null) => {
    comicState.devMotion = v;
  },
};

const DevKeys = () => {
  const gl = useThree((st) => st.gl);
  useEffect(() => {
    (window as unknown as { __comic?: unknown }).__comic = Object.assign(
      debug,
      { gl },
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "w") wipe();
      else if (k === "p") {
        showPalette(comicState.palette + 1);
        comicState.nextPalette = (comicState.palette + 1) % PALETTES.length;
      } else if (k === "m")
        comicState.devMotion = comicState.devMotion === null ? 1 : null;
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      delete (window as unknown as { __comic?: unknown }).__comic;
    };
  }, [gl]);
  return null;
};

export default DevKeys;
