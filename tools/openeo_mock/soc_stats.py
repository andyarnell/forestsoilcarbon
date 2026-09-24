"""Mock of the openEO soil-carbon workflow: analysis and statistics only.

Reproduces the app's four figures for one country from local/Drive COGs,
with each step named after the openEO process it stands for, so this file
doubles as the pilot's process graph written out in plain numpy:

    load_collection        -> load_cube()          (load_stac / load_uploaded_files)
    resample_cube_spatial  -> require_same_grid()  (a no-op here by design: both
                              rasters are exported on the carbon layer's grid)
    pixel area raster      -> pixel_area_ha()      (the template's companion
                              area layer; openEO has no pixelArea process)
    mask / merge_cubes     -> the array arithmetic in run()
    aggregate_spatial      -> boundary_fraction() + the sums in run()
                              (fractional pixel coverage, exactextract-style,
                              via supersampled rasterization -- openEO backends
                              differ here, which is a question for the platform)

Method (identical to the GEE app at native scale):
    mean t/ha = sum(soc * forest_ha, where soc has data)
              / sum(forest_ha, where soc has data)
with forest_ha = forest_fraction * pixel_area_ha * boundary_fraction, and
coverage % = forest-with-soil-data / all forest.

Usage:
    py soc_stats.py --soc mock_soc_gsoc_btn.tif --forest mock_forest_jrc_btn.tif \
                    --boundary mock_boundary_btn.geojson [--out stats.csv]
    py soc_stats.py --selftest
"""

import argparse
import csv
import json
import math
import sys

import numpy as np

EARTH_RADIUS_M = 6371007.181  # authalic radius, as used by ee.Image.pixelArea
SUPERSAMPLE = 10              # boundary rasterized at 1/10 cell size


def load_cube(path):
    """One raster band + its georeferencing. Stands for openEO load_collection."""
    import rasterio
    with rasterio.open(path) as src:
        arr = src.read(1).astype("float64")
        if src.nodata is not None:
            arr[arr == src.nodata] = np.nan
        arr[arr == -9999] = np.nan  # the export script's explicit sentinel
        return arr, src.transform, src.crs


def require_same_grid(t_a, t_b, shape_a, shape_b):
    """Stands for resample_cube_spatial. Here it must be a no-op: both inputs
    are exported on the carbon layer's grid, so anything else is an input
    error, not something to paper over silently."""
    if shape_a != shape_b or any(abs(a - b) > 1e-9 for a, b in zip(t_a[:6], t_b[:6])):
        sys.exit("Inputs are not on the same grid. Re-export both rasters with "
                 "the carbon layer's crsTransform (see export_inputs_btn.js) -- "
                 "the mock deliberately refuses to resample carbon.")


def pixel_area_ha(transform, shape):
    """Per-pixel area in hectares on a geographic grid, one value per row:
    the template's companion pixel-area raster from the concept note."""
    rows, cols = shape
    _, _, _, _, e, f = transform[:6]  # e = -lat step for north-up rasters
    lat_top = np.array([transform * (0, r) for r in range(rows)])[:, 1]
    lat_bot = lat_top + e
    dlon = math.radians(abs(transform[0]))
    band_m2 = (EARTH_RADIUS_M ** 2) * dlon * np.abs(
        np.sin(np.radians(lat_top)) - np.sin(np.radians(lat_bot)))
    return np.repeat((band_m2 / 1e4)[:, None], cols, axis=1)


def boundary_fraction(geojson_path, transform, shape):
    """Fraction of each cell inside the country: fractional pixel coverage in
    the exactextract sense, via supersampled rasterization. Stands for the
    geometry side of aggregate_spatial."""
    from rasterio import features, transform as rtransform
    geoms = []
    with open(geojson_path, encoding="utf-8") as f:
        gj = json.load(f)
    for feat in gj.get("features", [gj]):
        geoms.append(feat["geometry"] if "geometry" in feat else feat)

    rows, cols = shape
    fine = rtransform.Affine(transform[0] / SUPERSAMPLE, transform[1], transform[2],
                             transform[3], transform[4] / SUPERSAMPLE, transform[5])
    fine_mask = features.rasterize(
        [(g, 1) for g in geoms], out_shape=(rows * SUPERSAMPLE, cols * SUPERSAMPLE),
        transform=fine, fill=0, dtype="uint8")
    return fine_mask.reshape(rows, SUPERSAMPLE, cols, SUPERSAMPLE).mean(axis=(1, 3))


def run(soc, forest_frac, bfrac, area_ha):
    """The overlay and the four figures. Everything from here down is exactly
    the app's computeCountryStats, in numpy."""
    forest_ha = np.nan_to_num(forest_frac) * area_ha * bfrac
    has_soc = ~np.isnan(soc)
    forest_with_soc_ha = np.where(has_soc, forest_ha, 0.0)
    weighted = np.where(has_soc, np.nan_to_num(soc) * forest_with_soc_ha, 0.0)

    area_all = forest_ha.sum()
    area_with = forest_with_soc_ha.sum()
    total_t = weighted.sum()
    return {
        "forest_area_ha": area_all,
        "forest_area_with_soc_ha": area_with,
        "soc_in_forest_total_t": total_t,
        "mean_soc_t_ha": total_t / area_with if area_with > 0 else float("nan"),
        "soc_data_coverage_pc": 100.0 * area_with / area_all if area_all > 0 else float("nan"),
    }


def selftest():
    """Synthetic check of the arithmetic, no files needed."""
    rows, cols = 40, 40
    from rasterio import transform as rtransform
    t = rtransform.from_origin(90.0, 28.0, 1 / 120.0, 1 / 120.0)  # 30 arc-sec
    area = pixel_area_ha(t, (rows, cols))

    soc = np.full((rows, cols), 100.0)
    soc[:, :10] = np.nan                      # a soil-data gap band
    forest = np.full((rows, cols), 0.5)
    bfrac = np.ones((rows, cols))

    s = run(soc, forest, bfrac, area)
    assert abs(s["mean_soc_t_ha"] - 100.0) < 1e-9, s
    assert abs(s["soc_data_coverage_pc"] - 75.0) < 1e-9, s
    expected_area = 0.5 * area.sum()
    assert abs(s["forest_area_ha"] - expected_area) / expected_area < 1e-12, s
    # ~30 arc-sec cell at 27.8N should be ~76 ha (86 ha at equator * cos(lat))
    assert 70 < area[0, 0] < 80, area[0, 0]
    print("selftest OK: mean, coverage, areas and pixel-area all as expected")


def main():
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--soc", help="soil carbon stock COG, t/ha, carbon layer's grid")
    p.add_argument("--forest", help="forest fraction COG (0-1), same grid")
    p.add_argument("--boundary", help="country boundary GeoJSON")
    p.add_argument("--out", help="optional CSV to append the stats row to")
    p.add_argument("--selftest", action="store_true")
    a = p.parse_args()

    if a.selftest:
        selftest()
        return
    if not (a.soc and a.forest and a.boundary):
        p.error("--soc, --forest and --boundary are required (or --selftest)")

    soc, t_soc, _ = load_cube(a.soc)
    forest, t_for, _ = load_cube(a.forest)
    require_same_grid(t_soc, t_for, soc.shape, forest.shape)

    stats = run(soc, forest,
                boundary_fraction(a.boundary, t_soc, soc.shape),
                pixel_area_ha(t_soc, soc.shape))

    print(f"forest area:            {stats['forest_area_ha'] / 1000:,.1f} kha")
    print(f"  with soil data:       {stats['forest_area_with_soc_ha'] / 1000:,.1f} kha "
          f"({stats['soc_data_coverage_pc']:.1f}% coverage)")
    print(f"total soil carbon:      {stats['soc_in_forest_total_t'] / 1e6:,.1f} Mt C")
    print(f"mean soil carbon:       {stats['mean_soc_t_ha']:.2f} t C/ha")

    if a.out:
        with open(a.out, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(stats))
            if f.tell() == 0:
                w.writeheader()
            w.writerow(stats)
        print(f"appended to {a.out}")


if __name__ == "__main__":
    main()
