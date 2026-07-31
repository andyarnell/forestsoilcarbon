// Aim: export aggregated datasets to coarser scale assets (and drive) for use in FRA SOC gap filling work
// var isric_soc = ee.Image("projects/soilgrids-isric/soc_mean");
// Map.addLayer(isric_soc)
// var soc = ee.Image("OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02").select("b0");
var geometry = 
    /* color: #ffc82d */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-5.106969461279052, 10.212063434929076],
          [-5.106969461279052, 6.909910159511016],
          [8.252405538720948, 6.909910159511016],
          [8.252405538720948, 10.212063434929076]]], null, false);
var jrc_gfc2020 = ee.ImageCollection("JRC/GFC2020/V2");

var soc = ee.Image("projects/ee-andyarnellgee/assets/crosscutting/GSOCmap1_5_0");

var asset_folder = "projects/ee-andyarnellgee/assets/misc/team_fra_support"
var drive_folder = "fra_soc_gap_filling"

var exportRegion = ee.Geometry.Rectangle([-180, -90, 180, 90], null, false);
// var exportRegion = geometry


print(soc)

var year= 23

var hansen_cover_percent_threshold = 20

function gladGfc10pcPrep(year,cover_threshold) {
    var gfc = ee.Image("UMD/hansen/global_forest_change_2023_v1_11");
    var gfcTreecover2000 = gfc.select(["treecover2000"]);
    var gfcLoss2001_2020 = gfc.select(["lossyear"]).lte(year);
    var gfcTreecover2020 = gfcTreecover2000.where(gfcLoss2001_2020.eq(1), 0);
    return gfcTreecover2020.gt(cover_threshold).rename("GFC_TC_2020");
}
var forest = gladGfc10pcPrep(year,hansen_cover_percent_threshold)

var admin = ee.FeatureCollection("WM/geoLab/geoBoundaries/600/ADM0");

var vis_params = {min:0,max:200,palette:['yellow','orange','brown']}

Map.addLayer(forest, {min:0,max:1} ,"forest")



//jrc eufo 2020

var jrc_gfc2020_mosaic =  jrc_gfc2020.mosaic().unmask()

Map.addLayer(jrc_gfc2020_mosaic, {min:0,max:1} ,"jrc_gfc2020_mosaic")



// GLOBELAND

var raw_globland_2020 = ee.ImageCollection('users/eraviolo/GlobeLand30m_2020')

//reproject whole of image collection from the varoius utm zones into hansen resolution for all

// var default_projection =  forest.projection()

// print(default_projection)

var reproj_raw_globland_2020_prj = raw_globland_2020.map(function (image){return image.reproject({crs: "EPSG:4326",scale:30 })})

print (reproj_raw_globland_2020_prj.first().projection().nominalScale())

var forest_globland_2020 = reproj_raw_globland_2020_prj
    .mosaic()
    .eq(20).setDefaultProjection({crs: "EPSG:4326",scale:30});
    
Map.addLayer(forest_globland_2020, {min:0,max:1, palette: ['white','green' ]}, 'forest_globland_2020', false);



/////////////////////////////////
var template_image = soc

//forest exporting choisce
// var image =  forest_globland_2020
// var datasetName = 'globland_forest__2020_pixel_prop_in_1km'

// var image = forest //binary so can use mean to get proportion covered
// var datasetName = 'hansen_' + hansen_cover_percent_threshold+ 'pc_cover_20'+ year+'_pixel_prop_in_1km'

var image = jrc_gfc2020_mosaic.setDefaultProjection({crs: jrc_gfc2020.first().projection()})
var datasetName = 'jrc_gfc2020_prop_in_1km'

/////////////////////////////////
var imageVisParam2 = {"min":0,
                      "max":1,
                      "palette":["white","darkGreen"]};


Map.addLayer(image, imageVisParam2, datasetName,1,1)

//reducing resolution
var image_projection = image.projection();
print('image projection:', image_projection);

var template_projection = template_image.projection();
print('template_image projection:', template_projection);


// var reprojected = image.reproject('EPSG:4326', null, 100);

// Get datasets at scale and projection of ancillary dataset - i.e., the bespoke accessibility layer
var image_aggr = image
    // Force the next reprojection to aggregate instead of resampling.
    .reduceResolution({
      reducer: ee.Reducer.mean(),
      maxPixels: 65536//34423
    })
    // Request the data at the scale and projection of the image image.
    .reproject({
      crs: template_projection
    });

Map.addLayer(image_aggr,"","image_agg")
// Map.addLayer(all_species_trees_remaining_clipped)
    
    //get native hansen scale for projecting into if needed
var template_scale = template_image.projection().nominalScale().getInfo();
print ('template_image - scale', template_scale)

//27.82987269831839 - native resolution of hansen. 
//run below if full high res export required



var out_image = image_aggr.rename("prop_cover_2020").addBands(ee.Image.pixelArea().divide(10000).toDouble().rename("pixel_area_km"))
///////////

// Exporting clipped image to Earth Engine Asset
Export.image.toAsset({
  image: out_image, // The image to export
  description: "to_asset_"+datasetName + "_aggr", // Description of the task
  assetId: asset_folder +"/"+ datasetName + "_aggr", // Asset path (update `your_username`)
  scale: template_scale, // Resolution in meters
  maxPixels: 1e13, // Max allowed pixels
  region: exportRegion // The region to export
});

// //exporting clipped image
// Export.image.toDrive({
//   image: out_image,
//   description: datasetName+"_aggr",
//   folder:drive_folder,
//   scale: template_scale,//927.6624232772793,//27.82987269831839,
//   maxPixels: 1813459444902,   
//   region: exportRegion
// });


//////
Map.addLayer(prop_forest,"","prop_forest")
