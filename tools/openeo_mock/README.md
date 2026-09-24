# openEO mock — analysis and statistics only

A minimal Python reproduction of the soil-carbon overlay for one country
(Bhutan first), structured so each function names the openEO process it
stands for. Purpose: validate the pilot's process graph and numbers before
any platform exists, and surface backend questions early (pixel-area
handling, `aggregate_spatial` edge-pixel weighting). Not a tool — no UI,
no uploads, just the four figures.

## Run it

1. Paste [export_inputs_btn.js](export_inputs_btn.js) into the GEE Code
   Editor, Run, start the three tasks. Outputs land in Drive folder
   `openeo_mock`, on GSOCmap's own grid (nothing is ever resampled).
2. With Drive for Desktop mounted, one line (works in PowerShell and cmd):

   ```
   py tools/openeo_mock/soc_stats.py --soc "G:\My Drive\openeo_mock\mock_soc_gsoc_btn.tif" --forest "G:\My Drive\openeo_mock\mock_forest_jrc_btn.tif" --boundary "G:\My Drive\openeo_mock\mock_boundary_btn.geojson"
   ```

3. Compare with the app: Bhutan, GSOCmap + JRC, scale "Native to soil
   layer". Acceptance: mean within well under 1%; area differences beyond
   that implicate boundary edge-weighting, which is the point of checking.

Needs `numpy` and `rasterio` (`py -m pip install rasterio`).
`py soc_stats.py --selftest` checks the arithmetic with no files.

## openEO mapping

| Here | openEO |
|---|---|
| `load_cube` | `load_collection` / `load_uploaded_files` |
| `require_same_grid` | `resample_cube_spatial` (a deliberate no-op: the template IS the carbon grid) |
| `pixel_area_ha` | the template's companion pixel-area raster (no `pixelArea` process exists) |
| array arithmetic in `run` | `mask`, `merge_cubes`, band maths |
| `boundary_fraction` + sums | `aggregate_spatial` with fractional pixel coverage (exactextract-style; backends differ — ask) |

## Known simplifications

- Boundary coverage via 10× supersampled rasterization, not exactextract
  itself (same idea, ~1e-3 fraction precision; swap in `exactextract` for
  an independent cross-check if wanted).
- Single country, single epoch, stock layers only — by design.
