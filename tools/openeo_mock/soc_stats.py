"""Country statistics for the openEO mock -- thin CLI over pipeline.py.

--forest accepts EITHER input type; pipeline.resolve_forest dispatches:
  * a fraction raster already on the carbon template grid -> used as-is;
  * a binary 0/1 raster on any other grid/CRS -> aggregated on the fly
    (reproject + average, area QA), optionally saved with --save-fraction.

Usage:
    py soc_stats.py --soc soc.tif --forest fraction_OR_binary.tif \
                    --boundary country.geojson [--out stats.csv] \
                    [--save-fraction frac.tif]
    py soc_stats.py --selftest
"""

import argparse
import csv

import numpy as np

import pipeline


def selftest():
    """Synthetic check of the arithmetic, no files needed."""
    from rasterio.transform import from_origin
    rows, cols = 40, 40
    t = from_origin(90.0, 28.0, 1 / 120.0, 1 / 120.0)  # 30 arc-sec
    area = pipeline.pixel_area_ha(t, (rows, cols))

    soc = np.full((rows, cols), 100.0)
    soc[:, :10] = np.nan                      # a soil-data gap band
    forest = np.full((rows, cols), 0.5)
    bfrac = np.ones((rows, cols))

    s = pipeline.compute_stats(soc, forest, bfrac, area)
    assert abs(s["mean_soc_t_ha"] - 100.0) < 1e-9, s
    assert abs(s["soc_data_coverage_pc"] - 75.0) < 1e-9, s
    expected = 0.5 * area.sum()
    assert abs(s["forest_area_ha"] - expected) / expected < 1e-12, s
    assert 70 < area[0, 0] < 80, area[0, 0]  # ~30 arc-sec cell at 27.8N
    print("selftest OK: mean, coverage, areas and pixel-area all as expected")


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--soc", help="soil carbon stock raster, t/ha -- defines the grid")
    p.add_argument("--forest", help="forest fraction on that grid, OR binary 0/1 on any grid")
    p.add_argument("--boundary", help="country boundary GeoJSON")
    p.add_argument("--out", help="optional CSV to append the stats row to")
    p.add_argument("--save-fraction", help="if the forest input was binary, also "
                                           "write the derived fraction here")
    p.add_argument("--selftest", action="store_true")
    a = p.parse_args()

    if a.selftest:
        selftest()
        return
    if not (a.soc and a.forest and a.boundary):
        p.error("--soc, --forest and --boundary are required (or --selftest)")

    stats, note, qa = pipeline.country_stats(a.soc, a.forest, a.boundary)
    print(f"forest input:           {note}")
    print(f"forest area:            {stats['forest_area_ha'] / 1000:,.1f} kha")
    print(f"  with soil data:       {stats['forest_area_with_soc_ha'] / 1000:,.1f} kha "
          f"({stats['soc_data_coverage_pc']:.1f}% coverage)")
    print(f"total soil carbon:      {stats['soc_in_forest_total_t'] / 1e6:,.1f} Mt C")
    print(f"mean soil carbon:       {stats['mean_soc_t_ha']:.2f} t C/ha")

    if a.save_fraction and qa is not None:
        soc_grid = pipeline.read_grid(a.soc)
        fraction, _, _ = pipeline.resolve_forest(a.forest, soc_grid)
        pipeline.write_fraction(a.save_fraction, fraction.astype("float32"),
                                soc_grid, qa)
        print(f"derived fraction saved: {a.save_fraction}")

    if a.out:
        with open(a.out, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(stats))
            if f.tell() == 0:
                w.writeheader()
            w.writerow(stats)
        print(f"appended to {a.out}")


if __name__ == "__main__":
    main()
