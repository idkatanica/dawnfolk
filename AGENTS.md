# Dawnfolk

A god game about the first tribes on a floating island. A seed grows the world
in `src/generation`; a deterministic fixed-tick simulation runs it in a Web
Worker (`src/simulation`); the main thread mirrors its frames (`src/game`) and
draws them with three.js WebGPU and TSL (`src/rendering`); a React HUD sits on
top (`src/features`, `src/design`, `src/app`).
[README](README.md#architecture) has the code map, and
[CONTRIBUTING.md](CONTRIBUTING.md) the rules and checks.

## Commands

- `bun run dev` serves the game at `http://localhost:5173`, or the next free
  port.
- `bun run check`, `bun run typecheck`, `bun run test` and `bun run build`
  are what CI runs; run them before you push. `bun run fix` fixes what
  `check` reports.
- `bun run test` includes browser tests in Chromium, and so do
  `bun run test:e2e` and the pre-push hook. Without Playwright's own browser,
  point them at a system one:
  `CHROMIUM_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`.
- `src/**/*.test.ts` runs in Node; `src/**/*.browser.test.ts` and
  `src/**/*.test.tsx` run in Chromium.

## Seeing a change

- Rendering changes are verified by looking, not by tests alone. Open a
  reproducible scene with URL parameters, such as
  `?seed=7&quality=high&paused=1&hours=11&camera=x,z,distance,pitch,yaw`, and
  compare screenshots before and after at 1440×900, 768×1024 and 390×844.
- Headless Chromium with `--use-angle=swiftshader` renders in software:
  colors, speed and some WebGPU paths differ from a GPU. Prefer
  `--use-angle=metal --enable-gpu` with a system Chrome on a Mac, and say which
  one you used.
- In development the engine is on `window.dawnfolk`: `session.frame` has the
  tribes, weather and calendar, `camera` the view, and `powers` the active
  tool.
- Look at a distant view too. Water, terrain and vegetation switch level of
  detail by distance, and most visual bugs show up only far away or only
  close.
- Keep screenshots in a temporary folder, not in the repository; README
  images live in `.github/screenshots`.

## Rules that are easy to miss

- The engine never imports React, and the simulation never imports
  rendering. The UI reads the session through small Zustand stores and sends
  commands, which zod validates at the worker boundary.
- Generation and the simulation are deterministic for a seed. Draw their
  randomness from a `RandomSource` or `hashToUnit`, never `Math.random`, and
  keep the order of random draws stable: tests pin worlds by seed. Only
  rendering effects and the default seed may use `Math.random`.
- Water is one rule everywhere: `hasWater` and `touchesWaterCell` in
  `src/world`. Planting, regrowth, grass and the water shader must agree on it,
  or plants stand in rivers.
- Terrain and water share their level of detail per patch. A shader that reads
  a neighbour cell must account for the patch step, or far views break.
- Shaders are TSL node graphs in TypeScript. Keep large numbers out of float
  hashes: float32 loses precision past 16 million and patterns line up.
- The engine projects compile with `noUncheckedIndexedAccess` off for typed
  arrays; the app keeps it on. Everything else is `@tsconfig/bases/strictest`.
- No comments in code except workarounds for specific bugs, no `??`, no `&&`
  for control flow, no `as` casts or `!` assertions, full-word names, early
  returns, braces on every `if` and loop.
- A blank line separates the steps of a function, and every pair of sibling
  JSX elements. In `index.html`, closely related head tags stay together.
- Icons come from `lucide-react` and take the text color; don't tint them.
- The interface is glass islands from `@svidskiy/glass-surface-react` through
  `design/island.tsx`. Every island in a row has the same height.
- Commits follow Conventional Commits with a scope from
  [Commits](CONTRIBUTING.md#commits) or none, and carry no trailers such as
  `Co-authored-by:`.
- A pull request's title and body become the merge commit's subject and body.
  Write the title in commit form and the body as a commit body that ends with
  `Verified:` and the checks you ran, then `Fixes #N` when it closes an issue.
