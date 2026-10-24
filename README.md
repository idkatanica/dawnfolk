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
    href="https://github.com/svidskiy/dawnfolk/actions/workflows/ci.yml"
  ><img
    src="https://github.com/svidskiy/dawnfolk/actions/workflows/ci.yml/badge.svg"
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

### The island

- Every world is named and grown from a seed, round with bays and headlands or square.
- Rivers rise from caves and ponds, run into lakes and pour off the edge as waterfalls.
- Climate and biomes shape forests with glades and riverside meadows; nothing grows on cliffs.
- Seasons turn the foliage, and snow settles and melts.
- Fire spreads with the wind; burnt land grows back over a few years, fireweed first.
- Weathered megaliths of a forgotten people: stone circles, dolmens, half-buried stone heads, ruined colonnades.
- People and animals hop brooks and cross wider rivers on stepping stones or fallen logs, every half kilometre or so.

### The tribes

- People gather, hunt, fish, farm, chop, quarry, build, pray, learn technologies, migrate and split into new tribes.
- Tribes climb from the Stone Age through the Neolithic and the Copper and Bronze Ages to the Iron Age.
- They fire pottery, weave linen, plough fields, plant orchards, mine, smelt and forge tools and weapons.
- Camps and huts grow into longhouses, workshops, palisades and stone houses that change style with the era.
- Quarrels over land turn neighbours hostile: archers and spearmen raid, defenders rally, envoys bring gifts.

### Animals

- Deer, mammoths and ibex graze in herds and flee; ibex climb to the nearest heights.
- Hares breed fast, live short lives and bolt at the first threat.
- Wolf packs roam far from people, run hares down and stalk lone people at night; cornered beasts fight back.

### Powers

- Fire, lightning, rain, snow, explosions, meteors, earthquakes, raising and painting land, forests, healing,
  animals and new tribes.
- Each power is a schema, so its strength, radius and other settings appear as controls.
- Meteors and blasts fell and burn the forest, a crater on a river fills into a lake, and monuments lean and break.
- World rules, such as how fast fire spreads or how hungry people get, are adjustable in the settings.

### Look and interface

- People, animals, plants, rocks and buildings are built procedurally from seeds and animated with skeletal clips.
- Tribe banners show population and era, and a click flies to the camp; peaks, lakes and ruins carry names.
- From afar, people, herds and wolves show as markers on the island and the minimap.
- Powers, resources, buildings, weather and events have painted icons.
- Every panel floats on its own island of refracting glass
  ([`@svidskiy/glass-surface`](https://github.com/svidskiy/glass-surface)), with a compact layout for phones.

## Stack

Bun · Vite 8 · React 19 with the React Compiler · TypeScript 7 (`@tsconfig/bases` strictest) · three.js r186
(WebGPU + TSL, WebGL 2 fallback) · Base UI · Tailwind CSS 4 · Zustand · Zod · Comlink · Biome with Ultracite ·
Vitest 5 (node and browser projects) · Playwright · Lefthook.

## Getting started

You need [Bun](https://bun.sh) 1.4 or later and a browser with WebGPU or WebGL 2.

```sh
git clone https://github.com/svidskiy/dawnfolk.git
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
  game/        main thread: worker connection, world mirror, session, engine loop, input, power tools
  models/      procedural model engine: mesh builder, rig and clips, people, animals, plants and rocks,
               buildings, monuments, crossings
  rendering/   WebGPU renderer: sky, height fog and atmosphere, terrain and water patches, waterfalls, vegetation
               chunks and grass, skinned agents with far markers, buildings, fire, smoke, weather, bloom
  design/      design system: glass islands, game icons, buttons, fields, meters, tooltips, formatting
  features/    UI features with their stores: time, powers, inspector, journal, tribes and rivalry, minimap,
               map labels, notices, settings, new world
  app/         app shell, start screen, engine launch, HUD layouts
```

The simulation runs in a Web Worker and posts frames; the main thread mirrors them for the renderer and the HUD,
and the HUD sends commands back. [AGENTS.md](AGENTS.md#rules-that-are-easy-to-miss) has the rules that keep these
parts apart.

## License

[MIT](LICENSE)
