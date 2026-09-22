# Build gsoc_country_metadata.csv and gsocMeta.js from annex_parsed.json
import csv, json, datetime

es = json.load(open("annex_parsed.json", encoding="utf-8"))

NAME_FIX = {
    "United Kingdom of Great Britain and North- ern Ireland":
        "United Kingdom of Great Britain and Northern Ireland",
}

ISO3 = {
 "Afghanistan":"AFG","Albania":"ALB","Algeria":"DZA","Andorra":"AND","Angola":"AGO",
 "Antigua and Barbuda":"ATG","Argentina":"ARG","Armenia":"ARM","Australia":"AUS",
 "Austria":"AUT","Azerbaijan":"AZE","Bahamas":"BHS","Bahrain":"BHR","Bangladesh":"BGD",
 "Barbados":"BRB","Belarus":"BLR","Belgium":"BEL","Belize":"BLZ","Benin":"BEN",
 "Bhutan":"BTN","Bolivia (Plurinational State of)":"BOL","Bosnia and Herzegovina":"BIH",
 "Botswana":"BWA","Brazil":"BRA","Brunei Darussalam":"BRN","Bulgaria":"BGR",
 "Burkina Faso":"BFA","Burundi":"BDI","Cambodia":"KHM","Cameroon":"CMR","Canada":"CAN",
 "Cape Verde":"CPV","Central African Republic":"CAF","Chad":"TCD","Chile":"CHL",
 "China":"CHN","Colombia":"COL","Comoros":"COM","Congo":"COG","Cook Islands":"COK",
 "Costa Rica":"CRI","Côte d’Ivoire":"CIV","Croatia":"HRV","Cuba":"CUB",
 "Cyprus":"CYP","Czech Republic":"CZE",
 "Democratic People’s Republic of Korea":"PRK",
 "Democratic Republic of the Congo":"COD","Denmark":"DNK","Djibouti":"DJI",
 "Dominica":"DMA","Dominican Republic":"DOM","Ecuador":"ECU","Egypt":"EGY",
 "El Salvador":"SLV","Equatorial Guinea":"GNQ","Eritrea":"ERI","Estonia":"EST",
 "Eswatini":"SWZ","Ethiopia":"ETH","Faroe Islands":"FRO","Fiji":"FJI","Finland":"FIN",
 "France":"FRA","Gabon":"GAB","Gambia":"GMB","Georgia":"GEO","Germany":"DEU",
 "Ghana":"GHA","Greece":"GRC","Grenada":"GRD","Guatemala":"GTM","Guinea":"GIN",
 "Guinea-Bissau":"GNB","Guyana":"GUY","Haiti":"HTI","Honduras":"HND","Hungary":"HUN",
 "Iceland":"ISL","India":"IND","Indonesia":"IDN","Iran (Islamic Republic of)":"IRN",
 "Iraq":"IRQ","Ireland":"IRL","Israel":"ISR","Italy":"ITA","Jamaica":"JAM",
 "Japan":"JPN","Jordan":"JOR","Kazakhstan":"KAZ","Kenya":"KEN","Kiribati":"KIR",
 "Kuwait":"KWT","Kyrgyzstan":"KGZ","Lao People’s Democratic Republic":"LAO",
 "Latvia":"LVA","Lebanon":"LBN","Lesotho":"LSO","Liberia":"LBR","Libya":"LBY",
 "Lithuania":"LTU","Luxembourg":"LUX","Madagascar":"MDG","Malawi":"MWI",
 "Malaysia":"MYS","Maldives":"MDV","Mali":"MLI","Malta":"MLT",
 "Marshall Islands":"MHL","Mauritania":"MRT","Mauritius":"MUS","Mexico":"MEX",
 "Micronesia (Federated States of)":"FSM","Monaco":"MCO","Mongolia":"MNG",
 "Montenegro":"MNE","Morocco":"MAR","Mozambique":"MOZ","Myanmar":"MMR",
 "Namibia":"NAM","Nauru":"NRU","Nepal":"NPL","Netherlands":"NLD","New Zealand":"NZL",
 "Nicaragua":"NIC","Niger":"NER","Nigeria":"NGA","Niue":"NIU",
 "North Macedonia":"MKD","Norway":"NOR","Oman":"OMN","Pakistan":"PAK","Palau":"PLW",
 "Panama":"PAN","Papua New Guinea":"PNG","Paraguay":"PRY","Peru":"PER",
 "Philippines":"PHL","Poland":"POL","Portugal":"PRT","Qatar":"QAT",
 "Republic of Korea":"KOR","Republic of Moldova":"MDA","Romania":"ROU",
 "Russian Federation":"RUS","Rwanda":"RWA","Saint Kitts and Nevis":"KNA",
 "Saint Lucia":"LCA","Saint Vincent and the Grenadines":"VCT","Samoa":"WSM",
 "Sao Tome e Principe":"STP","Saudi Arabia":"SAU","Senegal":"SEN","Serbia":"SRB",
 "Seychelles":"SYC","Sierra Leone":"SLE","Singapore":"SGP","Slovakia":"SVK",
 "Slovenia":"SVN","Solomon Islands":"SLB","Somalia":"SOM","South Africa":"ZAF",
 "South Sudan":"SSD","Spain":"ESP","Sri Lanka":"LKA","Sudan":"SDN",
 "Suriname":"SUR","Sweden":"SWE","Switzerland":"CHE","Syrian Arab Republic":"SYR",
 "Tajikistan":"TJK","United Republic of Tanzania":"TZA","Thailand":"THA",
 "Timor-Leste":"TLS","Togo":"TGO","Tokelau":"TKL","Tonga":"TON",
 "Trinidad and Tobago":"TTO","Tunisia":"TUN","Turkey":"TUR","Turkmenistan":"TKM",
 "Tuvalu":"TUV","Uganda":"UGA","Ukraine":"UKR","United Arab Emirates":"ARE",
 "United Kingdom of Great Britain and Northern Ireland":"GBR",
 "United States of America":"USA","Uruguay":"URY","Uzbekistan":"UZB",
 "Vanuatu":"VUT","Venezuela (Bolivarian Republic of)":"VEN","Viet Nam":"VNM",
 "Yemen":"YEM","Zambia":"ZMB","Zimbabwe":"ZWE",
}

def clean(s):
    return " ".join((s or "").split())

rows = []
for e in es:
    name = NAME_FIX.get(clean(e["name"]), clean(e["name"]))
    ms = clean(e.get("map_source", ""))
    if ms == "GSP gap-filling":
        gap = "yes"
    elif ms == "External (soilgrids.org)":
        gap = "yes"
    elif ms in ("Country submission", "Joint effort with GSP"):
        gap = "no"
    else:
        gap = "unknown"

    inst = clean(e.get("institution", ""))
    if inst in ("", "N/A", "NA"):
        inst = clean(e.get("institution_details", ""))
    if inst in ("N/A", "NA"):
        inst = ""

    mt = clean(e.get("mapping_technique", ""))
    mm = clean(e.get("mapping_method", ""))
    if ms == "External (soilgrids.org)":
        meth = "External product (SoilGrids 2.0)"
    elif mt and mm and mm.lower() != mt.lower():
        meth = f"{mt} ({mm})"
    else:
        meth = mt or mm
    if meth in ("N/A", "NA"):
        meth = ""

    n = clean(e.get("n_samples", ""))
    tf = clean(e.get("time_frame", ""))
    if tf in ("N/A", "NA"):
        tf = ""

    notes = f"Map source: {ms}."
    if ms == "External (soilgrids.org)":
        notes += " Layer taken from SoilGrids 2.0 (Poggio et al. 2021), not a national submission."
    elif ms == "Joint effort with GSP":
        notes += " Map produced jointly by the country and the GSP Secretariat."
    if tf == "external datasets" or mt == "external datasets":
        notes += " Report gives 'external datasets' for some data-specification fields."

    rows.append({
        "country_name": name,
        "iso3": ISO3.get(name, ""),
        "institution": inst,
        "methodology": meth,
        "n_samples": n,
        "sampling_period": tf,
        "gap_filled": gap,
        "notes": notes,
        "source": f"GSOCmap v1.6 Technical Report (FAO 2022), Annex D, p. {e['page']}",
    })

unmapped = [r["country_name"] for r in rows if not r["iso3"]]
print("unmapped iso3:", unmapped)
assert len(rows) == 195

with open("gsoc_country_metadata.csv", "w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)

# ---- gsocMeta.js ----
today = datetime.date.today().isoformat()
key_of = {r["country_name"]: (r["iso3"] or r["country_name"]) for r in rows}
obj_lines = []
for r in rows:
    k = key_of[r["country_name"]]
    fields = {kk: r[kk] for kk in ("country_name", "iso3", "institution",
              "methodology", "n_samples", "sampling_period", "gap_filled",
              "notes", "source")}
    obj_lines.append("  " + json.dumps(k, ensure_ascii=False) + ": "
                     + json.dumps(fields, ensure_ascii=False) + ",")
body = "\n".join(obj_lines)

js = f"""/**
 * gsocMeta.js — per-country provenance metadata for FAO GSOCmap v1.6.
 *
 * Source: FAO. 2022. Global Soil Organic Carbon Map — GSOCmap v.1.6.
 * Technical report. Rome. https://doi.org/10.4060/cb9015en (Annex D,
 * "GSOCmap submission overview", printed pp. 76-238).
 * Extracted: {today}. 195 country entries (report skips index numbers
 * D134 and D152; no country is missing).
 *
 * Keyed by ISO3 code; a country name is used as the key only where no
 * unambiguous ISO3 exists (none in this version). gap_filled is "yes"
 * when the layer was produced by the GSP Secretariat gap-filling or
 * taken from an external product (SoilGrids 2.0), "no" for country
 * submissions and joint efforts (see each entry's notes).
 *
 * Draft lookup module — plain data, no Earth Engine API calls.
 * Usage: var gsocMeta = require('users/.../modules:gsocMeta.js');
 */

var META = {{
{body}
}};

// Index by country name as well, so formatGSOC accepts either.
var BY_NAME = {{}};
Object.keys(META).forEach(function (k) {{
  BY_NAME[META[k].country_name.toLowerCase()] = META[k];
}});

/**
 * One-line human-readable summary for a country.
 * @param {{string}} iso3OrName ISO3 code (any case) or country name.
 * @return {{string|null}} Summary string, or null when absent.
 */
function formatGSOC(iso3OrName) {{
  if (!iso3OrName) return null;
  var key = String(iso3OrName).trim();
  var m = META[key.toUpperCase()] || BY_NAME[key.toLowerCase()] || null;
  if (!m) return null;
  var parts = [m.country_name + " (GSOCmap v1.6)"];
  parts.push(m.gap_filled === "yes" ? "gap-filled: yes" : "gap-filled: no");
  if (m.methodology) parts.push(m.methodology);
  if (m.n_samples !== "") parts.push(m.n_samples + " samples");
  if (m.sampling_period) parts.push("period: " + m.sampling_period);
  if (m.institution) parts.push(m.institution);
  return parts.join("; ");
}}

exports.META = META;
exports.formatGSOC = formatGSOC;
"""
with open("gsocMeta.js", "w", encoding="utf-8") as f:
    f.write(js)

# summary numbers for the report
from collections import Counter
cms = Counter(clean(e.get("map_source", "")) for e in es)
print("map_source counts:", dict(cms))
print("rows with n_samples:", sum(1 for r in rows if r["n_samples"] != ""))
print("rows with sampling_period:", sum(1 for r in rows if r["sampling_period"] != ""))
print("rows with institution:", sum(1 for r in rows if r["institution"] != ""))
print("rows with methodology:", sum(1 for r in rows if r["methodology"] != ""))
print("gap_filled yes:", sum(1 for r in rows if r["gap_filled"] == "yes"))
