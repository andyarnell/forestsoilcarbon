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
| SoilGrids 2.0 `ocs_mean` | stock, t/ha, 0–30 cm | yes |
| SoilGrids 2.0 `soc_mean` | concentration, dg/kg, 6 depth intervals | no, without conversion |
| OpenLandMap SOC | concentration, g/kg, 6 depths | no, without conversion |

Converting concentration to stock needs bulk density and coarse fragments. SoilGrids publishes
both (`bdod_mean`, `cfvo_mean`), so it is doable — but it is a real modelling step with its own
error, not a unit conversion, and SoilGrids already publishes `ocs_mean` for exactly this
reason. Adding the conversion is only worth it if a country's own map is a concentration.

The app therefore displays concentration layers but refuses to summarise them. Silently
producing a number would be worse than producing none.

## Still to check

**How GSOCmap was made and validated.** It is a country-driven product — national teams
contributed maps built to a common specification, which is a strength for national ownership and
a weakness for cross-border consistency. Needs checking:

- the field sample network behind each country's contribution, and how uneven it is;
- which countries submitted a national map versus having one modelled for them;
- what validation statistics were published, and at what scale they hold;
- whether the 1.5 revision changed anything material for forest areas specifically.

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
