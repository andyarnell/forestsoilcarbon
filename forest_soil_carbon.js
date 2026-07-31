// Forest Soil Carbon App
var APP_VERSION = "0.1.0";

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

// =============================================================================
// SOIL CARBON DATASETS
// Add a layer by adding one object here -- there is no dataset-specific logic
// anywhere else in this file.
//
//   scale_factor  multiplier applied to raw pixel values to reach `units`
//   depth_cm      the depth the layer actually represents
//   is_stock      true  = tonnes C per hectare (usable for statistics)
//                 false = a concentration (g/kg, dg/kg). Displayable, but the
//                         app refuses to compute statistics from it, because
//                         summing a concentration as if it were a stock is
//                         meaningless. See docs/soil_carbon_datasets_review.md
// =============================================================================

var SOC_DATASETS = [
  {
    key: 'gsoc_1_5',
    label: 'GSOCmap 1.5 (FAO) - 0-30 cm',
    asset: 'projects/ee-andyarnellgee/assets/crosscutting/GSOCmap1_5_0',
    band: null,                  // single-band image
    scale_factor: 1,
    units: 't/ha',
    depth_cm: '0-30',
    native_resolution_m: 1000,
    is_stock: true,
    citation: 'FAO & ITPS (2022) Global Soil Organic Carbon Map (GSOCmap) v1.5. FAO, Rome.'
  },
  {
    key: 'soilgrids_ocs',
    label: 'SoilGrids 2.0 organic carbon stock - 0-30 cm',
    asset: 'projects/soilgrids-isric/ocs_mean',
    band: 'ocs_0-30cm_mean',
    scale_factor: 0.1,           // stored x10; verify against the EE catalogue
    units: 't/ha',
    depth_cm: '0-30',
    native_resolution_m: 250,
    is_stock: true,
    citation: 'Poggio, L. et al. (2021) SoilGrids 2.0. SOIL 7, 217-240.'
  },
  {
    key: 'soilgrids_conc',
    label: 'SoilGrids 2.0 SOC concentration - 15-30 cm (not comparable)',
    asset: 'projects/soilgrids-isric/soc_mean',
    band: 'soc_15-30cm_mean',
    scale_factor: 0.1,           // dg/kg -> g/kg
    units: 'g/kg',
    depth_cm: '15-30',
    native_resolution_m: 250,
    is_stock: false,
    citation: 'Poggio, L. et al. (2021) SoilGrids 2.0. SOIL 7, 217-240.'
  },
  {
    key: 'openlandmap_conc',
    label: 'OpenLandMap SOC concentration - 0-30 cm (not comparable)',
    asset: 'OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02',
    band: 'b30',
    scale_factor: 0.2,           // stored x5
    units: 'g/kg',
    depth_cm: '0-30',
    native_resolution_m: 250,
    is_stock: false,
    citation: 'Hengl, T. (2018) Soil organic carbon content in x5 g/kg at 6 standard depths. Zenodo.'
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

var SOC_VIS = {min: 0, max: 200, palette: ['#ffffcc', '#fed976', '#fd8d3c', '#7f2704']};
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
 * Build a single-band SOC image in the config's units.
 * @param {Object} cfg  a SOC_DATASETS entry
 * @return {ee.Image} band 'soc_t_ha' (or the concentration, if not a stock)
 */
function buildSocImage(cfg) {
  var img = ee.Image(cfg.asset);
  img = cfg.band ? img.select([cfg.band]) : img.select([0]);
  return img.multiply(cfg.scale_factor).rename('soc_t_ha');
}

/**
 * Build forest area per pixel, in hectares.
 * @param {Object} cfg  a FOREST_DATASETS entry
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

  var img = ee.Image(cfg.asset);
  img = cfg.band ? img.select([cfg.band]) : img.select([0]);

  var fraction;
  if (cfg.type === 'binary') {
    var threshold = (cfg.threshold === undefined || cfg.threshold === null) ? 0 : cfg.threshold;
    fraction = img.gt(threshold);
  } else {
    fraction = img.clamp(0, 1);
  }

  var pixelHa = ee.Image.pixelArea().divide(10000);
  return fraction.multiply(pixelHa).rename('forest_area_ha');
}

/**
 * Forest cover fraction, for display only.
 * @param {Object} cfg  a FOREST_DATASETS entry
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
 * Per-country forest area, SOC stock in forest, and area-weighted mean SOC.
 * @param {ee.Image} socImage        band 'soc_t_ha'
 * @param {ee.Image} forestAreaImage band 'forest_area_ha'
 * @param {ee.FeatureCollection} regions
 * @param {number} scale  metres
 * @return {ee.FeatureCollection} geometry-free features, one per country
 */
function computeCountryStats(socImage, forestAreaImage, regions, scale) {
  var socInForest = socImage.multiply(forestAreaImage).rename('soc_in_forest_t');

  var summed = socInForest.addBands(forestAreaImage).reduceRegions({
    collection: regions,
    reducer: ee.Reducer.sum(),
    scale: scale,
    tileScale: 4
  });

  return summed.map(function (f) {
    var area = ee.Number(ee.Algorithms.If(f.get('forest_area_ha'), f.get('forest_area_ha'), 0));
    var stock = ee.Number(ee.Algorithms.If(f.get('soc_in_forest_t'), f.get('soc_in_forest_t'), 0));
    return ee.Feature(null, {
      iso3: f.get('iso3_code'),
      country: f.get('gaul0_name'),
      forest_area_ha: area,
      soc_in_forest_t: stock,
      mean_soc_t_ha: ee.Algorithms.If(area.gt(0), stock.divide(area), null)
    });
  });
}

/**
 * Collapse a stats collection to global totals.
 * @param {ee.FeatureCollection} statsFc
 * @return {ee.Dictionary} keys 'forest_area_ha', 'soc_in_forest_t', 'mean_soc_t_ha'
 */
function computeTotals(statsFc) {
  var sums = ee.Dictionary(statsFc.reduceColumns({
    reducer: ee.Reducer.sum().repeat(2),
    selectors: ['soc_in_forest_t', 'forest_area_ha']
  }));
  var values = ee.List(sums.get('sum'));
  var stock = ee.Number(values.get(0));
  var area = ee.Number(values.get(1));
  return ee.Dictionary({
    soc_in_forest_t: stock,
    forest_area_ha: area,
    mean_soc_t_ha: ee.Algorithms.If(area.gt(0), stock.divide(area), null)
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

/**
 * Build the {label, value} items a ui.Select needs, plus the custom option.
 * @param {Array<Object>} datasets
 * @param {string} customLabel
 * @return {Array<Object>}
 */
function makeSelectItems(datasets, customLabel) {
  var items = datasets.map(function (d) {
    return {label: d.label, value: d.key};
  });
  items.push({label: customLabel, value: CUSTOM_KEY});
  return items;
}

// =============================================================================
// UI - SOIL CARBON SECTION
// =============================================================================

var socSelect = ui.Select({
  items: makeSelectItems(SOC_DATASETS, 'Custom - my own GEE asset'),
  value: SOC_DATASETS[0].key,
  style: {stretch: 'horizontal', margin: '2px 4px'},
  onChange: function (key) {
    var isCustom = (key === CUSTOM_KEY);
    socCustomPanel.style().set({shown: isCustom});
    socNoteLabel.setValue(describeSocChoice(key));
  }
});

var socAssetBox = ui.Textbox({
  placeholder: 'projects/your-project/assets/national_soc_map',
  style: {stretch: 'horizontal', margin: '2px 4px', fontSize: '11px'}
});

var socBandBox = ui.Textbox({
  placeholder: 'band name (blank = first band)',
  style: {stretch: 'horizontal', margin: '2px 4px', fontSize: '11px'}
});

var socUnitsSelect = ui.Select({
  items: [
    {label: 'Stock, tonnes C per hectare (t/ha)', value: 'stock'},
    {label: 'Concentration, g/kg - display only', value: 'concentration'}
  ],
  value: 'stock',
  style: {stretch: 'horizontal', margin: '2px 4px'}
});

var socCustomPanel = ui.Panel({
  widgets: [
    ui.Label('Asset ID', BODY_STYLE), socAssetBox,
    ui.Label('Band', BODY_STYLE), socBandBox,
    ui.Label('What the values mean', BODY_STYLE), socUnitsSelect,
    ui.Label('Must be 0-30 cm to compare with the global layers.', HINT_STYLE)
  ],
  style: {shown: false}
});

var socNoteLabel = ui.Label('', HINT_STYLE);

/**
 * @param {string} key
 * @return {string} the hint shown under the soil carbon dropdown
 */
function describeSocChoice(key) {
  if (key === CUSTOM_KEY) { return 'Your own asset. Tell the app what the values mean.'; }
  var cfg = getDatasetByKey(SOC_DATASETS, key);
  var note = cfg.native_resolution_m + ' m, ' + cfg.depth_cm + ' cm, ' + cfg.units;
  if (!cfg.is_stock) {
    note += ' - a concentration, so statistics are disabled for this layer.';
  }
  return note;
}
socNoteLabel.setValue(describeSocChoice(SOC_DATASETS[0].key));

// =============================================================================
// UI - FOREST SECTION
// =============================================================================

var forestSelect = ui.Select({
  items: makeSelectItems(FOREST_DATASETS, 'Custom - my own GEE asset'),
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

// One option until the FRA reporting depth is confirmed. Every dataset config
// carries depth_cm, so widening this is a configuration change, not a rewrite.
var depthSelect = ui.Select({
  items: [{label: '0-30 cm (FRA default)', value: '0-30'}],
  value: '0-30',
  disabled: true,
  style: {stretch: 'horizontal', margin: '2px 4px'}
});

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
  ui.Label('Soil depth', BODY_STYLE), depthSelect,
  ui.Label('All layers currently offered are 0-30 cm.', HINT_STYLE),
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

var rightPanel = ui.Panel({
  widgets: [ui.Label('Results', HEADING_STYLE), resultsPanel],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {width: '310px', backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: '2px'}
});

var map = ui.Map();
map.setCenter(0, 20, 2);
map.setControlVisibility({all: true});

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
  var isStock = (socUnitsSelect.getValue() === 'stock');
  return {
    key: CUSTOM_KEY,
    label: 'Custom soil carbon layer',
    asset: asset,
    band: socBandBox.getValue() || null,
    scale_factor: 1,
    units: isStock ? 't/ha' : 'g/kg',
    depth_cm: depthSelect.getValue(),
    native_resolution_m: null,
    is_stock: isStock,
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
    label: 'Custom forest layer',
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

function runAnalysis() {
  resultsPanel.clear();
  map.layers().reset();

  var socCfg = resolveSocConfig();
  var forestCfg = resolveForestConfig();

  if (!socCfg) {
    showMessage('Enter a soil carbon asset ID.', WARN_STYLE);
    return;
  }
  if (!forestCfg) {
    showMessage('Enter a forest asset ID.', WARN_STYLE);
    return;
  }

  var countryName = countrySelect.getValue();
  var scale = Number(scaleSelect.getValue());
  var regions = getRegions(countryName);

  var socImage = buildSocImage(socCfg);
  var forestArea = buildForestArea(forestCfg);
  var forestFraction = buildForestFraction(forestCfg);

  map.addLayer(socImage, SOC_VIS, 'Soil carbon (' + socCfg.units + ')', true, 0.8);
  map.addLayer(forestFraction.selfMask(), FOREST_VIS, 'Forest: ' + forestCfg.label, true, 0.7);
  map.addLayer(socImage.multiply(forestArea).selfMask(), SOC_IN_FOREST_VIS,
               'Soil carbon in forest (t per pixel)', false, 1);

  showMessage(countryName, HEADING_STYLE);
  showMessage('Forest: ' + forestCfg.label);
  showMessage('Soil carbon: ' + socCfg.label);
  showMessage('Depth ' + socCfg.depth_cm + ' cm, analysed at ' + scale + ' m', HINT_STYLE);

  // A concentration is not a stock. Summing one as if it were would produce a
  // number with no physical meaning, so the layer is mapped but not summarised.
  if (!socCfg.is_stock) {
    showMessage('This layer is a concentration (' + socCfg.units + '), not a stock. ' +
                'It is shown on the map but statistics are disabled - the result ' +
                'would not be a carbon stock. Pick a t/ha layer to get numbers.',
                WARN_STYLE);
    return;
  }

  showMessage('Computing...', HINT_STYLE);

  var stats = computeCountryStats(socImage, forestArea, regions, scale);
  var totals = computeTotals(stats);

  totals.evaluate(function (result, error) {
    resultsPanel.clear();
    showMessage(countryName, HEADING_STYLE);
    showMessage('Forest: ' + forestCfg.label);
    showMessage('Soil carbon: ' + socCfg.label);
    showMessage('Depth ' + socCfg.depth_cm + ' cm, analysed at ' + scale + ' m', HINT_STYLE);

    if (error) {
      showMessage('Failed: ' + error, WARN_STYLE);
      return;
    }
    if (!result || result.forest_area_ha === null) {
      showMessage('No data returned. Try a coarser analysis scale.', WARN_STYLE);
      return;
    }

    showMessage('Forest area: ' + formatNumber(result.forest_area_ha / 1000, 1) + ' kha');
    showMessage('Soil carbon in forest: ' + formatNumber(result.soc_in_forest_t / 1e6, 1) + ' Mt');
    showMessage('Mean soil carbon in forest: ' +
                formatNumber(result.mean_soc_t_ha, 1) + ' t/ha', HEADING_STYLE);

    addFraComparison(countryName);
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

/**
 * Add the FAO FRA reported figure as a sanity check.
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
 * Export.table.toDrive.
 * @param {ee.FeatureCollection} stats
 * @param {Object} socCfg
 * @param {Object} forestCfg
 * @param {string} countryName
 * @param {number} scale
 */
function addDownloadLink(stats, socCfg, forestCfg, countryName, scale) {
  var slug = (countryName === GLOBAL_OPTION ? 'global' : countryName.replace(/[^A-Za-z0-9]+/g, '_'));
  var filename = 'soc_in_forest_' + slug + '_' + forestCfg.key + '_' + socCfg.key + '_' + scale + 'm';

  var url = stats.getDownloadURL({
    format: 'csv',
    selectors: ['iso3', 'country', 'forest_area_ha', 'soc_in_forest_t', 'mean_soc_t_ha'],
    filename: filename
  });

  resultsPanel.add(ui.Label({
    value: '↓ Download results (CSV)',
    style: LINK_STYLE,
    targetUrl: url
  }));
  showMessage(socCfg.citation, HINT_STYLE);
  showMessage(forestCfg.citation, HINT_STYLE);
}
