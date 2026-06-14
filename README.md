# whiterose

A browser-hosted, first-person **3D walk-through of the ContSys continuity-of-care concept model**,
themed as a 1960s NHS hospital. Each concept (dataClass) is the end of a corridor; you climb
**stairs** or take the **lift** to move between super- and sub-types, and walk through **doors** to
follow associations. The concept's definition is a wall **poster**; its notes and examples line the
side walls.

The model is a [MauroDataMapper](https://maurodatamapper.github.io/) JSON export — a *product
conforming to* ISO 13940, not the standard text itself.

## Quick start

```bash
npm install
npm run pipeline   # build public/concept-graph.json from the export (see data/README.md)
npm run dev        # open http://localhost:5173
```

Controls: **WASD / arrows** move · **mouse** looks · **E** or **click** uses a door / stairs / lift
· **M** opens the map (click any concept to fast-travel) · **Esc** releases the mouse.

## Scripts

| command | purpose |
|---|---|
| `npm run pipeline` | Parse the MauroDataMapper export → `public/concept-graph.json` (+ verified-fact checks). |
| `npm run dev` | Vite dev server. |
| `npm run build` | Type-check then build the static site to `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm test` | Pipeline unit tests + verified-fact regression checks. |

## Architecture

Two cleanly separated halves joined by one contract, `public/concept-graph.json`
(shape defined in [`src/graph/types.ts`](src/graph/types.ts)):

```
MauroDataMapper export  →  [ build-time pipeline ]  →  concept-graph.json  →  [ runtime renderer ]
   data/contsys-export.json     pipeline/                  (the contract)            src/
```

- **Pipeline** ([`pipeline/`](pipeline)) resolves transitive inheritance (diamond-deduped,
  cycle-guarded), classifies every association into outward / inward / self, and normalises the
  `directives.org.iso` note/example metadata. It is pure and unit-tested; the same `concept-graph.json`
  also works against a future live MauroDataMapper REST API by swapping only the input adapter.
- **Renderer** ([`src/`](src)) procedurally generates one **area** at a time
  ([`src/world/buildArea.ts`](src/world/buildArea.ts)) — corridor + end room, NHS signage, poster,
  panels, doors, stairs, a stairwell pit and a lift. Areas are connected by **teleporting portals**;
  a small **LRU cache** keeps only a few resident, so memory is bounded regardless of model size.

## Updating the model

A new model is a **data-only** change: drop a fresh export in `data/` (see
[`data/README.md`](data/README.md)), run `npm run pipeline`, commit the regenerated
`public/concept-graph.json`. No code changes required — the world is generated entirely from the data.

## Imagery & licensing

All posters, wall art and window views are **procedurally synthesised** at runtime
([`src/art/`](src/art)) — no third-party images are shipped, so there is no licensing risk. The
`ImageProvider` interface lets the imagery source be swapped later (e.g. a curated public-domain pool)
without touching world-generation.

## Deploy

`npm run build` emits a fully static `dist/` (base path `/whiterose/` for GitHub Pages — override
with `VITE_BASE`). A GitHub Actions workflow at [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
builds and deploys on push to `main`; enable **Settings → Pages → Source: GitHub Actions** in the repo.

## Status

Stage 0 (pipeline) and Stages 1–2 (vertical slice + full 180-area navigation with map/fast-travel and
bounded-memory LRU) are complete and verified. Remaining: richer art, comfort/accessibility options,
and first public deploy.
