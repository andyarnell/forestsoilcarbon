# Changelog — forest_soil_carbon.js (GEE app)

## v0.2.0 (stocks only; depth drives the dataset list; three correctness fixes)

- **Fixed: SoilGrids `ocs_mean` was reported 10× too low.** `scale_factor` was 0.1. ISRIC stores
  `ocs` already in t/ha — their published "conversion factor 10" converts t/ha *to* kg/m², the
  other direction. Now 1. Any v0.1.0 SoilGrids figure is wrong by a factor of ten.
- **Fixed: the mean was biased low wherever the soil layer has gaps.** Forest area was reduced as
  its own band, so it kept its own mask: forest pixels with no soil data were excluded from the
  numerator but counted in the denominator. Forest area is now masked to the soil layer before
  weighting, and the results report **forest area with soil carbon data (%)** so the gap is
  visible rather than silently absorbed. Reason: this landed directly on the number FRA gets, and
  GSOCmap does have gaps.
- **Fixed: a custom asset defaulted to "stock".** A user who ignored the dropdown got a confident
  t C/ha figure from a layer of undeclared type. The default is now "I do not know", which blocks
  computation and explains why. `scale_factor` is also now editable — it was hardcoded to 1, so a
  ×10-stored national layer would have been silently ten times wrong.
- **Dropped the concentration layers** (SoilGrids `soc_mean`, OpenLandMap). They cannot produce a
  reportable FRA number, and both are superseded: `soc_mean` by `ocs_mean` from the same model
  family, OpenLandMap by SoilGrids 2.0. Reason: their plausible numeric ranges overlap with
  stocks (roughly 20–100 reads as sensible in either unit), so a mislabelled value has no
  tripwire. Concentration is still accepted as a *user's own* asset, where they declare it —
  reported as a mean only, total suppressed, labelled as not the FRA figure.
- **Depth now drives the dataset list.** `DEPTH_OPTIONS` is a real selector; only layers whose
  `depth_cm` matches appear in the soil carbon dropdown, and a depth with no layers says so.
  Depths are never mixed in one run. Adding a deeper product later makes its depth selectable on
  its own, with no code change.
- **`quantity` replaces `is_stock` + `units`.** Units are looked up from a single `QUANTITY`
  table rather than stored per dataset, so a config cannot claim to be a stock measured in g/kg.
- **CSV column names carry their unit** (`mean_soc_t_ha` vs `mean_soc_g_kg`), and the total
  column is omitted entirely when it would not be a quantity. Reason: the file outlives the
  session, and a column header is the only unit information that survives into a spreadsheet.
- The per-pixel "soil carbon in forest" map layer is no longer drawn for concentration inputs —
  it was labelled tonnes regardless.

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
