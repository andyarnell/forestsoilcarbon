// Export the Bhutan inputs for tools/openeo_mock/soc_stats.py.
// Paste into the GEE Code Editor, press Run, then start the three tasks.
// Outputs land in Drive folder "openeo_mock" (readable locally via Drive
// for Desktop). Both rasters are exported on GSOCmap's OWN grid
// (crsTransform below), so the mock never resamples anything -- the same
// rule the app's native scale and the openEO template follow.

var soc = ee.Image('projects/ee-andyarnellgee/assets/crosscutting/GSOCmap1_5_0');
var forest = ee.Image('projects/ee-andyarnellgee/assets/misc/team_fra_support/jrc_gfc2020_prop_in_1km_aggr')
                 .select('prop_cover_2020');
var btn = ee.FeatureCollection('projects/sat-io/open-datasets/FAO/GAUL/GAUL_2024_L0')
              .filter(ee.Filter.eq('iso3_code', 'BTN'));

var region = btn.geometry().bounds().buffer(10000);
var projInfo = soc.projection().getInfo();  // GSOC grid: EPSG:4326, 30 arc-sec

// Masked pixels become an explicit nodata sentinel, so the mock's nodata
// handling is deterministic rather than whatever the exporter fills in.
var NODATA = -9999;

Export.image.toDrive({
  image: soc.unmask(NODATA),
  description: 'mock_soc_gsoc_btn',
  folder: 'openeo_mock',
  region: region,
  crs: projInfo.crs,
  crsTransform: projInfo.transform,
  fileFormat: 'GeoTIFF',
  formatOptions: {cloudOptimized: true}
});

Export.image.toDrive({
  image: forest.unmask(0),  // no data = no mapped forest, counts as zero area
  description: 'mock_forest_jrc_btn',
  folder: 'openeo_mock',
  region: region,
  crs: projInfo.crs,
  crsTransform: projInfo.transform,
  fileFormat: 'GeoTIFF',
  formatOptions: {cloudOptimized: true}
});

Export.table.toDrive({
  collection: btn,
  description: 'mock_boundary_btn',
  folder: 'openeo_mock',
  fileFormat: 'GeoJSON'
});

print('Three tasks queued: run them from the Tasks tab.');
print('Then: py tools/openeo_mock/soc_stats.py --soc ... --forest ... --boundary ...');
