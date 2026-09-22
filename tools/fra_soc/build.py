"""Build fra_soil_carbon.csv, fraSoc.js and notes.md from the raw FRA platform pulls."""
import csv
import json
import os
from datetime import date

DIR = os.path.dirname(os.path.abspath(__file__))
YEARS = ["1990", "2000", "2010", "2015", "2020", "2025"]
RETRIEVED = "2026-09-22"

load = lambda f: json.load(open(os.path.join(DIR, f), encoding="utf-8"))
d25, d20 = load("raw_2025.json"), load("raw_2020.json")
labels = load("area_en.json")
areas25, areas20 = load("areas_2025.json"), load("areas_2020.json")

desk25 = {c["countryIso"]: bool(c["props"].get("deskStudy")) for c in areas25["countries"]}
desk20 = {c["countryIso"]: bool(c["props"].get("deskStudy")) for c in areas20["countries"]}

isos = sorted(i for i in desk25 if not i.startswith("X"))  # drop Atlantis test areas


def soil_series(tabs, tname):
    """{year: (value_str, calculated_bool)} for carbon_forest_soil, ours years only."""
    out = {}
    for yr, cells in (tabs.get(tname) or {}).items():
        if yr not in YEARS:
            continue
        cell = (cells or {}).get("carbon_forest_soil") or {}
        raw = cell.get("raw")
        if raw not in (None, ""):
            out[yr] = (raw, bool(cell.get("calculated")))
    return out


def depth_of(tabs):
    cell = ((tabs.get("carbonStockSoilDepth") or {}).get("soil_depth") or {}).get("soil_depth") or {}
    return cell.get("raw")


def fmt(raw):
    """Normalise a raw value string: trim trailing zeros, cap at 2 dp."""
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return raw
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return s if s else "0"


rows = []
js_data = {}
n_val = n_desk_with_val = n_depth = n_fallback = 0

for iso in isos:
    t25, t20 = d25.get(iso, {}), d20.get(iso, {})
    s25 = soil_series(t25, "carbonStockAvg")
    s20 = soil_series(t20, "carbonStock")

    if s25:
        cycle, series, depth = "2025", s25, depth_of(t25) or depth_of(t20)
        desk = desk25.get(iso, False)
    elif s20:
        cycle, series, depth = "2020", s20, depth_of(t20) or depth_of(t25)
        desk = desk20.get(iso, False)
        n_fallback += 1
    else:
        cycle, series = None, {}
        depth = depth_of(t25) or depth_of(t20)
        desk = desk25.get(iso, False)

    name = labels.get(iso, {}).get("listName", iso)
    calc_years = [y for y in YEARS if y in series and series[y][1]]
    notes = []
    if cycle == "2020":
        notes.append("from FRA 2020 cycle (no value in FRA 2025)")
    if calc_years:
        notes.append("platform-calculated (derived, not directly entered): " + ", ".join(calc_years))
    if not series and depth:
        notes.append("soil depth reported without soil carbon values")

    source_type = ""
    if series or depth:
        source_type = "desk study" if desk else "country report"

    if series:
        n_val += 1
        if desk:
            n_desk_with_val += 1
    if depth:
        n_depth += 1

    row = {"country_name": name, "iso3": iso}
    for y in YEARS:
        row[f"soc_t_ha_{y}"] = fmt(series[y][0]) if y in series else ""
    row["soil_depth_cm"] = fmt(depth) if depth else ""
    row["source_type"] = source_type
    row["notes"] = "; ".join(notes)
    rows.append(row)

    if series or depth:
        entry = {"name": name, "cycle": cycle or "2025", "deskStudy": desk}
        if depth:
            entry["soilDepthCm"] = float(fmt(depth))
        soc = {y: float(fmt(series[y][0])) for y in YEARS if y in series}
        if soc:
            entry["soc"] = soc
        if calc_years:
            entry["calculatedYears"] = calc_years
        js_data[iso] = entry

# ---- CSV ----
cols = ["country_name", "iso3"] + [f"soc_t_ha_{y}" for y in YEARS] + ["soil_depth_cm", "source_type", "notes"]
with open(os.path.join(DIR, "fra_soil_carbon.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(rows)

# ---- fraSoc.js ----
data_js = json.dumps(js_data, indent=2, sort_keys=True)
js = f"""/**
 * fraSoc.js — FRA-reported forest soil organic carbon, per country.
 * Usage: var fraSoc = require('users/andyarnellgee/apps:modules/fraSoc.js');
 * Regenerate with tools/fra_soc/ (fetch.py + build.py).
 *
 * Source: FRA data platform API (fra-data.fao.org), the same JSON the platform frontend uses.
 *   Endpoint: /api/cycle-data/table/table-data?assessmentName=fra&cycleName=2025
 *             &tableNames[]=carbonStockAvg&tableNames[]=carbonStockSoilDepth&countryISOs[]=...
 *   (FRA 2020 cycle used as fallback, tableNames[]=carbonStock, where a country has no
 *   FRA 2025 value; entry.cycle says which.)
 * Table: FRA 2d "Carbon stock", category "Soil carbon", tonnes/ha; plus reported
 *   "Soil depth (cm) used for soil carbon".
 * Retrieved: {RETRIEVED}. Values flagged in calculatedYears were derived by the platform
 *   (e.g. per-ha value computed from reported totals), not entered directly.
 * deskStudy: true = FAO desk study for that country/cycle, not a country report.
 *
 * Plain JS lookup — no Earth Engine API calls.
 */

var DATA = {data_js};

// Case-insensitive name -> ISO3 index, built once.
var NAME_INDEX = {{}};
Object.keys(DATA).forEach(function (iso) {{
  NAME_INDEX[DATA[iso].name.toLowerCase()] = iso;
}});

var YEARS = ['1990', '2000', '2010', '2015', '2020', '2025'];

/**
 * Resolve an ISO3 code or a country name (as FRA spells it) to a DATA entry.
 * Returns null when unknown.
 */
function resolve(iso3OrName) {{
  if (!iso3OrName) return null;
  var key = String(iso3OrName).trim();
  if (DATA[key.toUpperCase()]) return DATA[key.toUpperCase()];
  var iso = NAME_INDEX[key.toLowerCase()];
  return iso ? DATA[iso] : null;
}}

/**
 * Short human-readable summary of the FRA-reported soil carbon for a country.
 * year is optional: omitted, the most recent reported year is used.
 * Returns e.g. "FRA-reported soil carbon (2020): 143.0 t/ha at 0-30 cm", or null
 * when the country has no reported soil carbon (for that year).
 */
function formatFRASoc(iso3OrName, year) {{
  var entry = resolve(iso3OrName);
  if (!entry || !entry.soc) return null;

  var y = null;
  if (year !== undefined && year !== null) {{
    y = String(year);
    if (entry.soc[y] === undefined) return null;
  }} else {{
    for (var i = YEARS.length - 1; i >= 0; i--) {{
      if (entry.soc[YEARS[i]] !== undefined) {{ y = YEARS[i]; break; }}
    }}
  }}
  if (y === null) return null;

  var s = 'FRA-reported soil carbon (' + y + '): ' + entry.soc[y].toFixed(1) + ' t/ha';
  if (entry.soilDepthCm) s += ' at 0-' + Math.round(entry.soilDepthCm) + ' cm';
  if (entry.deskStudy) s += ' (FAO desk study)';
  return s;
}}
"""

# Helper tail appended as a plain string so the JS braces need no f-string
# escaping. Keep in step with modules/fraSoc.js.
js += """
var VERSION = {
  cycle: 'FRA 2025, FRA 2020 fallback where entry.cycle says so',
  retrieved: '__RETRIEVED__',
  endpoint: 'fra-data.fao.org/api/cycle-data/table/table-data'
};

var CITATION = 'FAO. 2026. FRA Platform, accessed __RETRIEVED__. ' +
               'https://fra-data.fao.org. Licence: CC-BY-4.0.';

/**
 * Reported soil carbon for one year.
 * @param {string} iso3OrName
 * @param {number|string} year
 * @return {Object|null} {value, depthCm, deskStudy, cycle}, or null when the
 *     country has no figure for that year.
 */
function getSoc(iso3OrName, year) {
  var e = resolve(iso3OrName);
  if (!e || !e.soc) return null;
  var v = e.soc[String(year)];
  if (v === undefined || v === null) return null;
  return {value: v, depthCm: e.soilDepthCm || null,
          deskStudy: !!e.deskStudy, cycle: e.cycle};
}

/**
 * True when the soil-carbon table has a row for this country. NB the table
 * holds value-holders only: a non-reporter can be absent here and still file
 * FRA reports, so callers combine this with fraStats forest-area presence.
 * @param {string} iso3OrName
 * @return {boolean}
 */
function hasReport(iso3OrName) {
  return resolve(iso3OrName) !== null;
}

/**
 * True when the country has at least one reported soil carbon value in any
 * year. Some rows carry only the depth field (BDI, DJI, LBN) -- those return
 * false. Use this for "has a figure" tests; hasReport only proves a row.
 * @param {string} iso3OrName
 * @return {boolean}
 */
function hasValue(iso3OrName) {
  var e = resolve(iso3OrName);
  if (!e || !e.soc) return false;
  for (var i = 0; i < YEARS.length; i++) {
    if (e.soc[YEARS[i]] !== undefined && e.soc[YEARS[i]] !== null) return true;
  }
  return false;
}

/**
 * True when this country's FRA report is an FAO desk study -- the figures were
 * compiled by FAO, not reported by the country. Combine with hasValue to split
 * value-holders into country-reported vs gap-filled.
 * @param {string} iso3OrName
 * @return {boolean}
 */
function isDeskStudy(iso3OrName) {
  var e = resolve(iso3OrName);
  return e ? !!e.deskStudy : false;
}

exports.DATA = DATA;
exports.formatFRASoc = formatFRASoc;
exports.getSoc = getSoc;
exports.hasReport = hasReport;
exports.hasValue = hasValue;
exports.isDeskStudy = isDeskStudy;
exports.VERSION = VERSION;
exports.CITATION = CITATION;
""".replace("__RETRIEVED__", RETRIEVED)
with open(os.path.join(DIR, "fraSoc.js"), "w", encoding="utf-8") as f:
    f.write(js)

print(f"rows: {len(rows)}")
print(f"countries with any soil carbon value: {n_val} (desk studies among them: {n_desk_with_val})")
print(f"countries with soil depth: {n_depth}")
print(f"countries using FRA 2020 fallback: {n_fallback}")
print(f"js entries: {len(js_data)}")
