// Starting a wipe, from a hand, a finger or a dev key, and showing a palette.
import { PALETTES, toLinear } from "./palettes";
import { startWipe } from "./sim/wipe";
import { comicState, type WipeSource } from "./state";
import { shared } from "./uniforms";

/** Show palette `i` (wraps round). */
export const showPalette = (i: number) => {
  const n = PALETTES.length;
  const k = ((i % n) + n) % n;
  comicState.palette = k;
  toLinear(PALETTES[k]).forEach((c, j) =>
    shared.uPal.value[j].set(c.r, c.g, c.b),
  );
};

/**
 * Wipe the other way round from now, travelling `dir` (+1 right, −1 left on
 * screen). A wipe into the comic world takes the next palette. Returns false
 * while a wipe is already running.
 */
export const beginWipe = (
  dir: 1 | -1,
  source: WipeSource,
  leader: typeof comicState.leader,
  now: number,
) => {
  const s = comicState;
  if (!startWipe(s.wipe, dir)) return false;
  if (s.wipe.phase === "in") {
    showPalette(s.nextPalette);
    s.nextPalette = (s.palette + 1) % PALETTES.length;
    if (source !== "key") s.played = true;
  }
  s.leader = leader;
  s.log.push({
    t: now,
    source,
    dir,
    to: s.wipe.phase === "in" ? "comic" : "normal",
  });
  if (s.log.length > 50) s.log.shift();
  return true;
};
