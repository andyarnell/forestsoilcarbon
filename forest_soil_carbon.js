// Forest Soil Carbon App
var APP_VERSION = "0.3.0";

// Changelog: see CHANGELOG.md

// AIM: area-weighted mean soil organic carbon (SOC) in forest, per country,
//      for FAO FRA reporting and gap-filling.
//
// Method: forest area per pixel x SOC stock per hectare, summed per country,
//         divided by summed forest area. See docs/scope.md.
//
// GEE path: users/andyarnellgee/apps:forest_soil_carbon
// Source:   https://github.com/andyarnell/forestsoilcarbon

print('Forest Soil Carbon v' + APP_VERSION);

// Set to true when publishing as a GEE App. Export.table.toDrive silently does
// nothing in a published app, so the Drive-export button is hidden and only the
// in-app CSV download link is offered.
var IS_PUBLISHED_APP = false;

// =============================================================================
// MODULES
// Shared with the Primary Forest Finder toolset. Do not copy these in here --
// they live in github.com/andyarnell/primaryforestfinder/modules
// =============================================================================

var gaulLut = require("users/andyarnellgee/apps:modules/gaulLut.js");
var fraStats = require("users/andyarnellgee/apps:modules/fraStats.js");

// =============================================================================
// CONSTANTS
// =============================================================================

var GAUL_L0_ASSET = 'projects/sat-io/open-datasets/FAO/GAUL/GAUL_2024_L0';

var GLOBAL_OPTION = 'Global (all countries)';
var CUSTOM_KEY = 'custom';

// Analysis scale in metres. 1000 m is the native resolution of GSOCmap, the
// coarsest layer in the default set. Always passed explicitly to reducers.
var DEFAULT_SCALE = 1000;
var SCALE_OPTIONS = ['1000', '500', '250', '100'];

// Year used for the FRA comparison line. fraStats covers 1990/2000/2010/2015/2020.
var FRA_YEAR = 2020;

// GAUL includes disputed and placeholder territories with non-standard ISO3
// codes beginning with a lowercase 'x'. Excluded from country tables.
var DISPUTED_ISO3_PREFIX = 'x';

// Below this, the soil carbon layer has enough gaps over forest that the mean
// is not representative and the results panel says so.
var LOW_COVERAGE_WARN_PC = 90;

// =============================================================================
// QUANTITIES
//
// What the pixel values physically are. This is the primitive that decides what
// the app is allowed to report:
//
//   'stock'          mass per area (t C/ha). Adds up over area, so both the
//                    MEAN and the TOTAL are valid. This is what FRA asks for.
//   'concentration'  mass fraction (g/kg). The area-weighted MEAN is a valid
//                    quantity; the TOTAL is not -- summing a concentration over
//                    area gives g/kg*ha, which is not a thing. No total shown.
//   'unknown'        the user has not said. Nothing is computed.
//
// Units live here and are never stored per dataset, so a config cannot claim to
// be a stock measured in g/kg. `col` is the suffix on the results column and
// the CSV header, so a number cannot leave the app without its unit attached.
// =============================================================================

var QUANTITY = {
  stock:         {unit: 't C/ha', col: 't_ha',    summable: true},
  concentration: {unit: 'g/kg',   col: 'g_kg',    summable: false},
  unknown:       {unit: '?',      col: 'unknown', summable: false}
};

// =============================================================================
// SOIL DEPTH
//
// The depth dropdown drives which soil carbon layers are offered: only layers
// whose `depth_cm` matches the selected depth appear. Adding a deeper product
// later means adding a dataset entry with that depth_cm -- the option becomes
// selectable on its own.
//
// 0-30 cm is the working assumption for FRA. Not yet confirmed -- see
// docs/scope.md.
// =============================================================================

var DEPTH_OPTIONS = [
  {value: '0-30', label: '0-30 cm (FRA default)'},
  {value: '0-100', label: '0-100 cm'},
  {value: 'other', label: 'Other / not stated'}
];

// =============================================================================
// SOIL CARBON DATASETS
// Add a layer by adding one object here -- there is no dataset-specific logic
// anywhere else in this file.
//
//   quantity      key into QUANTITY above. Decides what gets reported.
//   scale_factor  multiplier applied to raw pixel values to reach that unit
//   depth_cm      the depth the values represent; must match a DEPTH_OPTIONS
//                 value to be offered
//   band          band name, or null for a single-band image
//
// Only layers that are already a single band at a stated depth are offered.
// Products that split the profile into intervals or report at point depths
// (SoilGrids soc_mean, OpenLandMap) are deliberately not included -- they are
// concentrations, which cannot be reported as the FRA figure, and both are
// superseded by SoilGrids ocs_mean. See docs/soil_carbon_datasets_review.md.
// =============================================================================

var SOC_DATASETS = [
  {
    key: 'gsoc_1_5',
    label: 'GSOCmap 1.5 (FAO) - 0-30 cm stock',
    asset: 'projects/ee-andyarnellgee/assets/crosscutting/GSOCmap1_5_0',
    band: null,                  // single-band image
    quantity: 'stock',
    scale_factor: 1,
    depth_cm: '0-30',
    native_resolution_m: 1000,
    citation: 'FAO & ITPS (2022) Global Soil Organic Carbon Map (GSOCmap) v1.5. FAO, Rome.'
  },
  {
    key: 'soilgrids_ocs',
    label: 'SoilGrids 2.0 (ISRIC) - 0-30 cm stock',
    asset: 'projects/soilgrids-isric/ocs_mean',
    band: 'ocs_0-30cm_mean',
    // ISRIC stores ocs ALREADY in t/ha. Their published "conversion factor 10"
    // converts t/ha to kg/m2, the other direction. Do not apply 0.1 here -- it
    // would report every figure 10x too low.
    quantity: 'stock',
    scale_factor: 1,
    depth_cm: '0-30',
    native_resolution_m: 250,
    citation: 'Poggio, L. et al. (2021) SoilGrids 2.0. SOIL 7, 217-240.'
  }
];

// =============================================================================
// FOREST DATASETS
//
//   type 'prop_aggregated'  1 km images pre-aggregated from a finer source.
//                           `prop_band` is the fraction of the pixel that is
//                           forest (0-1); `area_band` is the pixel area.
//                           NB `pixel_area_km` is MISNAMED -- the values are
//                           HECTARES (error when the files were made). Do not
//                           "fix" this by dividing.
//   type 'binary'           a mask; `threshold` is the value above which a
//                           pixel counts as forest. Area comes from
//                           ee.Image.pixelArea() at the analysis scale.
//   type 'fraction'         values already 0-1 fractional cover.
// =============================================================================

var FOREST_DATASETS = [
  {
    key: 'jrc_gfc_2020',
    label: 'JRC Global Forest Cover 2020',
    asset: 'projects/ee-andyarnellgee/assets/misc/team_fra_support/jrc_gfc2020_prop_in_1km_aggr',
    type: 'prop_aggregated',
    prop_band: 'prop_cover_2020',
    area_band: 'pixel_area_km',  // hectares despite the name
    year: 2020,
    citation: 'Bourgoin, C. et al. (2024) Global map of forest cover 2020 v2. European Commission JRC.'
  },
  {
    key: 'hansen_10pc_2020',
    label: 'Hansen GFC, >10% tree cover, 2020',
    asset: 'projects/ee-andyarnellgee/assets/misc/team_fra_support/hansen_10pc_cover_2020_pixel_prop_in_1km_aggr',
    type: 'prop_aggregated',
    prop_band: 'prop_cover_2020',
    area_band: 'pixel_area_km',
    year: 2020,
    citation: 'Hansen, M.C. et al. (2013) High-resolution global maps of 21st-century forest cover change. Science 342, 850-853.'
  },
  {
    key: 'hansen_20pc_2020',
    label: 'Hansen GFC, >20% tree cover, 2020',
    asset: 'projects/ee-andyarnellgee/assets/misc/team_fra_support/hansen_20pc_cover_2020_pixel_prop_in_1km_aggr',
    type: 'prop_aggregated',
    prop_band: 'prop_cover_2020',
    area_band: 'pixel_area_km',
    year: 2020,
    citation: 'Hansen, M.C. et al. (2013) Science 342, 850-853.'
  },
  {
    key: 'globland_2020',
    label: 'GlobeLand30 forest 2020',
    asset: 'projects/ee-andyarnellgee/assets/misc/team_fra_support/globland_forest__2020_pixel_prop_in_1km_aggr',
    type: 'prop_aggregated',
    prop_band: 'prop_cover_2020',
    area_band: 'pixel_area_km',
    year: 2020,
    citation: 'Chen, J. et al. (2015) Global land cover mapping at 30 m resolution. ISPRS J. Photogramm. 103, 7-27.'
  }
];

// =============================================================================
// VISUALISATION PARAMETERS
// =============================================================================

var SOC_STOCK_VIS = {min: 0, max: 200, palette: ['#ffffcc', '#fed976', '#fd8d3c', '#7f2704']};
var SOC_CONC_VIS = {min: 0, max: 60, palette: ['#ffffcc', '#fed976', '#fd8d3c', '#7f2704']};
var FOREST_VIS = {min: 0, max: 1, palette: ['white', '#1b7837']};
var SOC_IN_FOREST_VIS = {min: 0, max: 100, palette: ['#f7f4f9', '#c994c7', '#980043']};

var HINT_STYLE = {fontSize: '10px', color: '#666', margin: '0 0 4px 4px'};
var BODY_STYLE = {fontSize: '11px', margin: '2px 0 2px 4px'};
var HEADING_STYLE = {fontSize: '13px', fontWeight: 'bold', margin: '4px 0 2px 4px'};
var LINK_STYLE = {fontSize: '11px', color: 'blue', textDecoration: 'underline', margin: '4px 0 2px 4px'};
var WARN_STYLE = {fontSize: '11px', color: '#b00020', margin: '2px 0 2px 4px'};

// =============================================================================
// STATE
// =============================================================================

var appState = {
  ui: {
    forestCollapsed: false,
    socCollapsed: false,
    optionsCollapsed: true
  }
};

// Set by runAnalysis so the pixel inspector can sample exactly the images that
// produced the country figures, rather than rebuilding them from the widgets
// (which the user may have changed since pressing Run).
var lastRun = null;

// The click marker, kept so each click replaces the previous one instead of
// stacking layers.
var markerLayer = null;

// Built once from GAUL_LUT so ISO3 results can be joined to the name-keyed
// fraStats tables. gaulLut has no iso3ToName export.
var iso3ToName = {};
(function () {
  var codes = Object.keys(gaulLut.GAUL_LUT);
  codes.forEach(function (code) {
    var entry = gaulLut.GAUL_LUT[code];
    iso3ToName[entry.iso3] = entry.name;
  });
})();

// =============================================================================
// DATA PREPARATION
// =============================================================================

/**
 * Look up a dataset config by its key.
 * @param {Array<Object>} list  SOC_DATASETS or FOREST_DATASETS
 * @param {string} key
 * @return {Object|null}
 */
function getDatasetByKey(list, key) {
  var found = null;
  list.forEach(function (d) {
    if (d.key === key) { found = d; }
  });
  return found;
}

/**
 * Soil carbon layers available at a given depth.
 * @param {string} depth  a DEPTH_OPTIONS value
 * @return {Array<Object>}
 */
function socDatasetsForDepth(depth) {
  return SOC_DATASETS.filter(function (d) { return d.depth_cm === depth; });
}

/**
 * Build a single-band soil carbon image in the unit its quantity implies.
 * @param {Object} cfg  a SOC_DATASETS-shaped config
 * @return {ee.Image} band 'soc_value' -- deliberately unit-agnostic, because
 *     the band may hold a stock or a concentration depending on cfg.quantity
 */
function buildSocImage(cfg) {
  var img = ee.Image(cfg.asset);
  img = cfg.band ? img.select([cfg.band]) : img.select([0]);
  return img.multiply(cfg.scale_factor).rename('soc_value');
}

/**
 * Build forest area per pixel, in hectares.
 * @param {Object} cfg  a FOREST_DATASETS-shaped config
 * @return {ee.Image} band 'forest_area_ha'
 */
function buildForestArea(cfg) {
  if (cfg.type === 'prop_aggregated') {
    var src = ee.Image(cfg.asset);
    // area_band is already hectares despite being called pixel_area_km
    return src.select([cfg.area_band])
              .multiply(src.select([cfg.prop_band]))
              .rename('forest_area_ha');
  }

  var pixelHa = ee.Image.pixelArea().divide(10000);
  return buildForestFraction(cfg).multiply(pixelHa).rename('forest_area_ha');
}

/**
 * Forest cover fraction, 0-1.
 * @param {Object} cfg  a FOREST_DATASETS-shaped config
 * @return {ee.Image}
 */
function buildForestFraction(cfg) {
  if (cfg.type === 'prop_aggregated') {
    return ee.Image(cfg.asset).select([cfg.prop_band]);
  }
  var img = ee.Image(cfg.asset);
  img = cfg.band ? img.select([cfg.band]) : img.select([0]);
  if (cfg.type === 'binary') {
    var threshold = (cfg.threshold === undefined || cfg.threshold === null) ? 0 : cfg.threshold;
    return img.gt(threshold);
  }
  return img.clamp(0, 1);
}

/**
 * Country polygons to summarise over.
 * @param {string} countryName  a GAUL name, or GLOBAL_OPTION
 * @return {ee.FeatureCollection} GAUL 2024 L0 features
 */
function getRegions(countryName) {
  var all = ee.FeatureCollection(GAUL_L0_ASSET);
  if (countryName === GLOBAL_OPTION) {
    // Drop disputed / placeholder territories from FRA country tables
    return all.filter(ee.Filter.stringStartsWith('iso3_code', DISPUTED_ISO3_PREFIX).not());
  }
  return all.filter(ee.Filter.eq('gaul0_code', gaulLut.nameToCode(countryName)));
}

// =============================================================================
// STATISTICS
// GAUL Level 0 is one feature per country, so unlike the original UN BNDA
// script no reduceColumns grouping step is needed to collapse multi-polygon
// countries -- reduceRegions already returns one row per country.
// =============================================================================

/**
 * Per-country forest area, carbon in forest, and the area-weighted mean.
 *
 * Forest pixels with no soil data are excluded from BOTH the numerator and the
 * denominator. Reducing forest area as its own band would leave its mask
 * independent of the soil layer's, counting those pixels in the denominator
 * only and biasing the mean low wherever the soil layer has gaps -- which
 * GSOCmap does. `forest_area_ha` is still reported separately so the coverage
 * can be shown.
 *
 * @param {ee.Image} socImage        band 'soc_value'
 * @param {ee.Image} forestAreaImage band 'forest_area_ha'
 * @param {ee.FeatureCollection} regions
 * @param {number} scale  metres
 * @param {Object} socCfg  used for the quantity-dependent column name
 * @return {ee.FeatureCollection} geometry-free features, one per country
 */
function computeCountryStats(socImage, forestAreaImage, regions, scale, socCfg) {
  var meanColumn = meanColumnName(socCfg);

  var forestWithSoc = forestAreaImage.updateMask(socImage.mask())
                                     .rename('forest_area_with_soc_ha');
  var weighted = socImage.multiply(forestWithSoc).rename('soc_weighted_sum');

  var summed = weighted
    .addBands(forestWithSoc)
    .addBands(forestAreaImage)
    .reduceRegions({
      collection: regions,
      reducer: ee.Reducer.sum(),
      scale: scale,
      tileScale: 4
    });

  return summed.map(function (f) {
    var areaAll = numberOrZero(f.get('forest_area_ha'));
    var areaWithSoc = numberOrZero(f.get('forest_area_with_soc_ha'));
    var weightedSum = numberOrZero(f.get('soc_weighted_sum'));

    var props = {
      iso3: f.get('iso3_code'),
      country: f.get('gaul0_name'),
      forest_area_ha: areaAll,
      forest_area_with_soc_ha: areaWithSoc,
      soc_data_coverage_pc: ee.Algorithms.If(
        areaAll.gt(0), areaWithSoc.divide(areaAll).multiply(100), null),
      soc_in_forest_total: weightedSum
    };
    props[meanColumn] = ee.Algorithms.If(
      areaWithSoc.gt(0), weightedSum.divide(areaWithSoc), null);

    return ee.Feature(null, props);
  });
}

/**
 * @param {*} value  a possibly-null feature property
 * @return {ee.Number}
 */
function numberOrZero(value) {
  return ee.Number(ee.Algorithms.If(value, value, 0));
}

/**
 * The results/CSV column holding the mean, with its unit baked into the name so
 * the number cannot travel without it.
 * @param {Object} socCfg
 * @return {string} e.g. 'mean_soc_t_ha'
 */
function meanColumnName(socCfg) {
  return 'mean_soc_' + QUANTITY[socCfg.quantity].col;
}

/**
 * Collapse a stats collection to totals across all its rows.
 * @param {ee.FeatureCollection} statsFc
 * @param {Object} socCfg
 * @return {ee.Dictionary}
 */
function computeTotals(statsFc, socCfg) {
  var sums = ee.Dictionary(statsFc.reduceColumns({
    reducer: ee.Reducer.sum().repeat(3),
    selectors: ['soc_in_forest_total', 'forest_area_with_soc_ha', 'forest_area_ha']
  }));
  var values = ee.List(sums.get('sum'));
  var weightedSum = ee.Number(values.get(0));
  var areaWithSoc = ee.Number(values.get(1));
  var areaAll = ee.Number(values.get(2));

  return ee.Dictionary({
    soc_in_forest_total: weightedSum,
    forest_area_ha: areaAll,
    forest_area_with_soc_ha: areaWithSoc,
    coverage_pc: ee.Algorithms.If(
      areaAll.gt(0), areaWithSoc.divide(areaAll).multiply(100), null),
    mean: ee.Algorithms.If(
      areaWithSoc.gt(0), weightedSum.divide(areaWithSoc), null)
  });
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

function withCommas(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * @param {number} value
 * @param {number} decimals
 * @return {string} thousands-separated, or 'n/a' for null
 */
function formatNumber(value, decimals) {
  if (value === null || value === undefined) { return 'n/a'; }
  var fixed = Number(value).toFixed(decimals);
  var parts = fixed.split('.');
  return parts.length > 1 ? withCommas(parts[0]) + '.' + parts[1] : withCommas(parts[0]);
}

// =============================================================================
// UI - REUSABLE PIECES
// =============================================================================

/**
 * A collapsible left-panel section in the pff_layout style.
 * @param {string} title
 * @param {Array} widgets
 * @param {string} stateKey  key in appState.ui
 * @return {ui.Panel}
 */
function makeCollapsible(title, widgets, stateKey) {
  var content = ui.Panel({
    widgets: widgets,
    style: {shown: !appState.ui[stateKey], padding: '4px'}
  });

  var glyph = function () { return appState.ui[stateKey] ? '▶ ' : '▼ '; };

  var toggle = ui.Button({
    label: glyph() + title,
    onClick: function () {
      appState.ui[stateKey] = !appState.ui[stateKey];
      content.style().set({shown: !appState.ui[stateKey]});
      toggle.setLabel(glyph() + title);
    },
    style: {
      stretch: 'horizontal', textAlign: 'left', padding: '3px 6px',
      margin: '1px', fontSize: '12px', backgroundColor: '#f0f0f0'
    }
  });

  return ui.Panel({
    widgets: [toggle, content],
    layout: ui.Panel.Layout.flow('vertical')
  });
}

// =============================================================================
// UI - SOIL CARBON SECTION
// The dataset list is rebuilt whenever the depth changes, so only layers that
// actually represent the selected depth can be picked.
// =============================================================================

var socSelect = ui.Select({
  items: [],
  style: {stretch: 'horizontal', margin: '2px 4px'},
  onChange: function (key) {
    socCustomPanel.style().set({shown: key === CUSTOM_KEY});
    socNoteLabel.setValue(describeSocChoice(key));
  }
});

var socNoteLabel = ui.Label('', HINT_STYLE);

var socAssetBox = ui.Textbox({
  placeholder: 'projects/your-project/assets/national_soc_map',
  style: {stretch: 'horizontal', margin: '2px 4px', fontSize: '11px'}
});

var socBandBox = ui.Textbox({
  placeholder: 'band name (blank = first band)',
  style: {stretch: 'horizontal', margin: '2px 4px', fontSize: '11px'}
});

// Defaults to 'unknown' on purpose. A user who ignores this must not get a
// confident t C/ha figure computed from a layer of undeclared type.
var socQuantitySelect = ui.Select({
  items: [
    {label: '- I do not know -', value: 'unknown'},
    {label: 'Stock: tonnes of carbon per hectare (t C/ha)', value: 'stock'},
    {label: 'Concentration: grams of carbon per kg of soil (g/kg)', value: 'concentration'}
  ],
  value: 'unknown',
  style: {stretch: 'horizontal', margin: '2px 4px'}
});

var socScaleFactorBox = ui.Textbox({
  value: '1',
  style: {stretch: 'horizontal', margin: '2px 4px', fontSize: '11px'}
});

var socCustomPanel = ui.Panel({
  widgets: [
    ui.Label('Asset ID', BODY_STYLE), socAssetBox,
    ui.Label('Band', BODY_STYLE), socBandBox,
    ui.Label('What the values mean', BODY_STYLE), socQuantitySelect,
    ui.Label('Multiply raw values by', BODY_STYLE), socScaleFactorBox,
    ui.Label('Leave at 1 unless your layer is stored scaled - a x10 integer ' +
             'store is common.', HINT_STYLE),
    ui.Label('Your layer is assumed to be the depth selected in Options.', HINT_STYLE)
  ],
  style: {shown: false}
});

/**
 * Rebuild the soil carbon dropdown for the selected depth.
 * @param {string} depth  a DEPTH_OPTIONS value
 */
function refreshSocOptions(depth) {
  var matching = socDatasetsForDepth(depth);
  var items = matching.map(function (d) {
    return {label: d.label, value: d.key};
  });
  items.push({label: 'Custom - my own GEE asset', value: CUSTOM_KEY});

  socSelect.items().reset(items);
  socSelect.setValue(matching.length ? matching[0].key : CUSTOM_KEY);

  socDepthNoteLabel.setValue(matching.length
    ? matching.length + ' global layer(s) available at ' + depth + ' cm.'
    : 'No global layer available at this depth - supply your own asset below.');
}

/**
 * @param {string} key
 * @return {string} the hint shown under the soil carbon dropdown
 */
function describeSocChoice(key) {
  if (key === CUSTOM_KEY) {
    return 'Your own asset. You must say what the values mean before it will compute.';
  }
  var cfg = getDatasetByKey(SOC_DATASETS, key);
  if (!cfg) { return ''; }
  return cfg.native_resolution_m + ' m, ' + cfg.depth_cm + ' cm, ' +
         QUANTITY[cfg.quantity].unit;
}

// =============================================================================
// UI - FOREST SECTION
// =============================================================================

var forestSelect = ui.Select({
  items: FOREST_DATASETS.map(function (d) { return {label: d.label, value: d.key}; })
                        .concat([{label: 'Custom - my own GEE asset', value: CUSTOM_KEY}]),
  value: FOREST_DATASETS[0].key,
  style: {stretch: 'horizontal', margin: '2px 4px'},
  onChange: function (key) {
    forestCustomPanel.style().set({shown: key === CUSTOM_KEY});
  }
});

var forestAssetBox = ui.Textbox({
  placeholder: 'projects/your-project/assets/national_forest_map',
  style: {stretch: 'horizontal', margin: '2px 4px', fontSize: '11px'}
});

var forestBandBox = ui.Textbox({
  placeholder: 'band name (blank = first band)',
  style: {stretch: 'horizontal', margin: '2px 4px', fontSize: '11px'}
});

var forestTypeSelect = ui.Select({
  items: [
    {label: 'Binary mask (1 = forest)', value: 'binary'},
    {label: 'Fractional cover (0-1)', value: 'fraction'}
  ],
  value: 'binary',
  style: {stretch: 'horizontal', margin: '2px 4px'}
});

var forestCustomPanel = ui.Panel({
  widgets: [
    ui.Label('Asset ID', BODY_STYLE), forestAssetBox,
    ui.Label('Band', BODY_STYLE), forestBandBox,
    ui.Label('What the values mean', BODY_STYLE), forestTypeSelect,
    ui.Label('Set the analysis scale to your layer\'s resolution in Options.', HINT_STYLE)
  ],
  style: {shown: false}
});

// =============================================================================
// UI - OPTIONS
// =============================================================================

var depthSelect = ui.Select({
  items: DEPTH_OPTIONS,
  value: '0-30',
  style: {stretch: 'horizontal', margin: '2px 4px'},
  onChange: function (depth) { refreshSocOptions(depth); }
});

var socDepthNoteLabel = ui.Label('', HINT_STYLE);

var scaleSelect = ui.Select({
  items: SCALE_OPTIONS.map(function (s) { return {label: s + ' m', value: s}; }),
  value: String(DEFAULT_SCALE),
  style: {stretch: 'horizontal', margin: '2px 4px'}
});

var driveExportCheckbox = ui.Checkbox({
  label: 'Also queue a Drive export',
  value: false,
  style: {fontSize: '11px', margin: '4px'}
});

var optionsWidgets = [
  ui.Label('Soil depth', BODY_STYLE), depthSelect, socDepthNoteLabel,
  ui.Label('Only layers matching this depth are offered. Depths cannot be ' +
           'mixed - a 0-30 cm figure is not comparable with a deeper one.', HINT_STYLE),
  ui.Label('Analysis scale', BODY_STYLE), scaleSelect,
  ui.Label('Match this to the finest input. Coarser is faster.', HINT_STYLE)
];
if (!IS_PUBLISHED_APP) {
  optionsWidgets.push(driveExportCheckbox);
  optionsWidgets.push(ui.Label('Code Editor only - does nothing in a published app.', HINT_STYLE));
}

// =============================================================================
// UI - TOP BAR
// =============================================================================

var countrySelect = ui.Select({
  items: [GLOBAL_OPTION].concat(gaulLut.country_names),
  value: GLOBAL_OPTION,
  style: {width: '220px', margin: '4px 8px'},
  onChange: function (name) {
    if (name !== GLOBAL_OPTION) {
      map.centerObject(getRegions(name), 5);
    }
  }
});

var runButton = ui.Button({
  label: '▶ Run analysis',
  onClick: function () { runAnalysis(); },
  style: {margin: '4px 8px', backgroundColor: '#4CAF50', fontSize: '12px'}
});

var topBar = ui.Panel({
  widgets: [
    ui.Label('Forest Soil Carbon', {fontWeight: 'bold', fontSize: '18px', margin: '4px 8px'}),
    ui.Label('Country', {fontSize: '11px', margin: '8px 0 0 8px'}),
    countrySelect,
    runButton,
    ui.Panel({style: {stretch: 'horizontal'}}),
    ui.Label('v' + APP_VERSION, {fontSize: '10px', color: '#888', margin: '8px'})
  ],
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {
    stretch: 'horizontal',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '4px',
    border: '1px solid #ccc'
  }
});

// =============================================================================
// UI - PANELS
// =============================================================================

var leftPanel = ui.Panel({
  widgets: [
    makeCollapsible('1. Forest layer', [forestSelect, forestCustomPanel], 'forestCollapsed'),
    makeCollapsible('2. Soil carbon layer', [socSelect, socNoteLabel, socCustomPanel], 'socCollapsed'),
    makeCollapsible('3. Options', optionsWidgets, 'optionsCollapsed')
  ],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '310px', backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '2px'}
});

var resultsPanel = ui.Panel({
  widgets: [ui.Label('Choose your layers, then Run analysis.', HINT_STYLE)],
  layout: ui.Panel.Layout.flow('vertical')
});

var inspectorPanel = ui.Panel({
  widgets: [ui.Label('Run analysis, then click the map to read values here.', HINT_STYLE)],
  layout: ui.Panel.Layout.flow('vertical')
});

var rightPanel = ui.Panel({
  widgets: [
    ui.Label('Results', HEADING_STYLE), resultsPanel,
    ui.Label('Pixel values', HEADING_STYLE), inspectorPanel
  ],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '310px', backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '2px'}
});

var map = ui.Map();
map.setCenter(0, 20, 2);
map.setControlVisibility({all: true});
map.style().set('cursor', 'crosshair');
map.onClick(function (coords) { inspectPixel(coords); });

var mainContainer = ui.Panel({
  widgets: [leftPanel, map, rightPanel],
  layout: ui.Panel.Layout.flow('horizontal'),
  style: {stretch: 'both'}
});

ui.root.widgets().reset([
  ui.Panel({
    widgets: [topBar, mainContainer],
    layout: ui.Panel.Layout.flow('vertical'),
    style: {stretch: 'both'}
  })
]);

refreshSocOptions(depthSelect.getValue());
socNoteLabel.setValue(describeSocChoice(socSelect.getValue()));

// =============================================================================
// RUN
// =============================================================================

/**
 * Read the soil carbon dropdown, including the custom-asset case.
 * @return {Object|null} a SOC_DATASETS-shaped config, or null if incomplete
 */
function resolveSocConfig() {
  var key = socSelect.getValue();
  if (key !== CUSTOM_KEY) { return getDatasetByKey(SOC_DATASETS, key); }

  var asset = socAssetBox.getValue();
  if (!asset) { return null; }
  return {
    key: CUSTOM_KEY,
    label: 'My own soil carbon layer',
    asset: asset,
    band: socBandBox.getValue() || null,
    quantity: socQuantitySelect.getValue(),
    scale_factor: Number(socScaleFactorBox.getValue()) || 1,
    depth_cm: depthSelect.getValue(),
    native_resolution_m: null,
    citation: 'User-supplied asset: ' + asset
  };
}

/**
 * Read the forest dropdown, including the custom-asset case.
 * @return {Object|null} a FOREST_DATASETS-shaped config, or null if incomplete
 */
function resolveForestConfig() {
  var key = forestSelect.getValue();
  if (key !== CUSTOM_KEY) { return getDatasetByKey(FOREST_DATASETS, key); }

  var asset = forestAssetBox.getValue();
  if (!asset) { return null; }
  return {
    key: CUSTOM_KEY,
    label: 'My own forest layer',
    asset: asset,
    type: forestTypeSelect.getValue(),
    band: forestBandBox.getValue() || null,
    threshold: 0,
    year: null,
    citation: 'User-supplied asset: ' + asset
  };
}

function showMessage(text, style) {
  resultsPanel.add(ui.Label(text, style || BODY_STYLE));
}

/**
 * The header block, repeated before and after the async result arrives.
 */
function showRunHeader(countryName, socCfg, forestCfg, scale) {
  showMessage(countryName, HEADING_STYLE);
  showMessage('Forest: ' + forestCfg.label);
  showMessage('Soil carbon: ' + socCfg.label);
  showMessage(socCfg.depth_cm + ' cm ' + socCfg.quantity +
              ', analysed at ' + scale + ' m', HINT_STYLE);
}

function runAnalysis() {
  resultsPanel.clear();
  map.layers().reset();
  markerLayer = null;
  lastRun = null;
  inspectorPanel.clear();
  inspectorPanel.add(ui.Label('Click the map to read values here.', HINT_STYLE));

  var socCfg = resolveSocConfig();
  var forestCfg = resolveForestConfig();

  if (!socCfg) { showMessage('Enter a soil carbon asset ID.', WARN_STYLE); return; }
  if (!forestCfg) { showMessage('Enter a forest asset ID.', WARN_STYLE); return; }

  var countryName = countrySelect.getValue();
  var scale = Number(scaleSelect.getValue());
  var quantity = QUANTITY[socCfg.quantity];

  var socImage = buildSocImage(socCfg);
  var forestArea = buildForestArea(forestCfg);
  var forestFraction = buildForestFraction(forestCfg);

  // Hand the inspector the exact images behind the country figures, so a
  // clicked pixel and the reported mean can never disagree about their inputs.
  lastRun = {
    socImage: socImage,
    forestFraction: forestFraction,
    forestArea: forestArea,
    socCfg: socCfg,
    forestCfg: forestCfg,
    scale: scale
  };

  map.addLayer(socImage,
               socCfg.quantity === 'stock' ? SOC_STOCK_VIS : SOC_CONC_VIS,
               'Soil carbon (' + quantity.unit + ')', true, 0.8);
  map.addLayer(forestFraction.selfMask(), FOREST_VIS,
               'Forest: ' + forestCfg.label, true, 0.7);

  // The per-pixel product is only tonnes of carbon when the input is a stock.
  // For a concentration it is g/kg*ha, which is not a quantity -- do not draw
  // it and do not name it.
  if (quantity.summable) {
    map.addLayer(socImage.multiply(forestArea).selfMask(), SOC_IN_FOREST_VIS,
                 'Soil carbon in forest (t C per pixel)', false, 1);
  }

  showRunHeader(countryName, socCfg, forestCfg, scale);

  if (socCfg.quantity === 'unknown') {
    showMessage('Cannot compute.', HEADING_STYLE);
    showMessage('You have not told the app what the values in this layer mean. A stock ' +
                '(tonnes of carbon per hectare) and a concentration (grams of carbon ' +
                'per kilogram of soil) are different physical quantities, and the app ' +
                'cannot tell them apart from the pixel values.', WARN_STYLE);
    showMessage('The layer is on the map so you can inspect it. Over forest, a 0-30 cm ' +
                'stock usually reads about 30-150 t C/ha and a concentration about ' +
                '5-60 g/kg - but check the asset description rather than guessing.', HINT_STYLE);
    showMessage('Set "What the values mean" under Soil carbon layer, then Run again.');
    return;
  }

  showMessage('Computing...', HINT_STYLE);

  var regions = getRegions(countryName);
  var stats = computeCountryStats(socImage, forestArea, regions, scale, socCfg);

  computeTotals(stats, socCfg).evaluate(function (result, error) {
    resultsPanel.clear();
    showRunHeader(countryName, socCfg, forestCfg, scale);

    if (error) { showMessage('Failed: ' + error, WARN_STYLE); return; }
    if (!result || result.mean === null) {
      showMessage('No data returned. Try a coarser analysis scale.', WARN_STYLE);
      return;
    }

    showMessage('Forest area: ' + formatNumber(result.forest_area_ha / 1000, 1) + ' kha');
    showMessage('Forest area with soil carbon data: ' +
                formatNumber(result.coverage_pc, 1) + '%',
                result.coverage_pc < LOW_COVERAGE_WARN_PC ? WARN_STYLE : BODY_STYLE);

    if (quantity.summable) {
      showMessage('Total soil carbon in forest: ' +
                  formatNumber(result.soc_in_forest_total / 1e6, 1) + ' Mt C');
      showMessage('Mean soil carbon in forest: ' +
                  formatNumber(result.mean, 1) + ' t C/ha', HEADING_STYLE);
      showMessage('This is the figure FRA asks for: soil organic carbon stock, ' +
                  socCfg.depth_cm + ' cm, tonnes of carbon per hectare.', HINT_STYLE);
      addFraComparison(countryName);
    } else {
      showMessage('Mean soil carbon concentration in forest: ' +
                  formatNumber(result.mean, 1) + ' g/kg', HEADING_STYLE);
      showMessage('NOT the FRA figure. This layer is a concentration - how carbon-rich ' +
                  'the soil is. FRA asks for a stock - how much carbon is there, in ' +
                  'tonnes per hectare. A g/kg value cannot be entered in place of a ' +
                  't C/ha value.', WARN_STYLE);
      showMessage('No total is shown: adding up a concentration over an area does not ' +
                  'give a carbon stock. Converting one to the other needs bulk density ' +
                  'and coarse-fragment maps, which this app does not do.', HINT_STYLE);
    }

    addDownloadLink(stats, socCfg, forestCfg, countryName, scale);
  });

  if (!IS_PUBLISHED_APP && driveExportCheckbox.getValue()) {
    Export.table.toDrive({
      collection: stats,
      folder: 'fra_soc_gap_filling',
      description: 'soc_in_forest_' + forestCfg.key + '_' + socCfg.key,
      fileFormat: 'CSV'
    });
    showMessage('Drive export queued - see the Tasks tab.', HINT_STYLE);
  }
}

// =============================================================================
// PIXEL INSPECTOR
// The inputs are continuous (soil carbon per hectare, fractional forest cover),
// so the value at a point is worth reading directly -- it is how you tell a
// suspicious country mean from a genuine one, and how you check a national
// asset's units and scale factor before trusting a whole run.
// =============================================================================

function showInspectorMessage(text, style) {
  inspectorPanel.add(ui.Label(text, style || BODY_STYLE));
}

/**
 * Sample every layer of the last run at a clicked point and report the values.
 * @param {Object} coords  {lon, lat} from ui.Map.onClick
 */
function inspectPixel(coords) {
  inspectorPanel.clear();

  if (!lastRun) {
    showInspectorMessage('Run analysis first, then click the map.', HINT_STYLE);
    return;
  }

  var point = ee.Geometry.Point([coords.lon, coords.lat]);

  if (markerLayer) { map.layers().remove(markerLayer); }
  markerLayer = ui.Map.Layer(point, {color: 'red'}, 'Inspected point');
  map.layers().add(markerLayer);

  showInspectorMessage(formatNumber(coords.lat, 4) + ', ' +
                       formatNumber(coords.lon, 4), HEADING_STYLE);
  showInspectorMessage('Reading...', HINT_STYLE);

  var quantity = QUANTITY[lastRun.socCfg.quantity];

  // One band per reported value, so this costs a single server round trip.
  var stack = lastRun.socImage.rename('soc_value')
    .addBands(lastRun.forestFraction.rename('forest_fraction'))
    .addBands(lastRun.forestArea.rename('forest_area_ha'));

  stack.reduceRegion({
    reducer: ee.Reducer.first(),
    geometry: point,
    scale: lastRun.scale
  }).evaluate(function (values, error) {
    inspectorPanel.clear();
    showInspectorMessage(formatNumber(coords.lat, 4) + ', ' +
                         formatNumber(coords.lon, 4), HEADING_STYLE);

    if (error) {
      showInspectorMessage('Could not read this point: ' + error, WARN_STYLE);
      return;
    }
    if (!values) {
      showInspectorMessage('No data at this point.', HINT_STYLE);
      return;
    }

    // null means masked -- no data here -- which is different from zero and is
    // worth saying, because masked soil pixels are what drag the coverage down.
    var soc = values.soc_value;
    var fraction = values.forest_fraction;
    var areaHa = values.forest_area_ha;

    showInspectorMessage('Soil carbon: ' + (soc === null || soc === undefined
      ? 'no data'
      : formatNumber(soc, 1) + ' ' + quantity.unit));

    showInspectorMessage('Forest cover: ' + (fraction === null || fraction === undefined
      ? 'no data'
      : formatNumber(fraction * 100, 1) + '% of pixel'));

    showInspectorMessage('Forest area: ' + (areaHa === null || areaHa === undefined
      ? 'no data'
      : formatNumber(areaHa, 1) + ' ha in pixel'));

    if (quantity.summable && soc !== null && soc !== undefined &&
        areaHa !== null && areaHa !== undefined) {
      showInspectorMessage('Carbon in forest here: ' +
                           formatNumber(soc * areaHa, 1) + ' t C in pixel', HINT_STYLE);
    }

    if ((soc === null || soc === undefined) && areaHa) {
      showInspectorMessage('Forest with no soil carbon data - this pixel is excluded ' +
                           'from the country mean and counts against the coverage %.',
                           WARN_STYLE);
    }

    showInspectorMessage('Sampled at ' + lastRun.scale + ' m. Values are the analysis ' +
                         'scale, not the layer\'s native resolution.', HINT_STYLE);
  });
}

/**
 * Add the FAO FRA reported figure as a sanity check. Stocks only -- FRA does
 * not report a concentration, so there is nothing to compare against.
 * @param {string} countryName
 */
function addFraComparison(countryName) {
  if (countryName === GLOBAL_OPTION) { return; }
  var fraLine = fraStats.formatFRA(countryName, FRA_YEAR);
  if (fraLine) {
    showMessage('For comparison - ' + fraLine, HINT_STYLE);
  }
}

/**
 * Add an in-app CSV download link. Works in a published app, unlike
 * Export.table.toDrive. The mean column name carries its unit, and the total
 * column is omitted entirely when it would not be a meaningful quantity.
 * @param {ee.FeatureCollection} stats
 * @param {Object} socCfg
 * @param {Object} forestCfg
 * @param {string} countryName
 * @param {number} scale
 */
function addDownloadLink(stats, socCfg, forestCfg, countryName, scale) {
  var selectors = ['iso3', 'country', 'forest_area_ha', 'forest_area_with_soc_ha',
                   'soc_data_coverage_pc'];
  if (QUANTITY[socCfg.quantity].summable) {
    selectors.push('soc_in_forest_total');
  }
  selectors.push(meanColumnName(socCfg));

  var slug = (countryName === GLOBAL_OPTION
    ? 'global'
    : countryName.replace(/[^A-Za-z0-9]+/g, '_'));

  var url = stats.getDownloadURL({
    format: 'csv',
    selectors: selectors,
    filename: 'soc_in_forest_' + slug + '_' + forestCfg.key + '_' + socCfg.key +
              '_' + socCfg.depth_cm + 'cm_' + scale + 'm'
  });

  resultsPanel.add(ui.Label({
    value: '↓ Download results (CSV)',
    style: LINK_STYLE,
    targetUrl: url
  }));
  showMessage(socCfg.citation, HINT_STYLE);
  showMessage(forestCfg.citation, HINT_STYLE);
}
