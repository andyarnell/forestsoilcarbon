# openEO reference pipeline — soil carbon in forest

The processing core of the FRA soil carbon workflow in plain Python
(numpy + rasterio), written as a reference for an openEO implementation:
each function is named for the openEO process it stands for, the design
rules are enforced in code rather than described, and the numbers are
validated against the production Earth Engine runs (table below).

For an implementer, this answers: what the process graph is, where the
platform must supply what openEO does not (pixel areas, edge weighting),
what the ingest step must refuse, and what numbers a correct build
reproduces. It is deliberately not a tool — no UI, no uploads, no auth;
those are the platform's half.

Design rules carried in code: the analysis grid is always the carbon
layer's own grid (carbon is never resampled; forest is aggregated to
meet it); forest uploads are binary 0/1, thresholded at native
resolution before ingestion; the nodata policy is decided at export,
never in the resampler; every aggregation passes a source-vs-aggregated
area check or fails loudly.

## Layout

| File | Role |
|---|---|
| [pipeline.py](pipeline.py) | the library: every stage as an importable function |
| [soc_stats.py](soc_stats.py) | CLI: country statistics; `--forest` takes a fraction **or** a raw binary (aggregated on the fly) |
| [preprocess_forest.py](preprocess_forest.py) | CLI: the ingest step alone, when you want the cached fraction + JSON sidecar |
| [export_inputs_btn.js](export_inputs_btn.js) | GEE: Bhutan carbon + pre-aggregated forest + boundary, on GSOCmap's grid |
| [export_forest_binary_btn.js](export_forest_binary_btn.js) | GEE: raw 10 m JRC binary on its own grid, nodata policy decided at export |

## Run it (from this folder; from the repo root prefix `tools/openeo_mock/`)

```
py soc_stats.py --soc "G:\My Drive\openeo_mock\mock_soc_gsoc_btn.tif" --forest "G:\My Drive\openeo_mock\mock_forest_jrc_btn.tif" --boundary "G:\My Drive\openeo_mock\mock_boundary_btn.geojson"
```

`--forest` also accepts the raw binary (`mock_forest_jrc10m_binary_btn.tif`)
— it is detected, reprojected and averaged onto the carbon grid in one
streamed pass, with the area QA printed. Needs `numpy` and `rasterio`;
both CLIs have `--selftest`.

## Validation status (Bhutan, GSOCmap + JRC)

| Chain | Mean | Forest area |
|---|---|---|
| raw 10 m binary, Python-aggregated | 83.26 t C/ha | 2,893.6 kha |
| GEE-pre-aggregated fractions | 83.26 t C/ha | 2,893.6 kha |
| GEE app v0.7.10, native scale | 83.3 t C/ha | 2,888.7 kha |
| original 2024 production run (BNDA) | 83.15 t C/ha | 2,897.3 kha |

Ingest QA (10 m source area vs aggregated): +0.003%. Residuals between
rows are boundary datasets and edge-pixel weighting — data choices, not
software.

## openEO mapping

| Here | openEO |
|---|---|
| `load_cube` / `read_grid` | `load_collection` / `load_uploaded_files` |
| `aggregate_binary`, `resolve_forest` | `resample_cube_spatial` (average) at ingest |
| `pixel_area_ha` | the template's companion pixel-area raster (no `pixelArea` process exists) |
| `compute_stats` | `mask`, `merge_cubes`, band maths |
| `boundary_fraction` + sums | `aggregate_spatial`, fractional pixel coverage (exactextract-style; backends differ — ask) |

## Known simplifications

- Boundary coverage via 10× supersampling (windowed — bounded memory at
  any country size), not exactextract itself; swap it in for an
  independent cross-check if wanted.
- Single country, single epoch, stock layers only — by design.
- Untested so far: national-CRS uploads with real data, soil-gap-heavy
  countries, antimeridian geometries (Russia needs split handling).
