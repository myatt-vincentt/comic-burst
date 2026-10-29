// Scene.tsx — Comic Burst: swipe a hand across the screen and the room wipes
// into a pop-art comic world; swipe again to wipe back. See PLAN.md.
import { lazy, Suspense } from "react";

import { ComicScene } from "./comic/ComicScene";

// Dev-only helpers for previewing without a camera or a hand. Lazy and behind
// a constant esbuild folds to false in production. Two rules:
// `process.env.NODE_ENV`, not `import.meta.env.DEV` (vincentt-xr/v2-template#112);
// and write the check INSIDE the ternary — hoisted into a `const`, esbuild
// keeps the dead branch.
const DevMediaSwitcher =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./DevMediaSwitcher"))
    : null;
const DevKeys =
  process.env.NODE_ENV !== "production"
    ? lazy(() => import("./comic/DevKeys"))
    : null;

export const Scene = () => (
  <>
    <ComicScene />
    {DevMediaSwitcher && DevKeys ? (
      <Suspense fallback={null}>
        <DevMediaSwitcher />
        <DevKeys />
      </Suspense>
    ) : null}
  </>
);
