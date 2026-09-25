"""Ingest step of the openEO mock -- thin CLI over pipeline.aggregate_binary.

Binary 0/1 forest raster (any CRS, national projections welcome) ->
fraction on the carbon template grid, streamed, with the rules enforced:
binary-only input, nodata policy decided at export, source-vs-aggregated
area QA within 0.5% or nothing is written. Output feeds soc_stats.py
(which can also do this step on the fly; run it separately when you want
the cached fraction and its JSON sidecar).

Usage:
    py preprocess_forest.py --binary jrc10m_btn.tif --template soc_btn.tif \
                            --out jrc10m_frac_btn.tif
    py preprocess_forest.py --selftest
"""

import argparse
import os

import numpy as np

import pipeline


def run(binary_path, template_path, out_path):
    template = pipeline.read_grid(template_path)
    fraction, qa = pipeline.aggregate_binary(binary_path, template)
    print(f"forest area, source grid:     {qa['qa_source_area_ha'] / 1000:,.1f} kha")
    print(f"forest area, aggregated:      {qa['qa_aggregated_area_ha'] / 1000:,.1f} kha "
          f"({qa['qa_diff_pc']:+.3f}%)")
    qa["template"] = os.path.basename(template_path)
    pipeline.write_fraction(out_path, fraction, template, qa)
    print(f"wrote {out_path} (+ .json sidecar). Use it as --forest in soc_stats.py")


def selftest():
    """Synthetic 10x-finer binary -> known fractions, in temp files."""
    import tempfile
    import rasterio
    from rasterio.transform import from_origin

    with tempfile.TemporaryDirectory() as d:
        tpl_t = from_origin(90.0, 28.0, 1 / 120.0, 1 / 120.0)
        fine_t = from_origin(90.0, 28.0, 1 / 1200.0, 1 / 1200.0)
        tpl = os.path.join(d, "tpl.tif")
        fine = os.path.join(d, "fine.tif")
        out = os.path.join(d, "frac.tif")

        with rasterio.open(tpl, "w", driver="GTiff", height=20, width=20,
                           count=1, dtype="float32", crs="EPSG:4326",
                           transform=tpl_t) as f:
            f.write(np.zeros((20, 20), "float32"), 1)
        arr = np.zeros((200, 200), "uint8")
        arr[:, ::2] = 1  # alternate columns: every template cell half forest
        with rasterio.open(fine, "w", driver="GTiff", height=200, width=200,
                           count=1, dtype="uint8", crs="EPSG:4326",
                           transform=fine_t) as f:
            f.write(arr, 1)

        run(fine, tpl, out)
        with rasterio.open(out) as f:
            assert np.allclose(f.read(1), 0.5, atol=1e-6)
    print("selftest OK: checkerboard aggregated to exactly 0.5 and QA passed")


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--binary", help="binary 0/1 forest raster (any CRS)")
    p.add_argument("--template", help="carbon-grid raster defining the target grid")
    p.add_argument("--out", help="output fraction GeoTIFF")
    p.add_argument("--selftest", action="store_true")
    a = p.parse_args()
    if a.selftest:
        selftest()
        return
    if not (a.binary and a.template and a.out):
        p.error("--binary, --template and --out are required (or --selftest)")
    run(a.binary, a.template, a.out)


if __name__ == "__main__":
    main()
