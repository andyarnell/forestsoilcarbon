# Changelog — forest_soil_carbon.js (GEE app)

## v0.1.0 (first demo — interactive layer choice)

- **Turned the hand-edited gap-filling script into an app.** The original
  `fra_soil_carbon_gap_filling_v2` required commenting/uncommenting a block to change the forest
  dataset and had a single hardcoded soil carbon layer. Both are now dropdowns. The script is
  kept unchanged in `gee_scripts/` for reference.
- **Config-driven datasets.** `SOC_DATASETS` and `FOREST_DATASETS` at the top of the file are the
  only place a dataset is declared — asset ID, bands, units, depth, scale factor, citation.
  Adding a layer is one object; there is no dataset-specific logic anywhere else.
- **Countries can bring their own data.** Both dropdowns offer "Custom — my own GEE asset" with a
  textbox for the asset ID, matching the meeting requirement that a country can substitute a
  national forest or soil carbon map for the global default.
- **Country-first, with a global mode.** Defaults to a single selected country for a fast
  interactive result; "Global — all countries" reproduces the original gap-filling table.
- **Switched boundaries to GAUL 2024 L0** via the shared `gaulLut` module, replacing
  `UN_BNDA_2020_repaired`. Reason: it is one feature per country, so the original's
  `reduceRegions` → `reduceColumns` two-step to collapse multi-polygon countries is no longer
  needed. Country totals will differ slightly from earlier CSVs.
- **FRA comparison line.** Results show FAO FRA 2025 reported forest area alongside the computed
  figure, via the shared `fraStats` module, as a sanity check.
- **Stock vs concentration is enforced.** SOC layers carry `is_stock`. Concentration products
  (SoilGrids `soc_mean`, OpenLandMap) can be displayed but are refused for statistics, because
  summing a g/kg concentration as if it were a t/ha stock is meaningless. Reason: this was the
  main methodological trap found while reviewing candidate datasets.
- **CSV download works in a published app**, via `getDownloadURL` + a `targetUrl` label. Drive
  export is kept but gated on `IS_PUBLISHED_APP`, since `Export.table.toDrive` silently does
  nothing in a published app.
- Depth ships as 0–30 cm only. The control exists but has one option until the FRA reporting
  depth is confirmed.
