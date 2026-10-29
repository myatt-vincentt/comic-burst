import { describe, expect, it } from "vitest";

import { WIPE } from "../config";
import { createWipe, isComic, startWipe, stepWipe, wipeUniform } from "./wipe";

const finish = (w: ReturnType<typeof createWipe>, leader: number | null) => {
  let t = 0;
  while (t < 5 && !stepWipe(w, 1 / 60, leader)) t += 1 / 60;
  return t;
};

describe("wipe", () => {
  it("wipes in, then out, then in again", () => {
    const w = createWipe();
    expect(startWipe(w, 1)).toBe(true);
    expect(w.phase).toBe("in");
    expect(isComic(w)).toBe(true);
    expect(finish(w, null)).toBeLessThan(WIPE.auto + 0.6);
    expect(w.phase).toBe("comic");
    expect(startWipe(w, -1)).toBe(true);
    expect(w.phase).toBe("out");
    finish(w, null);
    expect(w.phase).toBe("normal");
    startWipe(w, 1);
    expect(w.count).toBe(2);
  });

  it("ignores a new swipe while one is running", () => {
    const w = createWipe();
    startWipe(w, 1);
    expect(startWipe(w, -1)).toBe(false);
    expect(w.dir).toBe(1);
  });

  it("follows a hand that leads, and never goes back", () => {
    const w = createWipe();
    startWipe(w, 1);
    for (let i = 0; i < 20; i += 1) stepWipe(w, 1 / 60, 0.7);
    expect(w.edge).toBeGreaterThan(0.6);
    const at = w.edge;
    stepWipe(w, 1 / 60, 0.1);
    expect(w.edge).toBeGreaterThanOrEqual(at);
  });

  it("parks the edge off-screen outside a wipe", () => {
    const w = createWipe();
    expect(wipeUniform(w).slice(0, 3)).toEqual([10, 1, 0]);
    startWipe(w, -1);
    expect(wipeUniform(w)[2]).toBe(1);
    finish(w, null);
    expect(wipeUniform(w).slice(0, 3)).toEqual([10, 1, 1]);
  });
});
