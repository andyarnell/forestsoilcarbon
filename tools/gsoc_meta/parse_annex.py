"""Parse Annex D (GSOCmap submission overview) of the GSOCmap v1.6 Technical
Report (FAO 2022, doi 10.4060/cb9015en) into per-country records -> JSON."""
import json, re, sys

SRC = "fulltext.txt"
PAGE_OFFSET = 24  # PDF page 100 == printed page 76

with open(SRC, encoding="utf-8") as f:
    lines = f.read().splitlines()

# start at PDF page 100
start = next(i for i, l in enumerate(lines) if l.strip() == "===PAGE 100===")
lines = lines[start:]

SECTION_KEYS = {
    "GSOCmap layer source:", "Data specifications:",
    "Methodological specifications:", "Contact Point:", "Details:",
}
FIELD_KEYS = [  # longest-prefix first where overlapping
    "Map source:", "Number of samples:", "Time frame:",
    "Soil Organic Carbon method:", "Bulk density method:",
    "Coarse fragments method:", "Citation:", "Mapping technique:",
    "Mapping method details:", "Mapping method:", "Validation:",
    "Data holder:", "Dataholder:", "Institution:", "Email or website:",
]

header_re = re.compile(r"^(?:\d+\s+)?Annex D: GSOCmap submission overview(?:\s+\d+)?$")
pagenum_re = re.compile(r"^\d{1,3}$")
pagemark_re = re.compile(r"^===PAGE (\d+)===$")
entry_re = re.compile(r"^D(\d+): (.+)$")

entries = []
cur = None          # current entry dict
cur_field = None    # (fieldname stored key)
cur_section = None
pdf_page = 100
pending_name = False  # heading may wrap to next line

def new_field_key(section, key):
    base = key.rstrip(":")
    m = {
        "Map source": "map_source", "Number of samples": "n_samples",
        "Time frame": "time_frame", "Soil Organic Carbon method": "soc_method",
        "Bulk density method": "bd_method", "Coarse fragments method": "cf_method",
        "Citation": "citation", "Mapping technique": "mapping_technique",
        "Mapping method": "mapping_method", "Mapping method details": "mapping_method_details",
        "Validation": "validation", "Data holder": "data_holder",
        "Dataholder": "data_holder", "Email or website": "contact",
    }
    if base == "Institution":
        return "institution_details" if section == "Details:" else "institution"
    return m[base]

for raw in lines:
    line = raw.strip()
    m = pagemark_re.match(line)
    if m:
        pdf_page = int(m.group(1))
        continue
    if not line or header_re.match(line) or pagenum_re.match(line):
        continue
    m = entry_re.match(line)
    if m and not line.endswith("."):  # body headings never end with dots
        cur = {"idx": int(m.group(1)), "name": m.group(2).strip(),
               "page": pdf_page - PAGE_OFFSET}
        entries.append(cur)
        cur_field = None
        cur_section = None
        pending_name = True
        continue
    if cur is None:
        continue  # annex intro text
    if line in SECTION_KEYS:
        cur_section = line
        cur_field = None
        pending_name = False
        continue
    matched = None
    for k in FIELD_KEYS:
        if line.startswith(k):
            matched = k
            break
    # ensure "Mapping method:" not matched inside "Mapping method details:"
    if matched == "Mapping method:" and line.startswith("Mapping method details:"):
        matched = "Mapping method details:"
    if matched:
        key = new_field_key(cur_section, matched)
        val = line[len(matched):].strip()
        if key in cur:
            key = key + "_2"
        cur[key] = val
        cur_field = key
        pending_name = False
        continue
    if pending_name:
        cur["name"] += " " + line
        pending_name = False
        continue
    if cur_field:
        cur[cur_field] = (cur[cur_field] + " " + line).strip()
    # else stray line: ignore but log
    else:
        cur.setdefault("_stray", []).append(line)

print("entries:", len(entries))
missing_src = [e["name"] for e in entries if "map_source" not in e]
print("missing map_source:", missing_src)
dups = [k for e in entries for k in e if k.endswith("_2")]
print("duplicate-key fields:", set(dups))
strays = [(e["name"], e["_stray"]) for e in entries if "_stray" in e]
print("entries with stray lines:", len(strays))
for n, s in strays[:10]:
    print("  ", n, "->", s[:2])
with open("annex_parsed.json", "w", encoding="utf-8") as f:
    json.dump(entries, f, ensure_ascii=False, indent=1)
