# Scope

## What this tool is for

FAO's Forest Resources Assessment (FRA) asks countries to report soil organic carbon in forest.
Many countries have no national figure to report. This tool produces a defensible default from
global data: overlay a forest layer on a soil carbon layer, and compute per country

- total forest area (ha),
- total soil organic carbon stock in forest (t),
- **area-weighted mean soil organic carbon in forest (t/ha)** — the reported figure.

It is intended both as a gap-filling estimate where nothing better exists, and as a starting
point a country can improve by substituting its own data.

## Design principles

**Simple global analysis, improved national version.** The same workflow runs two ways: with
global default layers for a quick answer, or with a country's own uploaded layers for a better
one. Nothing about the method changes between the two — only the inputs.

**Countries choose their layers.** There is no single correct forest definition or soil carbon
product. The tool offers several recognised global layers for each and lets the user pick,
rather than baking one choice into the method. Both dropdowns also accept a user's own Earth
Engine asset.

**Data availability is the limitation, not the method.** The overlay-and-summarise calculation is
straightforward. The uncertainty lives almost entirely in the input maps — how the global soil
carbon map was built, what field sample network sits behind it, and how well it represents any
particular country. The tool is therefore explicit about which dataset produced a number, and
carries citations and known caveats alongside the results rather than presenting a single
authoritative figure.

## Soil depth

All figures are **0–30 cm**. This is provisional: it matches the depth GSOCmap reports and is the
usual soil carbon reporting standard, but the FRA requirement has not yet been confirmed. The app
has a depth control with a single option so that widening it later is a configuration change
rather than a rewrite. Every soil carbon dataset in the app records the depth it actually
represents.

## Soil carbon stocks vs concentrations

Only **stock** products (tonnes of carbon per hectare, for a stated depth) can be used for the
statistics. Several widely used global soil products report a **concentration** (g/kg or dg/kg
of soil) instead — these describe how carbon-rich the soil is, not how much carbon is present,
and converting between them requires bulk density and coarse-fragment layers. The app will
display a concentration layer but refuses to compute statistics from it. See
[soil_carbon_datasets_review.md](soil_carbon_datasets_review.md).

## Boundaries

Country statistics use GAUL 2024 Level 0, shared with the
[Primary Forest Finder](https://github.com/andyarnell/primaryforestfinder) toolset. Disputed and
placeholder territories are excluded from country tables. Earlier gap-filling runs used a
different boundary set, so country totals are not identical to those outputs.

## Status

A **demo**, built in Google Earth Engine. Whether a QGIS plugin or other desktop version is
needed will be assessed once the demo has been used in anger.

## Not yet supported

- **Forest change over time.** Only single-year forest layers. Time-series products (e.g. ESA
  CCI) would allow change analysis and are the obvious next step.
- **Higher-resolution soil carbon.** The global soil carbon layers available are coarse
  (250 m–1 km). Finer products are being reviewed.
- **Multiple soil depths.** 0–30 cm only, pending confirmation of the reporting standard.
- **Concentration-to-stock conversion.** Would need bulk density and coarse fragments.
- **Desktop / offline use.** Google Earth Engine only.
