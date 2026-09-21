# Datasets

The global layers offered by [forest_soil_carbon.js](../forest_soil_carbon.js). This file and the
`SOC_DATASETS` / `FOREST_DATASETS` config arrays in the app are expected to match — update both
in the same commit.

Users can also supply their own Earth Engine asset for either layer; see the README.

## Soil carbon

Only **stock** products are offered — tonnes of carbon per hectare, for a stated depth. That is
the quantity FRA reports.

| Dataset | Asset | Band | Resolution | Depth | Units | Scale factor |
|---|---|---|---|---|---|---|
| GSOCmap 1.5 (FAO) | `projects/ee-andyarnellgee/assets/crosscutting/GSOCmap1_5_0` | single band | ~1 km | 0–30 cm | t C/ha | 1 |
| SoilGrids 2.0 OCS | `projects/soilgrids-isric/ocs_mean` | `ocs_0-30cm_mean` | 250 m | 0–30 cm | t C/ha | 1 |

> **The SoilGrids scale factor is 1, not 0.1.** ISRIC's properties table gives `ocs` as *mapped
> units t/ha, conversion factor 10, conventional units kg/m²* — the ÷10 converts t/ha **to**
> kg/m², not the other way. The stored integer is already t/ha. Applying 0.1 reports every
> figure 10× too low. This was a real bug in v0.1.0.
>
> Still worth confirming directly:
> `ee.Image('projects/soilgrids-isric/ocs_mean').bandNames().getInfo()`.

`ocs_mean` has **one** depth only (0–30 cm) — unlike SoilGrids' other properties, it does not
have the six-interval band structure.

### Deliberately not offered

| Dataset | Why not |
|---|---|
| SoilGrids `soc_mean` | Concentration (g/kg), not a stock. Strictly dominated by `ocs_mean` from the same model family |
| OpenLandMap SOC | Concentration, and an older product superseded by SoilGrids 2.0 |
| iSDAsoil `carbon_organic` | Concentration; depths 0–20/20–50 cm don't align with 0–30 cm; Africa only |

A concentration says how carbon-rich the soil is, not how much carbon is there, and it cannot be
reported in a FRA stock field. See
[soil_carbon_datasets_review.md](soil_carbon_datasets_review.md).

Users can still supply a concentration as their own asset — they must declare it as such, and the
app reports the mean only, clearly labelled as not the FRA figure.

**Newer version available:** GSOCmap **v1.6** exists (technical report 2022). The app uses the
v1.5 asset already uploaded to `ee-andyarnellgee`. Upgrading means uploading v1.6 and adding a
dataset entry.

**Citations**

- FAO & ITPS (2022) *Global Soil Organic Carbon Map (GSOCmap) v1.5*. FAO, Rome.
- Poggio, L. et al. (2021) SoilGrids 2.0: producing soil information for the globe with quantified
  spatial uncertainty. *SOIL* 7, 217–240. https://doi.org/10.5194/soil-7-217-2021

## Forest

All four are 1 km images pre-aggregated from finer sources, carrying the fraction of each 1 km
pixel that is forest (`prop_cover_2020`) and the pixel area (`pixel_area_km`).

> **`pixel_area_km` is misnamed — the values are hectares.** Confirmed in the script that made
> them ([`gee_scripts/fra_soil_carbon_coarse_forest_export_starter.js`](../gee_scripts/fra_soil_carbon_coarse_forest_export_starter.js)):
> the band is built as `ee.Image.pixelArea().divide(10000)`. The app treats it as hectares. Do
> not "fix" it by dividing.

| Dataset | Asset suffix under `projects/ee-andyarnellgee/assets/misc/team_fra_support/` | Year |
|---|---|---|
| JRC Global Forest Cover 2020 | `jrc_gfc2020_prop_in_1km_aggr` | 2020 |
| Hansen GFC, >10% tree cover | `hansen_10pc_cover_2020_pixel_prop_in_1km_aggr` | 2020 |
| Hansen GFC, >20% tree cover | `hansen_20pc_cover_2020_pixel_prop_in_1km_aggr` | 2020 |
| GlobeLand30 forest | `globland_forest__2020_pixel_prop_in_1km_aggr` | 2020 |

**How they were made.** Each source was thresholded to a binary forest mask at its native
resolution, then `reduceResolution(ee.Reducer.mean())` + `reproject()` onto the GSOCmap grid, so
the mean of a binary mask becomes the fraction of the 1 km pixel that is forest. The script is
kept at
[`gee_scripts/fra_soil_carbon_coarse_forest_export_starter.js`](../gee_scripts/fra_soil_carbon_coarse_forest_export_starter.js)
(also https://code.earthengine.google.com/46bf76f330a5d032908a2aa87be37411). Sources used there:

- Hansen: `UMD/hansen/global_forest_change_2023_v1_11`, `treecover2000` with loss up to the
  target year zeroed, then thresholded at 10% or 20%.
- JRC: `JRC/GFC2020/V2` mosaicked.
- GlobeLand30: `users/eraviolo/GlobeLand30m_2020`, class 20 = forest, reprojected out of its
  per-UTM-zone tiling first.

Note the script's forest choice is selected by commenting/uncommenting a block, and its final
line references an undefined `prop_forest` variable — it is kept as-is for provenance, not as
working code.

**Citations**

- Bourgoin, C. et al. (2024) *Global map of forest cover 2020 v2*. European Commission, Joint
  Research Centre.
- Hansen, M.C. et al. (2013) High-resolution global maps of 21st-century forest cover change.
  *Science* 342, 850–853. https://doi.org/10.1126/science.1244693
- Chen, J. et al. (2015) Global land cover mapping at 30 m resolution: a POK-based operational
  approach. *ISPRS Journal of Photogrammetry and Remote Sensing* 103, 7–27.

Which forest layer is "correct" depends on the forest definition being reported against. The app
defaults to JRC GFC 2020 because that is what the original gap-filling script was last run with —
that is a starting point, not a recommendation.

## Boundaries

GAUL 2024 Level 0, `projects/sat-io/open-datasets/FAO/GAUL/GAUL_2024_L0`, accessed through the
`gaulLut` module shared with
[Primary Forest Finder](https://github.com/andyarnell/primaryforestfinder). One feature per
country; identity is `iso3_code`, display name `gaul0_name`.

Disputed and placeholder territories (ISO3 codes beginning with lowercase `x`) are excluded from
country tables.

## Reference data

FAO FRA 2025 reported figures, shown next to computed values as a sanity check, come from the
`fraStats` module in the Primary Forest Finder repo. Values are in 1000 ha, keyed by GAUL country
name, for 1990/2000/2010/2015/2020.
