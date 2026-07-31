# Soil carbon datasets — review

Working notes against the action "review soil carbon datasets and validation". Incomplete — this
is a live document, not a conclusion.

## How the two products compare

| | GSOCmap v1.6 | SoilGrids 2.0 |
|---|---|---|
| Global 0–30 cm stock | **682 Pg C** | **599 Pg C** |
| Stated uncertainty | ±144 Pg (~20%), ships a SD layer | none published for `ocs` |
| Validation | third-party: index of agreement 0.50, mean gross error 35.07 t/ha | none published for `ocs`; SOC concentration MEC 0.47 |
| Built from | national submissions, harmonised | one global quantile random forest |

**Do not carry over the old "SoilGrids is much higher than GSOCmap" claim — it has reversed.**
That comparison came from SoilGrids **250m v1 (2017)**, which gave 1267 Pg, 86% above GSOCmap.
SoilGrids **2.0** gives 599 Pg, which is *below* GSOCmap. The widely cited intercomparison
(Lin et al. 2023, range 577–1171 Pg across five products) explicitly used v1 "for method
consistency". Anyone quoting that literature about SoilGrids 2.0 is quoting the wrong version.

That the two now sit within ~12% of each other is reassuring, but they are not independent:
about **1% of GSOCmap's area is literally SoilGrids**, used as an external dataset for 39 countries.

### GSOCmap composition — the limitation that matters most

From the v1.6 technical report (Table 4.1), by share of world area:

| Source | Maps | % of area |
|---|---|---|
| Country submission | 74 | 64.8% |
| Joint effort with GSP | 13 | 7.8% |
| **GSP gap-filling (public data + digital soil mapping)** | 69 | **26.4%** |
| External dataset (soilgrids.org) | 39 | 1.0% |

So roughly **a third of the map is not a national product**. FAO's own diagnosis of the visible
border artefacts is worth quoting, because it is not the obvious one:

> The difference in mapping methods is **not** the primary source of border inconsistency… The
> primary source of uncertainty and border inconsistencies appears to be in the original point
> data quality and representativity.

Two further limitations that bear directly on the numbers this tool produces:

- **Bulk density.** Only 8% of countries used measured bulk density throughout; over 55% used
  pedotransfer functions and only 25% used locally fitted ones.
- **Coarse fragments.** Only 17% had measured data, and **almost 40% of countries used no
  coarse-fragment information at all** — which systematically overestimates stock in stony soils.
- **Age.** Only 25% of countries have all data post-1990. FAO state GSOCmap "can be used as a
  baseline for SOC monitoring only for the countries with all the submitted data originating from
  recent soil surveys."

### Uncertainty cannot currently be propagated in Earth Engine

ISRIC serve only the `_mean` assets on GEE; the 5th/50th/95th percentile layers are documented as
"will be uploaded shortly". So even if the tool wanted to carry an uncertainty band, the inputs
are not there. GSOCmap does ship a standard-deviation layer, though only 22 countries contributed
uncertainty inputs to it.

## The stock vs concentration problem

This is the main methodological trap, and the reason the app blocks some layers from the
statistics.

**Soil organic carbon stock** is a mass per unit area — tonnes of carbon per hectare, for a
stated depth. It is what FRA asks for, and it is what you get by multiplying carbon
concentration by bulk density by depth, minus the coarse-fragment volume.

**Soil organic carbon concentration** is a mass fraction — grams of carbon per kilogram of soil.
It says how carbon-rich the soil is, not how much carbon is there. A shallow, stony,
low-density soil and a deep, dense one can have identical concentrations and very different
stocks.

The two are not interchangeable, and several widely used global products report concentration:

| Product | Reports | Directly usable for FRA |
|---|---|---|
| GSOCmap 1.5 | stock, t/ha, 0–30 cm | yes |
| SoilGrids 2.0 `ocs_mean` | stock, t/ha, 0–30 cm only | yes |
| SoilGrids 2.0 `soc_mean` | concentration, dg/kg, 6 depth *intervals* (value constant across each interval) | no |
| OpenLandMap SOC | concentration, g/kg, at *point* depths 0/10/30/60/100/200 cm | no |
| iSDAsoil `carbon_organic` | concentration, g/kg, 0–20 and 20–50 cm, 30 m, all Africa | no |

Note the interval-vs-point-depth difference between SoilGrids 2.0 and OpenLandMap: aggregating
them to a common depth needs different arithmetic (thickness weighting vs trapezoidal
integration). SoilGrids **1.0** used point depths, so older ISRIC documentation describing
trapezoidal integration does not apply to 2.0. An easy trap, and one more reason not to mix
these products.

### Why the conversion is not worth doing for the global layers

ISRIC is explicit that `ocs` is **not** derived from the published `soc`/`bdod`/`cfvo` map
layers:

> "To calculate carbon stocks, first we modelled the carbon density from SOC concentration, bulk
> density and proportion of coarse fragments **for each observation**. Then, the weighted sum of
> the carbon densities for the observations between 0 and 30 cm was calculated. Finally, a
> Quantile Random Forest model was calibrated and used for the global map… The key point is that
> the carbon stock layer was not calculated from the carbon density layer, but from the soil
> observations."

That is the whole argument. ISRIC does the multiplication **at the profile**, where the three
properties are measured on the same physical sample and their real covariance is preserved, then
fits one model to the result. Multiplying three independently predicted *mean* surfaces is a
different and biased estimator — `E[XYZ] ≠ E[X]E[Y]E[Z]` under correlation, and because SOC
concentration and bulk density are strongly *negatively* correlated (carbon-rich soils are
low-density, one of the more robust relationships in pedology), the product of the means is
biased **high**.

So: reimplementing the conversion would reproduce `ocs_mean` at best, and more likely produce a
worse version of it. Grafting SoilGrids bulk density onto OpenLandMap's SOC would be worse
again — two models with no shared training data or covariance structure.

The one legitimate case is **a country's own concentration map converted with that country's own
bulk density**. That is an opt-in path to build when a country actually turns up with one, not a
reason to keep global concentration layers in the tool.

### Why a mean concentration is not a safe substitute either

An area-weighted mean concentration is valid arithmetic, but it is not the concentration of the
country's forest soil — that would be *mass*-weighted. Because concentration and bulk density are
negatively correlated, area-weighting over-weights peaty, low-density soils that occupy area but
hold little soil mass. On a deliberately simple two-soil test country the area-weighted mean came
out ~40% above the mass-weighted value, biased high in the direction least likely to be caught by
intuition.

Worse, the plausible ranges overlap: roughly 20–100 reads as reasonable whether the unit is g/kg
or t C/ha. A reporting officer has no "that can't be right" tripwire. The label would be the only
thing distinguishing them — and a CSV column outlives the session.

**Conclusion: the app ships stock layers only.** Concentration is still accepted as a user's own
asset, where they have explicitly declared what it is, and reported as a mean with the total
suppressed and a clear warning that it is not the FRA figure.

## Still to check

**How GSOCmap was made and validated.** It is a country-driven product — around 110 countries
prepared national 1 km maps under ITPS/GSP guidance, which the Global Soil Partnership harmonised
into the global layer. Strength for national ownership; weakness for cross-border consistency.

**Countries gap-filled by the GSP Secretariat rather than submitted** (v1.5): Angola, Benin,
Burkina Faso, Burundi, Botswana, Central African Republic, Congo, Côte d'Ivoire, Equatorial
Guinea, Gabon, Guinea, Guinea-Bissau, Liberia, Namibia, Rwanda, Sierra Leone, South Sudan, Togo,
Uganda, Zambia, Zimbabwe.

That list matters directly: it is heavily forested tropical Africa, exactly where FRA soil carbon
gap-filling is most needed, and exactly where GSOCmap is itself modelled rather than nationally
derived. **A gap-filled figure from a gap-filled map should be flagged as such.** Worth surfacing
in the app.

Still to check:

- the field sample network behind each country's contribution, and how uneven it is;
- what validation statistics were published, and at what scale they hold;
- whether the 1.5 revision changed anything material for forest areas specifically;
- **v1.6 now exists** — whether it changes units, depth, resolution or country coverage. The
  technical report was not retrievable (HTTP 403); ask FAO directly.

**Resolution.** Everything here is 250 m–1 km, which is coarse against a 30 m forest layer. The
mismatch is handled by summarising at 1 km, but it means small or fragmented forest areas are
poorly represented. Worth reviewing whether any finer global or regional SOC product exists —
`ISDASOIL/Africa/v1/carbon_organic` is 30 m but Africa only, and is a concentration.

**Depth.** GSOCmap is 0–30 cm only, and SoilGrids `ocs_mean` is *also* 0–30 cm only — the 30–100 cm
stock layer is listed by ISRIC as in development. So there is currently **no global soil carbon
stock product below 30 cm**. If FRA asks for a deeper interval, the answer is not "switch
dataset"; it is that the data does not exist and would have to be derived from concentration
layers, with all the problems above.

Useful reference points if the depth question is reopened — proportion of first-metre SOC held in
the top 20 cm, from Jobbágy & Jackson (2000, *Ecological Applications* 10:423–436, n = 2721
profiles):

| Biome | % of 0–100 cm SOC in top 20 cm |
|---|---|
| Temperate deciduous forest | 52 |
| Boreal forest | 50 |
| Temperate evergreen forest | 47 |
| Tropical evergreen forest | 44 |
| Tropical deciduous forest | 33 |

De Vos et al. (2015, *Geoderma* 251–252), from 4,914 ICP Forests plots across 22 European
countries, independently reproduce the ~50% figure and give **55–65% of first-metre SOC in the
top 30 cm** for European forests. So a 0–30 cm figure captures roughly two thirds of the
first-metre stock in forest — and materially less in tropical deciduous forest, where the profile
is deepest.

### SoilGrids OCS caveats that matter specifically for forest

From ISRIC's own documentation and Poggio et al. (2021):

- **Litter layers are excluded.** "Litter layers on top of mineral soils were excluded from
  further modelling." The O horizon — a substantial and highly variable carbon pool in forest —
  is not in the stock. For peat, the top of the peat layer is taken as the soil surface.
- **Masked areas.** Predictions are restricted to land without built-up, water or glacier, using
  an ESA Land Cover 2015 mask. This is a direct cause of the coverage gaps the app now reports.
- **Model efficiency coefficient for SOC is 0.54.** Not a precision instrument.
- **ISRIC explicitly discourage local use:** "SoilGrids is a global model intended for global
  applications, the results are best suited for continental or macro region analysis."
- SoilGrids 2.0 values are **midpoint point predictions declared constant across each interval**,
  not spline-integrated interval means — SoilGrids 1.0 (2017) used point depths and needed
  trapezoidal integration, so older ISRIC guidance does not transfer. Another reason the two
  generations should not be mixed.

**Forest-specific validation.** All these products are trained on soil profiles that are not
evenly distributed with respect to forest. Whether the maps are systematically biased inside
forest, relative to their overall accuracy, is the question that actually matters here and is not
answered by published global validation statistics.

## If depth harmonisation is ever needed

Not needed today — every layer offered is already a single 0–30 cm value. Recorded so it is not
reinvented badly later.

FAO's own *Soil Organic Carbon Mapping Cookbook* prescribes **equal-area (mass-preserving)
splines** (`GSIF::mpspline`, `mpspline2`, default λ = 0.1), after Ponce-Hernandez et al. (1986)
and Bishop et al. (1999), who found splines beat exponential and polynomial fits on every soil
attribute tested. That is the method to use, not ad hoc interpolation.

Two traps:

- **Layer means are not point values.** SoilGrids 2.0, ICP Forests and most inventories report a
  value that applies across an interval. The correct aggregation is a simple thickness-weighted
  mean — no interpolation. Applying a trapezoidal rule to layer means as if they were point
  depths introduces error for nothing. Products reporting at *point* depths (OpenLandMap,
  SoilGrids 1.0) do need integration, and mixing the two conventions is the easy mistake.
- **Trapezoidal interpolation over-estimates.** SOC declines convexly with depth, so a chord
  through 0/10/30 cm lies above the true curve. Using published forest exponential fits
  (Murphy et al. 2019, woodland k ≈ 0.081–0.128 cm⁻¹) the bias is **+7% to +22%** for 0–30 cm; a
  naive arithmetic mean of three point values is far worse, +25% to +54%. Corroborated by
  Hiederer (2009, JRC EUR 23980 EN), who states the mid-depth point value over-estimates the
  layer mean and gives a correction.
- **Exception: Podzols and Spodosols.** An ortstein or spodic horizon can make the 0–30 cm profile
  near-uniform or even peaked, so the convexity assumption fails. Schrumpf et al. (2011) measured
  essentially flat carbon density through 0–30 cm at Le Bray (French coniferous podzol). Relevant
  for boreal and temperate coniferous forest.

## Open

- Confirm with Isabella whether FAO wants gap-filled countries harmonised to 0–30 cm, or matched
  to the depth each country previously reported. The second is not possible with current global
  data — there is no global stock product below 30 cm — which is itself a finding worth relaying.
- Discuss recommended datasets with Isabella (see the action tracker).
- Decide whether to add the bulk-density conversion path for national concentration maps.
