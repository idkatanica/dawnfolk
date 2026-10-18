# Contributing

This page covers the setup, the checks a change passes, and the rules for
code, commits, and pull requests.

## Ways to contribute

- **Report a bug** with the bug report form. Include the seed, the quality
  level, and the browser and GPU.
- **Propose a feature** with the feature request form. Describe the problem
  before the solution.
- **Report a vulnerability** privately, as described in
  [SECURITY.md](SECURITY.md).
- **Send a pull request** for an open issue. Comment on the issue first for
  anything larger than a fix, so the approach is agreed before the work.

## Development setup

You need [Bun](https://bun.sh) 1.4 or later and a browser with WebGPU.

```sh
git clone https://github.com/svidskiy/dawnfolk.git
cd dawnfolk
bun install
bun run dev
```

`bun install` also installs the Git hooks through
[Lefthook](https://lefthook.dev). `bun run dev` opens the game at
`http://localhost:5173`. URL parameters such as `?seed=7&paused=1` make a
scene reproducible; the README lists them all.

## Checks

CI runs the checks below in this order on every pull request and every push to
`main`. The pre-commit hook runs `ultracite fix` on the staged files.

| Command | Tool | Fails on |
| --- | --- | --- |
| `bun run check` | Ultracite (Biome) | Any lint error or formatting difference; `bun run fix` fixes what it can |
| `bun run typecheck` | TypeScript | Any type error under `@tsconfig/bases/strictest` |
| `bun run test` | Vitest | A failing unit test (Node) or browser test (Chromium) |
| `bun run build` | Vite | A build error |
| `bun run test:e2e` | Playwright | A failing smoke test of the wide or phone layout |

Browser tests and Playwright need Chromium; set `CHROMIUM_EXECUTABLE_PATH` to
use a system Chromium. Fix the code rather than the rule.

## Code

### Naming and files

- Write names in full words, without abbreviations: `distanceFromCenter`, not
  `dist`; `column`, not `x`.
- Name a file after what it holds, in kebab case, such as `water-material.ts`.
- The engine never imports React; the UI talks to it through small stores and
  commands.
- No comments in code, except for workarounds of specific bugs.

### Control flow

- Declare functions with `function`, never as arrow functions assigned to a
  name. Inline callbacks may be arrows.
- Keep the happy path at the left margin: check preconditions at the top and
  return early.
- Every `if` and loop body goes in braces, even for a single `return`.
- Don't use `??` or `&&` to pick values or render conditionally, and don't
  use `as` casts or `!` assertions.

### Layout

- Separate the steps of a function with one blank line: the destructuring, the
  values it prepares, the work, and the result. Statements of one kind stay
  together.
- Separate sibling elements in JSX with one blank line.

## Commits

Commits follow
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
`type(scope): description`.

- Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `style`, `test`, `build`,
  `ci`, and `chore`.
- The scope names the area a change is about, from the list below. Leave it
  out when the change spans several areas.
- The description is in the imperative, starts in lowercase, stays under 72
  characters, and has no trailing period.
- One commit is one logical change that builds and passes on its own. Add a
  body only for what the diff can't show.
- No trailers such as `Co-authored-by:` or `Signed-off-by:`.

| Scope | Area |
| --- | --- |
| `generation` | Relief, erosion, hydrology, climate, and the first vegetation |
| `simulation` | The simulation worker: nature, agents, society, powers |
| `models` | Procedural people, animals, plants, and buildings |
| `rendering` | The WebGPU renderer: terrain, water, sky, effects |
| `game` | The main thread: worker connection, camera, input, tools |
| `ui` | The HUD, its features, and the design system |
| `app` | The app shell and engine launch |
| `e2e` | Playwright smoke tests |
| `release` | The version bump that prepares a release |
| `deps` | Dependency updates, which Dependabot opens |

## Pull requests

- One pull request is one standalone change.
- GitHub merges a pull request with a merge commit whose subject is its title
  and whose body is its body. Write the title in commit form and the body as a
  commit body, then end it with `Verified:` and the checks you ran.
- Attach screenshots for visible changes in a comment, so they stay out of the
  merge commit.
- CI has to pass.

## Licensing of contributions

Dawnfolk is licensed under the MIT license, whose text is in
[LICENSE](LICENSE). By submitting a contribution, you agree that it is licensed
under the same terms.
