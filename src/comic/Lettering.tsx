// Manga sound-effect lettering in the comic world (words.ts paints the
// words, sim/sfx.ts decides when and where): words pop up behind you and,
// near the screen's edges, one or two in front — never over your face. The
// wipe-in shouts a big one from the wipe's edge; movement brings more,
// louder and bigger ones. A few small vertical lines of panel text sit in
// the background. The font ships with the app (public/fonts, SIL OFL).
import { useEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  CustomBlending,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SRGBColorSpace,
} from "three";
import { useFrame } from "@react-three/fiber";

import {
  FONT_FAMILY,
  FONT_URL,
  paintAtlas,
  WIPE_WORDS,
  WORDS,
  type Cell,
} from "./words";
import { STATS } from "./config";
import { PALETTES } from "./palettes";
import { letterFrag, letterVert } from "./shaders";
import {
  createSfx,
  look,
  place,
  resetPanels,
  SFX,
  stepSfx,
  type Scene,
  type Sfx,
  type WordInfo,
} from "./sim/sfx";
import { comicState } from "./state";
import { gate, shared } from "./uniforms";

const CAPACITY = SFX.max + SFX.panels;

/** How much of a box (uv, y up) is you, from the small read-back (green: the mask). */
const personCover = (
  px: Uint8Array | null,
  b: { x: number; y: number; w: number; h: number },
) => {
  if (!px) return 0;
  const W = STATS.width;
  const H = STATS.height;
  let on = 0;
  let n = 0;
  for (let j = 0; j < 5; j += 1) {
    for (let i = 0; i < 7; i += 1) {
      const u = b.x + (i / 6 - 0.5) * b.w;
      const v = b.y + (j / 4 - 0.5) * b.h;
      const x = Math.min(W - 1, Math.max(0, Math.floor(u * W)));
      const y = Math.min(H - 1, Math.max(0, Math.floor(v * H)));
      on += px[(y * W + x) * 4 + 1] / 255;
      n += 1;
    }
  }
  return on / n;
};

const makeLayer = (material: ShaderMaterial) => {
  const g = new InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new Float32BufferAttribute(
      [
        -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0,
        -0.5, 0.5, 0,
      ],
      3,
    ),
  );
  g.setAttribute(
    "aPos",
    new InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4),
  );
  g.setAttribute(
    "aSize",
    new InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4),
  );
  g.setAttribute(
    "aRect",
    new InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4),
  );
  g.instanceCount = CAPACITY;
  return { geometry: g, material };
};

/** Write one layer's words into its instance buffers. */
const fill = (
  geometry: InstancedBufferGeometry,
  list: Sfx[],
  cells: Cell[],
) => {
  const pos = geometry.getAttribute("aPos") as InstancedBufferAttribute;
  const size = geometry.getAttribute("aSize") as InstancedBufferAttribute;
  const rect = geometry.getAttribute("aRect") as InstancedBufferAttribute;
  for (let i = 0; i < CAPACITY; i += 1) {
    const it = list[i];
    const c = it ? cells[it.word] : null;
    if (!it || !c) {
      size.setXYZW(i, 0, 0, 0, 0);
    } else {
      const { scale, alpha } = look(it);
      pos.setXYZW(i, it.x, it.y, it.turn, 0);
      size.setXYZW(i, c.w * it.em * scale, c.h * it.em * scale, alpha, 0);
      rect.setXYZW(i, c.u0, c.v0, c.u1, c.v1);
    }
  }
  pos.needsUpdate = true;
  size.needsUpdate = true;
  rect.needsUpdate = true;
};

export const Lettering = () => {
  const sfx = useMemo(() => createSfx(), []);
  const atlas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 4;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    return { canvas, texture, cells: [] as Cell[], palette: -1, ready: false };
  }, []);
  const layers = useMemo(() => {
    const material = () =>
      new ShaderMaterial({
        uniforms: { ...shared, uAtlas: { value: atlas.texture } },
        vertexShader: letterVert,
        fragmentShader: letterFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneMinusSrcAlphaFactor,
      });
    return { back: makeLayer(material()), front: makeLayer(material()) };
  }, [atlas]);
  const seen = useRef({ count: 0, shouted: true });

  // The font ships with the app; nothing shows until it has loaded.
  useEffect(() => {
    let live = true;
    const face = new FontFace(FONT_FAMILY, `url(${FONT_URL})`);
    face
      .load()
      .then((f) => {
        if (!live) return;
        document.fonts.add(f);
        atlas.ready = true;
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [atlas]);

  useEffect(
    () => () => {
      atlas.texture.dispose();
      Object.values(layers).forEach((l) => {
        l.geometry.dispose();
        l.material.dispose();
      });
    },
    [atlas, layers],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = comicState;
    const { wipe } = s;
    const on = wipe.phase !== "normal" && atlas.ready;
    if (!on) {
      sfx.items = [];
      layers.back.geometry.instanceCount = 0;
      layers.front.geometry.instanceCount = 0;
      return;
    }
    // Repaint the words in this palette's colours.
    if (atlas.palette !== s.palette) {
      atlas.cells = paintAtlas(atlas.canvas, PALETTES[s.palette]);
      atlas.palette = s.palette;
      atlas.texture.dispose();
      atlas.texture.needsUpdate = true;
    }
    const words: WordInfo[] = WORDS.map((w, i) => ({
      mood: w.mood,
      panel: w.panel,
      w: atlas.cells[i]?.w ?? 1,
      h: atlas.cells[i]?.h ?? 1,
    }));
    const f = gate.uFace.value;
    const scene: Scene = {
      words,
      aspect: shared.uAspect.value,
      face: f.z > 0 ? { x: f.x, y: f.y + 0.05 * f.w, w: f.z, h: f.w } : null,
      cover: (b) => personCover(s.motion.prev, b),
      rnd: Math.random,
    };

    // A new wipe-in: fresh panel text, and a big word from the edge once it
    // has come a little way in.
    if (wipe.count !== seen.current.count && wipe.phase === "in") {
      seen.current = { count: wipe.count, shouted: false };
      resetPanels(sfx, scene);
    }
    const along = wipe.dir > 0 ? wipe.edge : 1 - wipe.edge;
    if (!seen.current.shouted && (wipe.phase === "comic" || along > 0.22)) {
      seen.current.shouted = true;
      const x = wipe.phase === "comic" ? 0.5 : wipe.edge - 0.06 * wipe.dir;
      // Away from the face: below it, above it, or level with it.
      const fy = scene.face ? scene.face.y : 0.65;
      const ys = [0.16, 0.84, 0.5].sort(
        (a, b) => Math.abs(b - fy) - Math.abs(a - fy),
      );
      const big = WIPE_WORDS[Math.floor(Math.random() * WIPE_WORDS.length)];
      let placed: Sfx | null = null;
      ys.some((y) => {
        placed =
          place(sfx, big, 0.15, true, scene, { x, y }) ??
          place(sfx, big, 0.15, false, scene, { x, y });
        return placed !== null;
      });
      if (placed) sfx.items.push(placed);
    }
    stepSfx(sfx, dt, s.energy, scene);

    const back = [...sfx.panels, ...sfx.items.filter((it) => !it.front)];
    const front = sfx.items.filter((it) => it.front);
    fill(layers.back.geometry, back, atlas.cells);
    fill(layers.front.geometry, front, atlas.cells);
    layers.back.geometry.instanceCount = CAPACITY;
    layers.front.geometry.instanceCount = CAPACITY;
    s.sfxCount = sfx.items.length;
  });

  return (
    <>
      <mesh
        name="lettering-back"
        geometry={layers.back.geometry}
        material={layers.back.material}
        renderOrder={-985}
        frustumCulled={false}
      />
      <mesh
        name="lettering-front"
        geometry={layers.front.geometry}
        material={layers.front.material}
        renderOrder={6}
        frustumCulled={false}
      />
    </>
  );
};
