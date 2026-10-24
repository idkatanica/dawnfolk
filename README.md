<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <img src=".github/logo.svg" alt="" width="96" height="96">
  </picture>
</p>

<h1 align="center">Dawnfolk</h1>

<p align="center">A god game about the first tribes on a floating island.</p>

<p align="center">
  <a
    href="https://github.com/imsvidskiy/dawnfolk/actions/workflows/ci.yml"
  ><img
    src="https://github.com/imsvidskiy/dawnfolk/actions/workflows/ci.yml/badge.svg"
    alt="CI"
  ></a>
  <a
    href="LICENSE"
  ><img
    src="https://img.shields.io/badge/license-MIT-blue"
    alt="License: MIT"
  ></a>
  <img
    src="https://img.shields.io/badge/WebGPU-three.js-informational"
    alt="WebGPU with three.js"
  >
</p>

<p align="center">
  <a href="https://dawnfolk.svidskiy.workers.dev">Play</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

https://github.com/user-attachments/assets/d04e30b3-ad84-4074-a5a0-45f5a0de384b

Shape the land, call rain, fire and lightning, and watch small tribes gather, build, feud and climb from the Stone
Age to the Iron Age on a procedurally generated island rendered with WebGPU.

## Features

- **A living island.** Named and grown from a seed, round or square, with rivers from caves and ponds, lakes,
  waterfalls off the edge, biomes, seasons and snow.
- **Ruins and crossings.** Megaliths of a forgotten people, and stepping stones or fallen logs where rivers can be
  crossed.
- **Tribes.** People gather, hunt, fish, farm, build, pray, migrate and split, and climb from the Stone Age to the
  Iron Age with pottery, linen, fields, mines, smelters and forges.
- **Feuds and peace.** Quarrels over land lead to raids by archers and spearmen; weary tribes send envoys with gifts.
- **Wildlife.** Herds of deer, mammoths and ibex, fast-breeding hares, and wolf packs that hunt them and stalk lone
  people at night.
- **Powers.** Fire, lightning, rain, snow, meteors, earthquakes, terraforming, forests, healing, animals and new
  tribes, each with its own settings; world rules are adjustable too.
- **Scars that heal.** Fire spreads with the wind, craters on rivers fill into lakes, monuments fall, and burnt land
  grows back over a few years.
- **Procedural models.** People, animals, plants, rocks and buildings are built from seeds and animated with
  skeletal clips.
- **A readable map.** Named peaks, lakes and ruins, tribe banners that fly you to their camp, and far markers on the
  island and the minimap.
- **A calm HUD.** Solid panels that read over any terrain, glass only for the power dock and the minimap, painted
  icons for game things, and a compact layout for phones.

## Stack

Bun · Vite 8 · React 19 with the React Compiler · TypeScript 7 (`@tsconfig/bases` strictest) · three.js r186
(WebGPU + TSL, WebGL 2 fallback) · Base UI · Tailwind CSS 4 · Zustand · Zod · Comlink · Biome with Ultracite ·
Vitest 5 (node and browser projects) · Playwright · Lefthook.

## Getting started

You need [Bun](https://bun.sh) 1.4 or later and a browser with WebGPU or WebGL 2.

```sh
git clone https://github.com/imsvidskiy/dawnfolk.git
cd dawnfolk
bun install
bun run dev          # http://localhost:5173
```

Without parameters the game opens on a start screen that names the world and picks its shape. URL parameters skip
it and make a scene reproducible: `?seed=7&shape=round|square&name=Ashvale&quality=low|medium|high&hours=21&paused=1&camera=x,z,distance,pitch,yaw`.

[CONTRIBUTING.md](CONTRIBUTING.md) has the other scripts, the checks and the code style.

## Architecture

```
src/
  shared/      math, seeded random, noise, astronomy
  content/     data registries: grounds, biomes, plants, animals, weather, technologies, buildings, powers,
               world rules — powers and rules are zod schemas with UI metadata
  world/       world grid and the data shared by the simulation and the renderer
  generation/  relief → erosion → hydrology → climate and biomes → ruins and river crossings → vegetation →
               ore deposits
  simulation/  deterministic fixed-tick simulation: nature (calendar, weather, fire, embers, surface, growth),
               agents (navigation, movement), fauna, society (people, jobs, tribes, buildings, settlement,
               rivalry), powers, commands, frames
  workers/     the simulation worker (Comlink)
  game/        main thread: worker connection, world mirror, session, engine loop, god camera, input, power tools
  models/      procedural model engine: mesh builder, rig and clips, people, animals, plants and rocks,
               buildings, monuments, crossings
  rendering/   WebGPU renderer: sky, height fog and atmosphere, terrain and water patches, waterfalls, vegetation
               chunks and grass, skinned agents with far markers, buildings, fire, smoke, weather, bloom
  design/      design system: paper and glass islands, game icons, buttons, fields, meters, tooltips, formatting
  features/    UI features with their stores: time, powers, inspector, journal, tribes and rivalry, minimap,
               map labels, notices, settings, new world
  app/         app shell, start screen, engine launch, HUD layouts
```

The simulation runs in a Web Worker and posts frames; the main thread mirrors them for the renderer and the HUD,
and the HUD sends commands back. [AGENTS.md](AGENTS.md#rules-that-are-easy-to-miss) has the rules that keep these
parts apart.

## License

[MIT](LICENSE)
