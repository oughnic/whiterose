# `data/` — pipeline input

The build-time pipeline (`npm run pipeline`) reads a **MauroDataMapper JSON export** of the ContSys
model and produces the render-ready [`public/concept-graph.json`](../public/concept-graph.json).

The raw export is **not committed** (it is git-ignored — see [`.gitignore`](../.gitignore)); only the
derived `concept-graph.json` is published. To (re-)run the pipeline locally, place the export here:

```
data/contsys-export.json
```

or point the pipeline at any path:

```bash
npm run pipeline -- "C:\path\to\ContSys-FDIS-Feb-2026 MASTER.json"
# or
CONTSYS_EXPORT="C:\path\to\export.json" npm run pipeline
```

Updating the model is then a **data-only** change: drop in a fresh export, re-run the pipeline,
commit the regenerated `public/concept-graph.json` — no code changes required.
