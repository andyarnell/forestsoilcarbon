# Soil carbon datasets — review

Working notes against the action "review soil carbon datasets and validation". Incomplete — this
is a live document, not a conclusion.

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

**Depth.** GSOCmap is 0–30 cm only. If FRA wants a deeper interval the dataset list changes
materially, since SoilGrids would become the only option with the depth coverage.

**Forest-specific validation.** All these products are trained on soil profiles that are not
evenly distributed with respect to forest. Whether the maps are systematically biased inside
forest, relative to their overall accuracy, is the question that actually matters here and is not
answered by published global validation statistics.

## Open

- Confirm the FRA reporting depth.
- Discuss recommended datasets with Isabella (see the action tracker).
- Decide whether to add the bulk-density conversion path for national concentration maps.
