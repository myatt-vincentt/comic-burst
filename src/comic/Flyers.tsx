// Tumbling 3D cubes, long shards and confetti triangles flying out of the
// burst toward you, flat toon-shaded in the palette, only where the comic
// world shows. Cubes and shards pass behind you; some confetti flies in
// front.
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import { useFrame } from "@react-three/fiber";

import { FLYERS } from "./config";
import { flyerFrag, flyerVert } from "./shaders";
import {
  createFlyers,
  stepFlyers,
  type Flyer,
  type FlyerKind,
} from "./sim/flyers";
import { comicState } from "./state";
import { shared } from "./uniforms";

const KINDS: Record<"cube" | "shard" | "confetti", FlyerKind> = {
  cube: { size: [0.22, 0.5], flutter: 0 },
  shard: { size: [0.16, 0.34], flutter: 0 },
  confetti: { size: [0.05, 0.11], flutter: 0.35 },
};
/** Shards are long and thin. */
const SHARD_SCALE = new Vector3(0.35, 1.7, 0.35);

const triangle = () => {
  const g = new BufferGeometry();
  g.setAttribute(
    "position",
    new Float32BufferAttribute([0, 1, 0, -0.87, -0.5, 0, 0.87, -0.5, 0], 3),
  );
  g.setAttribute(
    "normal",
    new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
  );
  g.setAttribute("uv", new Float32BufferAttribute([0.5, 1, 0, 0, 1, 0], 2));
  return g;
};

const material = (edges: boolean, transparent: boolean) =>
  new ShaderMaterial({
    uniforms: { ...shared, uEdges: { value: edges ? 1 : 0 } },
    vertexShader: flyerVert,
    fragmentShader: flyerFrag,
    side: DoubleSide,
    transparent,
    toneMapped: false,
  });

type Group = {
  mesh: InstancedMesh;
  list: Flyer[];
  kind: FlyerKind;
  scale: Vector3 | null;
};

const makeGroup = (
  geometry: BufferGeometry,
  mat: ShaderMaterial,
  n: number,
  kind: FlyerKind,
  scale: Vector3 | null,
  renderOrder: number,
): Group => {
  const list = createFlyers(n, kind, 1);
  const slots = new Float32Array(n);
  list.forEach((f, i) => {
    slots[i] = f.slot;
  });
  geometry.setAttribute("aSlot", new InstancedBufferAttribute(slots, 1));
  const mesh = new InstancedMesh(geometry, mat, n);
  mesh.frustumCulled = false;
  mesh.renderOrder = renderOrder;
  return { mesh, list, kind, scale };
};

const m4 = new Matrix4();
const q = new Quaternion();
const axis = new Vector3();
const pos = new Vector3();
const scl = new Vector3();

export const Flyers = () => {
  const groups = useMemo(() => {
    const nFront = Math.round(FLYERS.confetti * FLYERS.front);
    return [
      makeGroup(
        new BoxGeometry(1, 1, 1),
        material(true, false),
        FLYERS.cubes,
        KINDS.cube,
        null,
        -990,
      ),
      makeGroup(
        new OctahedronGeometry(1, 0),
        material(false, false),
        FLYERS.shards,
        KINDS.shard,
        SHARD_SCALE,
        -990,
      ),
      makeGroup(
        triangle(),
        material(false, false),
        FLYERS.confetti - nFront,
        KINDS.confetti,
        null,
        -990,
      ),
      // In front of you: drawn after the cut-out.
      makeGroup(
        triangle(),
        material(false, true),
        nFront,
        KINDS.confetti,
        null,
        5,
      ),
    ];
  }, []);

  useEffect(
    () => () => {
      groups.forEach((g) => {
        g.mesh.geometry.dispose();
        (g.mesh.material as ShaderMaterial).dispose();
        g.mesh.dispose();
      });
    },
    [groups],
  );

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { wipe, energy } = comicState;
    const on = wipe.phase !== "normal";
    const { width, height } = state.size;
    const aspect = width / Math.max(1, height);
    const c = shared.uBurstC.value;
    // Calm: a slow drift. Big movement: they rush out and spin fast.
    const speed = 0.55 + 3.4 * energy;
    const spinRate = 1 + 3.5 * energy;
    const pulse = 1 + 0.15 * energy * Math.sin(shared.uPulse.value * 1.4);
    groups.forEach(({ mesh, list, kind, scale }) => {
      const m = mesh;
      m.visible = on;
      if (!on) return;
      stepFlyers(list, kind, dt, speed, spinRate, c, aspect);
      list.forEach((f, i) => {
        axis.set(f.ax, f.ay, f.az);
        q.setFromAxisAngle(axis, f.angle);
        const flutter = f.flutter * Math.sin(f.phase);
        pos.set(f.x + flutter * 0.4, f.y + flutter * 0.25, f.z);
        const s = f.size * pulse;
        if (scale) scl.copy(scale).multiplyScalar(s);
        else scl.setScalar(s);
        m4.compose(pos, q, scl);
        m.setMatrixAt(i, m4);
      });
      m.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <>
      {groups.map((g, i) => (
        // eslint-disable-next-line react/no-array-index-key -- fixed list
        <primitive key={i} object={g.mesh} />
      ))}
    </>
  );
};
