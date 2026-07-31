# CLAUDE.md — Forest Soil Carbon

Entry-point context for Claude Code sessions. Keep short — this is auto-loaded every session.
For detailed rules, read [.github/copilot-instructions.md](.github/copilot-instructions.md) (canonical).

---

## What this repo is

A Google Earth Engine app reporting soil organic carbon in forest, per country, for FAO FRA
gap-filling.

1. **GEE app** — [forest_soil_carbon.js](forest_soil_carbon.js) — the production script. Single
   file, published as `users/andyarnellgee/apps:forest_soil_carbon`.
2. **Original scripts** — [gee_scripts/](gee_scripts/) — kept for reference only, do not modify.
   `fra_soil_carbon_gap_filling_v2_starter.js` is the script the app was built from;
   `fra_soil_carbon_coarse_forest_export_starter.js` is how the 1 km forest assets were made.

Sibling project [primaryforestfinder](https://github.com/andyarnell/primaryforestfinder) —
this app `require`s its `modules/gaulLut.js` and `modules/fraStats.js`. Those modules live in
that repo; do not copy them here.

---

## Always check before editing

1. **`planning/dev_notes.md`** (local only — gitignored) — meeting notes, open questions and the
   action tracker. Read the "Open questions" block before changing anything methodological.
2. **[.github/copilot-instructions.md](.github/copilot-instructions.md)** — canonical conventions.

`planning/` must never be committed. It names colleagues and this repo is public.

---

## Key conventions

- **Area units:** hectares. **SOC units:** tonnes per hectare (a *stock*, not a concentration).
- **Analysis scale:** always set `scale` explicitly on reducers. Never let GEE infer it.
- **Boundaries:** GAUL 2024 L0, via `gaulLut`. Not UN BNDA — the original script used that, this
  app does not.
- **No dataset-specific logic outside the config arrays.** If a layer needs a code branch, it
  needs a config key instead. `SOC_DATASETS` and `FOREST_DATASETS` at the top of the app are the
  only place a new dataset should touch.
- **`pixel_area_km` is hectares.** The four pre-aggregated 1 km forest assets have a misnamed
  band — the values are hectares, not km². Do not "fix" it by dividing.

---

## Documentation layout

| File | Purpose |
|------|---------|
| [docs/scope.md](docs/scope.md) | What the tool is for; what it does not do yet |
| [docs/datasets.md](docs/datasets.md) | The global layers offered, with units and citations |
| [docs/soil_carbon_datasets_review.md](docs/soil_carbon_datasets_review.md) | SOC dataset comparison, validation, the stock-vs-concentration problem |
| [CHANGELOG.md](CHANGELOG.md) | Version history for the app |
| `planning/dev_notes.md` (local only) | Raw notes, contacts, open questions |
