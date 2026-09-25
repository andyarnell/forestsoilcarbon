"""Core functions of the openEO soil-carbon mock -- import these for scripts
and notebooks; soc_stats.py and preprocess_forest.py are thin CLIs on top.

Stages, each mapped to the openEO process it stands for:

    read_grid / load_cube      load_collection, load_uploaded_files
    aggregate_binary           resample_cube_spatial (average): binary 0/1 in
                               any CRS -> forest fraction on the template,
                               with the binary check, nodata refusal and the
                               source-vs-aggregated area QA
    resolve_forest             ingest dispatch: fraction on the template grid
                               passes through, a binary aggregates on the fly
    pixel_area_ha              the template's companion pixel-area raster
    boundary_fraction          aggregate_spatial geometry side: fractional
                               pixel coverage via supersampling, WINDOWED so
                               Russia-sized grids stay in bounded memory
    compute_stats              the overlay and the four figures
"""

import collections
import json
import math
import os
import sys

import numpy as np
import rasterio
from rasterio import features
from rasterio.transform import Affine
from rasterio.warp import reproject, Resampling

EARTH_RADIUS_M = 6371007.181  # authalic radius, as used by ee.Image.pixelArea
SUPERSAMPLE = 10              # boundary rasterized at 1/10 cell size
QA_TOLERANCE_PC = 0.5
MAX_WINDOW_CELLS = 2e8        # memory cap for supersampled boundary blocks

Grid = collections.namedtuple("Grid", "transform crs shape")


# ---------------------------------------------------------------- loading --

def read_grid(path):
    with rasterio.open(path) as src:
        return Grid(src.transform, src.crs, (src.height, src.width))


def load_cube(path):
    """One raster band as float64 with nodata -> NaN, plus its grid."""
    with rasterio.open(path) as src:
        arr = src.read(1).astype("float64")
        if src.nodata is not None:
            arr[arr == src.nodata] = np.nan
        arr[arr == -9999] = np.nan  # the export scripts' explicit sentinel
        return arr, Grid(src.transform, src.crs, arr.shape)


def same_grid(a, b, tol=1e-9):
    return (a.shape == b.shape and
            all(abs(x - y) <= tol for x, y in zip(a.transform[:6], b.transform[:6])))


# ------------------------------------------------------------- pixel area --

def pixel_area_ha(transform, shape):
    """Per-pixel hectares. Geographic grids get the per-row cos-lat band area
    (the concept note's pixel-area raster); projected grids are constant."""
    rows, cols = shape
    a, b, _, d, e, _ = transform.a, transform.b, transform.c, transform.d, transform.e, transform.f
    if abs(b) < 1e-12 and abs(d) < 1e-12 and abs(a) < 1 and abs(e) < 1:
        lat_top = np.array([transform * (0, r) for r in range(rows)])[:, 1]
        lat_bot = lat_top + e
        band_m2 = (EARTH_RADIUS_M ** 2) * math.radians(abs(a)) * np.abs(
            np.sin(np.radians(lat_top)) - np.sin(np.radians(lat_bot)))
        return np.repeat((band_m2 / 1e4)[:, None], cols, axis=1)
    return np.full(shape, abs(a * e - b * d) / 1e4)


# --------------------------------------------------------------- boundary --

def load_geometries(geojson_path):
    with open(geojson_path, encoding="utf-8") as f:
        gj = json.load(f)
    feats = gj.get("features", [gj])
    return [f["geometry"] if "geometry" in f else f for f in feats]


def boundary_fraction(geojson_path, grid, supersample=SUPERSAMPLE):
    """Fraction of each template cell inside the country (exactextract-style
    coverage). Windowed over row blocks so the supersampled raster never
    exceeds MAX_WINDOW_CELLS -- Bhutan and Russia take the same code path."""
    geoms = [(g, 1) for g in load_geometries(geojson_path)]
    rows, cols = grid.shape
    t = grid.transform
    rows_per_block = max(1, int(MAX_WINDOW_CELLS // (cols * supersample ** 2)))

    out = np.zeros((rows, cols), dtype="float64")
    for r0 in range(0, rows, rows_per_block):
        n = min(rows_per_block, rows - r0)
        x0, y0 = t * (0, r0)
        fine = Affine(t.a / supersample, t.b, x0, t.d, t.e / supersample, y0)
        block = features.rasterize(
            geoms, out_shape=(n * supersample, cols * supersample),
            transform=fine, fill=0, dtype="uint8")
        out[r0:r0 + n] = block.reshape(n, supersample, cols, supersample).mean(axis=(1, 3))
    return out


# ---------------------------------------------------------------- ingest ---

def check_binary(src, max_blocks=200):
    """Refuse anything that is not strictly 0/1 (sampled, cheap): averaging a
    percentage or classed layer here would be threshold-of-mean."""
    for i, (_, window) in enumerate(src.block_windows(1)):
        vals = np.unique(src.read(1, window=window))
        bad = [v for v in vals if v not in (0, 1)]
        if bad:
            sys.exit(f"Input is not binary 0/1 (found {bad[:5]}). Threshold at "
                     "native resolution BEFORE ingestion.")
        if i > max_blocks:
            break


def source_forest_area_ha(src):
    """Forest area measured on the source's own grid, windowed."""
    t = src.transform
    if src.crs and src.crs.is_projected:
        cell_ha = abs(t.a * t.e - t.b * t.d) / 1e4
        return cell_ha * sum(int((src.read(1, window=w) == 1).sum())
                             for _, w in src.block_windows(1))
    row_ones = np.zeros(src.height, dtype="int64")
    for _, w in src.block_windows(1):
        block = src.read(1, window=w)
        row_ones[int(w.row_off):int(w.row_off) + block.shape[0]] += (block == 1).sum(axis=1)
    lat_top = np.array([t * (0, r) for r in range(src.height)])[:, 1]
    band_m2 = (EARTH_RADIUS_M ** 2) * math.radians(abs(t.a)) * np.abs(
        np.sin(np.radians(lat_top)) - np.sin(np.radians(lat_top + t.e)))
    return float((row_ones * band_m2 / 1e4).sum())


def aggregate_binary(binary_path, template):
    """Binary 0/1 (any CRS) -> fraction on the template grid, streamed, with
    the area QA. Returns (fraction float32, qa dict). Exits on rule breaches."""
    with rasterio.open(binary_path) as src:
        if src.nodata is not None:
            sys.exit(f"Input carries a nodata tag ({src.nodata}). Decide the "
                     "nodata policy at export (e.g. unmask(0)) -- not guessed here.")
        check_binary(src)
        src_area = source_forest_area_ha(src)
        fraction = np.zeros(template.shape, dtype="float32")
        reproject(source=rasterio.band(src, 1), destination=fraction,
                  dst_transform=template.transform, dst_crs=template.crs,
                  resampling=Resampling.average)
        src_crs = str(src.crs)

    agg_area = float((fraction * pixel_area_ha(template.transform, template.shape)).sum())
    diff_pc = 100.0 * (agg_area - src_area) / src_area if src_area else 0.0
    if abs(diff_pc) > QA_TOLERANCE_PC:
        sys.exit(f"QA FAILED: source {src_area / 1000:,.1f} kha vs aggregated "
                 f"{agg_area / 1000:,.1f} kha ({diff_pc:+.3f}%, tolerance "
                 f"{QA_TOLERANCE_PC}%). Check CRS, extent, nodata policy.")
    qa = {"input": os.path.basename(binary_path), "input_crs": src_crs,
          "qa_source_area_ha": src_area, "qa_aggregated_area_ha": agg_area,
          "qa_diff_pc": diff_pc}
    return fraction, qa


def write_fraction(out_path, fraction, template, qa):
    with rasterio.open(out_path, "w", driver="GTiff",
                       height=template.shape[0], width=template.shape[1],
                       count=1, dtype="float32", crs=template.crs,
                       transform=template.transform, tiled=True,
                       compress="deflate") as dst:
        dst.write(fraction, 1)
    sidecar = dict(qa, method="reproject + average (resample_cube_spatial)",
                   nodata_policy="zero-at-export")
    with open(out_path + ".json", "w", encoding="utf-8") as f:
        json.dump(sidecar, f, indent=2)


def resolve_forest(path, template):
    """Ingest dispatch: a fraction already on the template grid passes
    through; anything else must be a binary and aggregates on the fly.
    Returns (fraction array, note string, qa dict or None)."""
    g = read_grid(path)
    if same_grid(g, template):
        arr, _ = load_cube(path)
        top = np.nanmax(arr) if np.isfinite(arr).any() else 0.0
        if top > 1.0 + 1e-6:
            sys.exit(f"Forest input is on the template grid but max value is "
                     f"{top:g} -- neither a 0-1 fraction nor a 0/1 binary.")
        return arr, "fraction on the template grid, used as-is", None
    fraction, qa = aggregate_binary(path, template)
    return fraction.astype("float64"), \
        (f"binary aggregated on the fly ({qa['input_crs']} -> template, "
         f"QA {qa['qa_diff_pc']:+.3f}%)"), qa


# ------------------------------------------------------------ statistics ---

def compute_stats(soc, forest_frac, bfrac, area_ha):
    """The overlay and the four figures -- the app's computeCountryStats."""
    forest_ha = np.nan_to_num(forest_frac) * area_ha * bfrac
    has_soc = ~np.isnan(soc)
    forest_with_soc_ha = np.where(has_soc, forest_ha, 0.0)
    weighted = np.where(has_soc, np.nan_to_num(soc) * forest_with_soc_ha, 0.0)

    area_all = float(forest_ha.sum())
    area_with = float(forest_with_soc_ha.sum())
    total_t = float(weighted.sum())
    return {
        "forest_area_ha": area_all,
        "forest_area_with_soc_ha": area_with,
        "soc_in_forest_total_t": total_t,
        "mean_soc_t_ha": total_t / area_with if area_with > 0 else float("nan"),
        "soc_data_coverage_pc": 100.0 * area_with / area_all if area_all > 0 else float("nan"),
    }


def country_stats(soc_path, forest_path, boundary_path):
    """Whole chain, any forest input type. Returns (stats, note, qa)."""
    soc, grid = load_cube(soc_path)
    forest, note, qa = resolve_forest(forest_path, grid)
    stats = compute_stats(soc, forest,
                          boundary_fraction(boundary_path, grid),
                          pixel_area_ha(grid.transform, grid.shape))
    return stats, note, qa
