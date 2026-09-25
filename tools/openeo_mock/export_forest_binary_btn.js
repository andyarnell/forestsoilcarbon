// Export the RAW 10 m JRC forest binary for Bhutan, on JRC's own grid --
// the high-resolution input for tools/openeo_mock/preprocess_forest.py,
// which then does the aggregation to the carbon template in Python.
// The point is that GEE does NO resampling here: threshold/decision was
// made by JRC at 10 m, aggregation is the ingest pipeline's job.
//
// Comparison target once processed: the app's Bhutan JRC run and the mock
// (mean 83.3 t C/ha, forest ~2,889-2,894 kha) -- same source, aggregated
// by GEE (2024 assets) vs by Python (this chain).

var jrc = ee.ImageCollection('JRC/GFC2020/V2');
var projInfo = jrc.first().projection().getInfo();  // ~10 m, EPSG:4326

// Band 'Map': 1 = forest, masked elsewhere. unmask(0) = the "nodata means
// no forest" policy, decided HERE at export, not silently in the resampler.
var binary = jrc.mosaic().select('Map').unmask(0).uint8();

var COUNTRY_ISO3 = 'BTN';  // any GAUL ISO3

var btn = ee.FeatureCollection('projects/sat-io/open-datasets/FAO/GAUL/GAUL_2024_L0')
              .filter(ee.Filter.eq('iso3_code', COUNTRY_ISO3));
var region = btn.geometry().bounds().buffer(10000);

Export.image.toDrive({
  image: binary,
  description: 'mock_forest_jrc10m_binary_' + COUNTRY_ISO3,
  folder: 'openeo_mock',
  region: region,
  crs: projInfo.crs,
  crsTransform: projInfo.transform,
  maxPixels: 1e10,
  // one big tile instead of shards, so the Python side reads a single file
  fileDimensions: 46080,
  skipEmptyTiles: true,
  fileFormat: 'GeoTIFF',
  formatOptions: {cloudOptimized: true}
});

print('Task queued: mock_forest_jrc10m_binary_btn (~10 m uint8, single file).');
print('Then: py tools/openeo_mock/preprocess_forest.py --binary <file> ' +
      '--template mock_soc_gsoc_btn.tif --out jrc10m_frac_btn.tif');
