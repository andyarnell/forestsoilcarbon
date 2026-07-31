# Copilot / AI agent instructions — Forest Soil Carbon

Canonical technical conventions for this repo. [CLAUDE.md](../CLAUDE.md) is the short
entry-point; this file is the detail.

---

## 1. General

- Prefer minimal, incremental edits over major refactors.
- Preserve existing UI patterns and naming conventions.
- Prefer config-driven patterns over repetitive hardcoding.
- Avoid introducing abstractions unless they clearly reduce duplication.
- Do not rewrite unrelated parts of the app.
- **No overengineering.** Keep solutions minimal and targeted. This is a demo.

## 2. Google Earth Engine JavaScript

- **Must run in the GEE Code Editor without modification.** No build step, no bundler, no npm.
- ES5 only. No `let`/`const`, no arrow functions, no template literals, no `async`/`await`,
  no promises, no browser APIs.
- Avoid unnecessary `.getInfo()` — it blocks the UI. Use `.evaluate(callback)` instead.
- Follow the module pattern `exports.functionName = function(params) {...}` if code is ever
  extracted to `modules/`. Never the Node `module.exports = ...` style — GEE's `require()`
  does not support it.
- Use JSDoc with `@param {type}` and `@return {type}` on public functions.
- **Naming:** camelCase for functions and variables, UPPER_SNAKE_CASE for constants,
  snake_case for config keys and output column names.
- Section banners are a 77-character `// ===...` rule with an ALL-CAPS title.

## 3. Units and conventions

- **Area:** hectares throughout. Convert once, at the edge, and say so in a comment.
- **Soil organic carbon:** tonnes per hectare, and it must be a **stock** for a stated depth.
  Concentrations (g/kg, dg/kg) are a different quantity and must not be summed as if they
  were stocks.
- **Depth:** 0–30 cm unless explicitly stated otherwise. Every SOC dataset config carries
  `depth_cm` so this stays checkable.
- **Scale:** pass `scale` explicitly to every reducer. The default analysis scale is 1000 m
  (the native resolution of GSOCmap).
- **Boundaries:** GAUL 2024 Level 0. Country identity is `iso3_code`; display name is
  `gaul0_name`; the numeric key is `gaul0_code`.
- Filter GAUL's disputed/placeholder entries (ISO3 codes beginning with a lowercase `x`) out of
  any country table intended for FRA.

## 4. Adding a dataset

Add one object to `SOC_DATASETS` or `FOREST_DATASETS` in
[forest_soil_carbon.js](../forest_soil_carbon.js). Do not add branching logic elsewhere.

A SOC entry needs: `key`, `label`, `asset`, `band`, `scale_factor`, `units`, `depth_cm`,
`native_resolution_m`, `is_stock`, `citation`. If `is_stock` is `false` the app will offer the
layer for display but refuse to compute statistics from it — that is intentional.

A forest entry needs: `key`, `label`, `asset`, `type`, `year`, `citation`, plus the fields that
`type` implies (`prop_band` + `area_band` for `prop_aggregated`; `band` + `threshold` for
`binary`).

Then update [docs/datasets.md](../docs/datasets.md) in the same commit — the doc and the config
are expected to match.

## 5. Published app vs Code Editor

`Export.table.toDrive` silently does nothing in a published GEE App. Gate any Drive export on
`IS_PUBLISHED_APP` and always also offer an in-app download link via
`getDownloadURL({format: 'csv'})` on a `ui.Label` with `targetUrl`.
