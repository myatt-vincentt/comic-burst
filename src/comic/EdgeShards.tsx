// Small sharp shards thrown off the wipe's jagged edge as it crosses the
// screen (sim/shards.ts), drawn on top of everything but the hint.
import { useEffect, useMemo } from "react";
import {
  CustomBlending,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
} from "three";
import { useFrame } from "@react-three/fiber";

import { EDGE_SHARDS } from "./config";
import { shardFrag, shardVert } from "./shaders";
import { createShards, shardScale, stepShards } from "./sim/shards";
import { comicState } from "./state";
import { shared } from "./uniforms";

export const EdgeShards = () => {
  const { list, geometry, material, budget } = useMemo(() => {
    const n = EDGE_SHARDS.max;
    const g = new InstancedBufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute([0, 0.6, 0, -0.5, -0.4, 0, 0.5, -0.4, 0], 3),
    );
    g.setAttribute(
      "aP",
      new InstancedBufferAttribute(new Float32Array(n * 4), 4),
    );
    g.setAttribute(
      "aC",
      new InstancedBufferAttribute(new Float32Array(n * 4), 4),
    );
    g.instanceCount = n;
    const m = new ShaderMaterial({
      uniforms: { uAspect: shared.uAspect, uPal: shared.uPal },
      vertexShader: shardVert,
      fragmentShader: shardFrag,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
    });
    return {
      list: createShards(n),
      geometry: g,
      material: m,
      budget: { carry: 0 },
    };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const { wipe } = comicState;
    const running = wipe.phase === "in" || wipe.phase === "out";
    stepShards(
      list,
      dt,
      running ? wipe.edge : null,
      wipe.dir,
      EDGE_SHARDS.rate,
      budget,
    );
    const p = geometry.getAttribute("aP") as InstancedBufferAttribute;
    const c = geometry.getAttribute("aC") as InstancedBufferAttribute;
    list.forEach((s, i) => {
      const k = shardScale(s);
      p.setXYZW(i, s.x, s.y, s.turn, s.size * k);
      c.setXYZW(i, s.col, Math.min(1, k * 1.6), s.stretch, 0);
    });
    p.needsUpdate = true;
    c.needsUpdate = true;
  });

  return (
    <mesh
      name="edge-shards"
      geometry={geometry}
      material={material}
      renderOrder={12}
      frustumCulled={false}
    />
  );
};
