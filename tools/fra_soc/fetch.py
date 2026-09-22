"""Fetch FRA soil carbon (table 2d) data from fra-data.fao.org API for all countries."""
import json
import os
import subprocess
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
CURL = os.path.join(os.environ.get("SystemRoot", r"C:\Windows"), "System32", "curl.exe")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
BASE = "https://fra-data.fao.org/api"


def curl_json(url):
    out = subprocess.run(
        [CURL, "-sSL", "--ssl-no-revoke", "-A", UA, "-m", "120", url],
        capture_output=True, text=True, encoding="utf-8")
    if out.returncode != 0:
        raise RuntimeError(f"curl failed ({out.returncode}): {out.stderr[:300]} for {url[:200]}")
    return json.loads(out.stdout)


def fetch_cycle(cycle, tables, isos, chunk=40):
    """Return merged {ISO: {tableName: {...}}} for one cycle."""
    merged = {}
    for i in range(0, len(isos), chunk):
        group = isos[i:i + chunk]
        params = [f"assessmentName=fra", f"cycleName={cycle}", f"countryIso={group[0]}"]
        params += [f"countryISOs[]={iso}" for iso in group]
        params += [f"tableNames[]={t}" for t in tables]
        url = f"{BASE}/cycle-data/table/table-data?" + "&".join(params)
        data = curl_json(url)
        block = data.get("fra", {}).get(cycle, {})
        merged.update(block)
        print(f"  cycle {cycle}: fetched {i + len(group)}/{len(isos)} (got {len(block)} with data)", flush=True)
    return merged


def main():
    areas25 = json.load(open(os.path.join(DIR, "areas_2025.json"), encoding="utf-8"))
    isos = sorted(c["countryIso"] for c in areas25["countries"])
    print(f"{len(isos)} countries in FRA 2025 area list")

    # carbonStockAvg = the tonnes/ha table; carbonStockTotal = the million-tonnes
    # table (2d has both; the platform derives whichever the country left blank,
    # cell flag "calculated"). The 2020 schema has no totals table.
    data25 = fetch_cycle("2025", ["carbonStockAvg", "carbonStockSoilDepth", "carbonStockTotal"], isos)
    json.dump(data25, open(os.path.join(DIR, "raw_2025.json"), "w", encoding="utf-8"))

    data20 = fetch_cycle("2020", ["carbonStock", "carbonStockSoilDepth"], isos)
    json.dump(data20, open(os.path.join(DIR, "raw_2020.json"), "w", encoding="utf-8"))

    # desk-study flags for the 2020 cycle too
    areas20 = curl_json(f"{BASE}/area/areas?assessmentName=fra&cycleName=2020")
    json.dump(areas20, open(os.path.join(DIR, "areas_2020.json"), "w", encoding="utf-8"))
    print("done")


if __name__ == "__main__":
    sys.exit(main())
