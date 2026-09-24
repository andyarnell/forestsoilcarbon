"""Ingest step of the openEO mock: binary forest -> fraction on the template.

The concept note's harmonization, runnable: a high-resolution binary 0/1
forest raster (any CRS -- national projections welcome) is reprojected and
aggregated in ONE pass onto the carbon template grid with area-weighted
averaging (GDAL 'average' == openEO resample_cube_spatial method 'average').
The output plugs straight into soc_stats.py as --forest.

Rules made executable, per the note:
  * binary in, fraction out -- a non-binary input is refused, because
    averaging a 0-100 treecover layer here would be threshold-of-mean;
  * the nodata decision precedes aggregation: this script expects the
    "nodata = no forest" policy already applied at export (unmask(0)), and
    refuses inputs that still carry a nodata tag rather than guessing;
  * QA: forest area measured on the SOURCE grid must match the aggregated
    fraction x template pixel area, or the output is not written.

Usage:
    py preprocess_forest.py --binary jrc10m_btn.tif --template soc_btn.tif \
                            --out jrc10m_frac_btn.tif
    py preprocess_forest.py --selftest
"""

import argparse
import json
import math
import os
import sys

import numpy as np

from soc_stats import pixel_area_ha, EARTH_RADIUS_M

QA_TOLERANCE_PC = 0.5


def source_forest_area_ha(src):
    """Forest area of the binary source, measured on its own grid --
    windowed, so a 10 m country never sits in RAM at once."""
    t = src.transform
    if src.crs and src.crs.is_projected:
        cell_ha = abs(t.a * t.e - t.b * t.d) / 1e4
        ones = 0
        for _, window in src.block_windows(1):
            ones += int((src.read(1, window=window) == 1).sum())
        return ones * cell_ha
    # geographic: per-row area, accumulate row counts window by window
    row_ones = np.zeros(src.height, dtype="int64")
    for _, window in src.block_windows(1):
        block = src.read(1, window=window)
        r0 = int(window.row_off)
        row_ones[r0:r0 + block.shape[0]] += (block == 1).sum(axis=1)
    lat_top = np.array([t * (0, r) for r in range(src.height)])[:, 1]
    lat_bot = lat_top + t.e
    band_m2 = (EARTH_RADIUS_M ** 2) * math.radians(abs(t.a)) * np.abs(
        np.sin(np.radians(lat_top)) - np.sin(np.radians(lat_bot)))
    return float((row_ones * band_m2 / 1e4).sum())


def check_binary(src):
    """Refuse anything that is not strictly 0/1 (sampled, cheap)."""
    for i, (_, window) in enumerate(src.block_windows(1)):
        vals = np.unique(src.read(1, window=window))
        bad = [v for v in vals if v not in (0, 1)]
        if bad:
            sys.exit(f"Input is not binary 0/1 (found {bad[:5]}). A treecover "
                     "percentage or classed map must be thresholded at native "
                     "resolution BEFORE ingestion -- averaging it here would "
                     "be threshold-of-mean, the error this rule exists to stop.")
        if i > 200:  # sampled check is enough
            break


def aggregate(binary_path, template_path, out_path):
    import rasterio
    from rasterio.warp import reproject, Resampling

    with rasterio.open(template_path) as tpl:
        dst_transform, dst_crs = tpl.transform, tpl.crs
        dst_shape = (tpl.height, tpl.width)

    with rasterio.open(binary_path) as src:
        if src.nodata is not None:
            sys.exit(f"Input carries a nodata tag ({src.nodata}). Decide the "
                     "nodata policy at export (e.g. unmask(0) for 'nodata "
                     "means no forest') -- this script will not guess.")
        check_binary(src)
        src_area = source_forest_area_ha(src)

        fraction = np.zeros(dst_shape, dtype="float32")
        # rasterio.band streams through GDAL's warper: reproject + average
        # in one pass, constant memory. This IS resample_cube_spatial.
        reproject(source=rasterio.band(src, 1), destination=fraction,
                  dst_transform=dst_transform, dst_crs=dst_crs,
                  resampling=Resampling.average)
        src_meta = {"path": os.path.basename(binary_path), "crs": str(src.crs),
                    "pixel": [src.transform.a, src.transform.e]}

    area = pixel_area_ha(dst_transform, dst_shape)
    agg_area = float((fraction * area).sum())
    diff_pc = 100.0 * (agg_area - src_area) / src_area if src_area else 0.0

    print(f"forest area, source grid:     {src_area / 1000:,.1f} kha")
    print(f"forest area, aggregated:      {agg_area / 1000:,.1f} kha "
          f"({diff_pc:+.3f}%)")
    if abs(diff_pc) > QA_TOLERANCE_PC:
        sys.exit(f"QA FAILED: areas differ by {diff_pc:.3f}% "
                 f"(tolerance {QA_TOLERANCE_PC}%). Not writing output -- "
                 "check CRS, extent and the nodata policy of the export.")

    import rasterio as rio
    with rio.open(out_path, "w", driver="GTiff", height=dst_shape[0],
                  width=dst_shape[1], count=1, dtype="float32",
                  crs=dst_crs, transform=dst_transform,
                  tiled=True, compress="deflate") as dst:
        dst.write(fraction, 1)

    sidecar = {"input": src_meta, "template": os.path.basename(template_path),
               "method": "reproject + average (resample_cube_spatial)",
               "nodata_policy": "zero-at-export",
               "qa_source_area_ha": src_area, "qa_aggregated_area_ha": agg_area,
               "qa_diff_pc": diff_pc}
    with open(out_path + ".json", "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2)
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
        # alternate columns of forest: every cell is exactly half forest
        arr = np.zeros((200, 200), "uint8")
        arr[:, ::2] = 1
        with rasterio.open(fine, "w", driver="GTiff", height=200, width=200,
                           count=1, dtype="uint8", crs="EPSG:4326",
                           transform=fine_t) as f:
            f.write(arr, 1)

        aggregate(fine, tpl, out)
        with rasterio.open(out) as f:
            frac = f.read(1)
        assert np.allclose(frac, 0.5, atol=1e-6), frac
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
    aggregate(a.binary, a.template, a.out)


if __name__ == "__main__":
    main()
