// The world and you. Drawn just above App.tsx's VideoBackground (GROUNDING.md,
// camera effects) and covering it:
//
//   renderOrder -998  world   — the camera picture, or the pop-art world
//                               where the comic world has wiped in
//   (opaque, between) flyers  — the 3D cubes and shards behind you (Flyers.tsx)
//   renderOrder -980  you     — the posterised cut-out with its rim
//   renderOrder 10    edge    — the wipe's jagged edge and stripes
//
// Off screen, two small passes: your outline, held steady over a few frames
// (only where a person really is: around the tracked face and hands), and
// a tiny copy of the picture read back now and then to measure how much
// you move and how bright you are.
import { useEffect, useMemo, useRef } from "react";
import {
  CustomBlending,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
  type Texture,
} from "three";
import { useFrame } from "@react-three/fiber";
import { usePersonMaskTexture } from "@vincentt-xr/sdk";
import { useXRCameraTexture } from "@vincentt-xr/sdk/low-level";

import { PERSON, STATS } from "./config";
import {
  edgeFrag,
  flatVert,
  personFrag,
  screenVert,
  statsFrag,
  steadyFrag,
  worldFrag,
} from "./shaders";
import { readFrame } from "./sim/motion";
import { comicState } from "./state";
import { gate, media, shared } from "./uniforms";

/** An off-screen pass: one full-screen quad, two textures swapped each frame. */
const makePass = (
  fragmentShader: string,
  uniforms: Record<string, { value: unknown }>,
  mips: boolean,
) => {
  const make = () =>
    new WebGLRenderTarget(4, 4, {
      type: UnsignedByteType,
      // Mipmapped, the coarser levels give cheap wide blurs (the rim).
      generateMipmaps: mips,
      minFilter: mips ? LinearMipmapLinearFilter : LinearFilter,
      magFilter: LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
  const material = new ShaderMaterial({
    uniforms: {
      ...uniforms,
      uPrev: { value: null as Texture | null },
      uFresh: { value: 1 },
    },
    vertexShader: flatVert,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const scene = new Scene();
  const quad = new Mesh(new PlaneGeometry(1, 1), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return {
    targets: [make(), make()],
    read: 0,
    frame: 0,
    material,
    scene,
    camera: new OrthographicCamera(),
    quad,
  };
};
type Pass = ReturnType<typeof makePass>;

/** Size the pass, render one step into it, swap; returns the new target. */
const runPass = (pass: Pass, gl: WebGLRenderer, w: number, h: number) => {
  const p = pass;
  const [a, b] = p.targets;
  let fresh = p.frame === 0;
  if (a.width !== w || a.height !== h) {
    a.setSize(w, h);
    b.setSize(w, h);
    fresh = true;
  }
  const read = p.targets[p.read];
  const write = p.targets[1 - p.read];
  p.material.uniforms.uPrev.value = read.texture;
  p.material.uniforms.uFresh.value = fresh ? 1 : 0;
  const before = gl.getRenderTarget();
  gl.setRenderTarget(write);
  gl.render(p.scene, p.camera);
  gl.setRenderTarget(before);
  p.read = 1 - p.read;
  p.frame += 1;
  return write;
};

const overlayMaterial = (
  fragmentShader: string,
  uniforms: Record<string, { value: unknown }>,
) =>
  new ShaderMaterial({
    uniforms,
    vertexShader: screenVert,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
  });

export const World = () => {
  const cameraTexture = useXRCameraTexture();
  const { texture: maskTexture } = usePersonMaskTexture();
  const reading = useRef(false);
  const lastRead = useRef(0);

  const passes = useMemo(
    () => ({
      steady: makePass(
        steadyFrag,
        {
          ...gate,
          uAspect: shared.uAspect,
          uRaw: { value: null as Texture | null },
          uHasRaw: { value: 0 },
          uRawTexel: { value: new Vector2(1 / 256, 1 / 256) },
          uBlend: { value: 0.3 },
        },
        true,
      ),
      stats: makePass(
        statsFrag,
        { uCam: media.uCam, uCamLinear: media.uCamLinear, uMask: media.uMask },
        false,
      ),
    }),
    [],
  );
  const pixels = useMemo(
    () => new Uint8Array(STATS.width * STATS.height * 4),
    [],
  );

  const materials = useMemo(
    () => ({
      world: new ShaderMaterial({
        uniforms: { ...shared, ...media },
        vertexShader: screenVert,
        fragmentShader: worldFrag,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
      person: overlayMaterial(personFrag, { ...shared, ...media }),
      edge: overlayMaterial(edgeFrag, { ...shared }),
    }),
    [],
  );

  useEffect(
    () => () => {
      Object.values(passes).forEach((p) => {
        p.targets.forEach((t) => t.dispose());
        p.material.dispose();
        p.quad.geometry.dispose();
      });
      Object.values(materials).forEach((m) => m.dispose());
    },
    [passes, materials],
  );

  useFrame((state, rawDt) => {
    if (!cameraTexture) return;
    const dt = Math.min(rawDt, 0.1);
    media.uCam.value = cameraTexture;
    media.uCamLinear.value =
      cameraTexture.colorSpace === SRGBColorSpace ? 1 : 0;
    const img = cameraTexture.image as
      | {
          width?: number;
          height?: number;
          videoWidth?: number;
          videoHeight?: number;
        }
      | undefined;
    const cw = img?.videoWidth || img?.width;
    const ch = img?.videoHeight || img?.height;
    if (cw && ch) media.uCamTexel.value.set(1 / cw, 1 / ch);
    const { width, height } = state.size;

    // You, steadied (see steadyFrag).
    const pu = passes.steady.material.uniforms;
    pu.uRaw.value = maskTexture ?? null;
    pu.uHasRaw.value = maskTexture ? 1 : 0;
    const mi = (
      maskTexture as { image?: { width?: number; height?: number } } | null
    )?.image;
    if (mi?.width && mi.height)
      pu.uRawTexel.value.set(1 / mi.width, 1 / mi.height);
    pu.uBlend.value = 1 - Math.exp(-PERSON.rate * dt);
    const pk = Math.min(PERSON.scale, PERSON.max / Math.max(width, height, 1));
    const steady = runPass(
      passes.steady,
      state.gl,
      Math.max(16, Math.round(width * pk)),
      Math.max(16, Math.round(height * pk)),
    );
    media.uMask.value = steady.texture;
    comicState.person = steady;

    // Now and then, a tiny copy of the picture read back without waiting.
    const { stats } = passes;
    if (!reading.current && stats.frame % STATS.every === 0) {
      const target = runPass(stats, state.gl, STATS.width, STATS.height);
      reading.current = true;
      const now = state.clock.elapsedTime;
      state.gl
        .readRenderTargetPixelsAsync(
          target,
          0,
          0,
          STATS.width,
          STATS.height,
          pixels,
        )
        .then(() => {
          const since = lastRead.current ? now - lastRead.current : 0.05;
          lastRead.current = now;
          readFrame(comicState.motion, pixels, Math.max(0.016, since));
          const { light } = comicState.motion;
          media.uLight.value.set(light.mean, light.spread);
        })
        .catch(() => {})
        .finally(() => {
          reading.current = false;
        });
    } else {
      stats.frame += 1;
    }
  }, -0.5);

  if (!cameraTexture) return null; // tracker / media startup and source swaps
  return (
    <>
      <mesh
        name="world"
        material={materials.world}
        renderOrder={-998}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh
        name="person"
        material={materials.person}
        renderOrder={-980}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh
        name="wipe-edge"
        material={materials.edge}
        renderOrder={10}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>
    </>
  );
};
