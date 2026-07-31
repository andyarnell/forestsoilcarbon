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

**FRA does not mandate a depth.** The definition is identical in FRA 2020 and FRA 2025:

> Organic carbon in mineral and organic soils (including peat) **to a specified depth chosen by
> the country and applied consistently through the time series**.

The reporting table carries a field, *"Soil depth (cm) used for soil carbon"*. The only
requirements are that the country picks a depth, applies it consistently across the time series,
and states it. FRA adopts the IPCC carbon-pool *definitions* but not IPCC's 30 cm Tier 1
convention.

What countries actually report varies widely. FRA 2025 gives a forest-area-weighted global mean
of **41 cm**:

| Region | Mean reported depth |
|---|---|
| Asia and Oceania | 30 cm |
| Europe | 32 cm |
| South America | 34 cm |
| Africa | 41 cm |
| North and Central America | 70 cm |

So **0–30 cm is what the global data supports, not what FRA requires.** Both global layers are
0–30 cm because that is the only depth at which a global soil carbon *stock* product exists —
GSOCmap is 0–30 cm only, and SoilGrids' 30–100 cm stock layer is still listed as in development.

The depth selector drives everything else: **only soil carbon layers that actually represent the
selected depth are offered.** Depths are never mixed within a run, because a 0–30 cm figure is not
comparable with a deeper one and a deep value cannot be split back down. Depths with no matching
layer say "no global layer available at this depth — supply your own asset", which is honest
rather than empty: a country with a deeper national map can still use the tool, and adding a
deeper global product later makes that depth selectable with no code change.

**If you report a figure from this tool, state 0–30 cm in the FRA depth field**, and do not
switch depth between cycles.

## Relationship to FRA's own gap-filling

FRA 2025 already fills soil carbon for non-reporting countries this way:

> For non-reporting countries and areas, carbon-stock estimates were calculated by multiplying
> subregional averages for each carbon pool by forest area, with the exception of soil organic
> carbon, for which estimates were derived from the Global Soil Organic Carbon map. This map,
> which provides a 1-km soil-carbon grid for a depth of 0–30 cm, **was overlayed with available
> global forest/tree-cover layers that aligned best with reported forest areas** to derive
> country-specific estimates.

That is this tool's method. It is new in FRA 2025 — FRA 2020 used subregional averages for every
pool including soil.

Two consequences. First, the approach is not novel or unsanctioned; it is what FAO already does.
Second, FAO's published FRA 2025 figures are a **benchmark**: a country's number from this tool
should be reproducible against them, and a large divergence means the forest layer, the boundary
set, or the GSOCmap version differs.

Note also that soil carbon is an **optional** FRA field (only above- and below-ground biomass are
mandatory), and only around 77 countries report it, covering roughly 70% of global forest area.
That gap is the reason this tool exists.

## Litter is not soil carbon

FRA counts litter as a separate pool, defined as non-living biomass "lying dead in various states
of decomposition **above the mineral or organic soil**". For peatlands the peat itself is soil,
not litter.

SoilGrids draws the boundary in the same place — "litter layers on top of mineral soils were
excluded from further modelling" — so the global layers and the FRA pool definition agree on this
point. The O horizon is in neither.

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
