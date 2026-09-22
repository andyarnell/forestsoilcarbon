# tools

Scrapers that generate the data modules in `modules/`. Not needed to run the app.

| Folder | Generates | Source |
|---|---|---|
| `gsoc_meta/` | `modules/gsocMeta.js` | GSOCmap v1.6 technical report PDF (FAO 2022, DOI 10.4060/cb9015en), Annex D |
| `fra_soc/` | `modules/fraSoc.js` | FRA data platform API (fra-data.fao.org), FRA 2025 with FRA 2020 fallback |

Run with the `py` launcher on Windows. Each script's header states its inputs.
Regenerate, review the diff, and bump the CHANGELOG when a source updates.
