# Changelog — forest_soil_carbon.js (GEE app)

## v0.6.0-alpha (per-country GSOCmap provenance)

- **New module [modules/gsocMeta.js](modules/gsocMeta.js)** - all 195 country entries of Annex D
  of the GSOCmap v1.6 technical report (FAO 2022, DOI 10.4060/cb9015en): institution,
  methodology, sample count, sampling period, and whether the country's tile is a national
  submission or was gap-filled (69 GSP-modelled, 39 taken from SoilGrids 2.0). Extracted
  programmatically from the report PDF. Institutions only - the report's personal contact
  details were deliberately stripped. Upload to `users/andyarnellgee/apps:modules/gsocMeta.js`
  alongside the app, or the require at the top of the app fails.
- **The app shows a "Map provenance" line** when GSOCmap is selected and a single country is
  chosen: what that country's tile is built on, or an explicit "no country entry" message.
  Wired through two new config keys on the GSOCmap entry (`meta_format`, `meta_missing`) and a
  generic `addDatasetMeta()` - no dataset-specific logic outside the config array.
  Reason: 108 of 195 GSOCmap country tiles are not national submissions, and a reporting
  officer should see whether the number they are about to report rests on their own
  institution's data, a GSP model, or SoilGrids.
- NB the metadata describes **v1.6** submissions while the map asset is still **v1.5.0**.
  National submissions largely carry over, but the 39 SoilGrids-2.0 external fills are
  v1.6-specific - and v1.6's external fill being SoilGrids 2.0 means the "gap-filled from an
  old SoilGrids" concern attaches to v1.5-era releases, not v1.6. Adopting the v1.6 asset
  (dev notes, open question 6) would align map and metadata; noted in the config comment.

## v0.5.0 (clip to the selected country)

- **Map layers are clipped to the selected country**, with the border drawn as an outline so the
  clip reads as a boundary rather than a data gap. Reason: the map previously showed global layers
  while the results panel reported one country, so the picture and the numbers described different
  areas. No figure changes — the statistics were already restricted by `reduceRegions` over the
  same polygons.
- **The pixel inspector samples the clipped images**, so the map, a clicked pixel and the reported
  mean all describe one area. Clicking outside the border now says "outside <country>" rather than
  reporting a value that was never in the analysis — which is a different thing from a genuine
  data gap inside the border, and the two should not look alike.
- Statistics still run on the unclipped images; `reduceRegions` already restricts them, so
  clipping first would only add work.

## v0.4.0 (FRA does not mandate a depth — corrected)

- **Removed the claim that 0–30 cm is the "FRA default". It is not.** FRA 2020 and FRA 2025 both
  define soil carbon as "organic carbon in mineral and organic soils (including peat) **to a
  specified depth chosen by the country and applied consistently through the time series**", and
  the reporting table has a field "Soil depth (cm) used for soil carbon". FRA adopts the IPCC
  pool definitions but not IPCC's 30 cm Tier 1 convention.
  Reason: v0.1.0–v0.3.0 labelled the depth selector "0-30 cm (FRA default)", which would have led
  a reporting officer to believe the depth was prescribed. It is a country choice, and the
  forest-area-weighted mean countries actually report is **41 cm** — 30 cm in Asia and Oceania,
  32 Europe, 34 South America, 41 Africa, 70 in North and Central America.
- **The results panel now names the FRA field and the depth to enter with it**, and says to keep
  the depth consistent across the time series. 0–30 cm is presented as what the global data
  supports, not as a requirement — there is no global soil carbon *stock* product below 30 cm at
  all.
- Docs: recorded that **FRA 2025 already uses this method** — GSOCmap overlaid with global forest
  cover to gap-fill non-reporting countries, new in 2025. FAO's published figures are therefore a
  benchmark the tool should be able to reproduce. Also recorded GSOCmap's composition (about a
  third of its area is not a national submission), its ±20% stated uncertainty, and that the old
  "SoilGrids runs much higher than GSOCmap" comparison is about SoilGrids v1 (2017) and reverses
  for SoilGrids 2.0 — 599 Pg against GSOCmap's 682 Pg for 0–30 cm.

## v0.3.0 (pixel inspector)

- **Click the map to read the values behind the numbers.** A "Pixel values" block in the results
  panel reports, for the clicked point: soil carbon in the layer's own unit, forest cover as a
  percentage of the pixel, forest area in hectares, and — for stock layers — the carbon in forest
  for that pixel. A red marker shows where you clicked, replaced on each click.
  Reason: the inputs stopped being binary masks. Soil carbon per hectare and fractional forest
  cover are continuous, so the value at a point is the quickest way to tell a suspicious country
  mean from a genuine one — and the only practical way to check that a national asset's units and
  scale factor are what the user thinks before trusting a whole run.
- **The inspector samples the last run's images, not the current widget values**, so a clicked
  pixel and the reported country mean can never disagree about their inputs. Changing a dropdown
  without pressing Run leaves the inspector reporting the run you actually did.
- **Masked pixels say "no data", not zero.** Where a pixel has forest but no soil carbon, the
  inspector says so explicitly and notes that it is excluded from the country mean and counts
  against the coverage percentage — making the coverage figure traceable to specific places
  rather than an unexplained number.

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
