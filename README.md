# Forest Soil Carbon

Soil organic carbon (SOC) in forest, by country — a Google Earth Engine tool for FAO FRA
reporting and gap-filling. In **beta**: this is a demo, actively being tested, and the numbers
should not be quoted without checking.

The tool overlays a forest layer on a soil carbon layer and reports, per country, the total
forest area, the total soil carbon stock in forest, and the area-weighted **mean SOC in
forest** (t/ha) that FRA asks for. Both layers are chosen at run time — pick a global dataset,
or point it at your own national asset.

## What's here

- **GEE app** ([`forest_soil_carbon.js`](forest_soil_carbon.js)) — pick a soil carbon layer,
  pick a forest layer, run for one country or for all countries, download the results as CSV.
- **Original scripts** ([`gee_scripts/`](gee_scripts/)) — kept for reference, not maintained:
  the hand-edited gap-filling script this app was built from, and the preprocessing script that
  aggregated the global forest layers onto the soil carbon grid.

## Run the GEE app

- **Code Editor** — free Google Earth Engine account; lets you edit and export to Drive.
  Opens the live script:
  https://code.earthengine.google.com/?scriptPath=users%2Fandyarnellgee%2Fapps%3Aforest_soil_carbon

A published browser app (no account needed) will be linked here once the demo settles.

## Using your own data

Both the soil carbon and forest dropdowns have a **"Custom — my own GEE asset"** option. Upload
your national layer as a GEE asset, paste its asset ID, and tell the app what the values mean:

- **Soil carbon** — must be a stock in tonnes per hectare for the reported depth. If your map is
  a concentration (g/kg, dg/kg) it is not directly comparable and the statistics are blocked;
  see [`docs/soil_carbon_datasets_review.md`](docs/soil_carbon_datasets_review.md).
- **Forest** — a binary mask (1 = forest) or a fractional cover layer (0–1).

## Datasets

The global layers the app offers, with resolutions, units, citations and caveats:
[`docs/datasets.md`](docs/datasets.md).

Soil depth is currently **0–30 cm** throughout — see [`docs/scope.md`](docs/scope.md).

## Scope and status

What the tool is for, what it deliberately does not do yet: [`docs/scope.md`](docs/scope.md).

## Issues & feedback

Report bugs or request features on the
[GitHub issues page](https://github.com/andyarnell/forestsoilcarbon/issues).

## License

CC BY 4.0 (workflow and documentation).

---

_Companion project: [Primary Forest Finder](https://github.com/andyarnell/primaryforestfinder) —
this app reuses its `gaulLut` and `fraStats` Earth Engine modules._
