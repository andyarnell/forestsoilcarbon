//Aim: get stats for soc in forest areas, for gap filling FRA reporting
//key stats are mean soc
///////// 0: parameters

//property to group national stats by - e.g. iso3 code
var groupProperty = 'ISO3CD'

//from list of admin properties - which one to group by?

// 0: OBJECTID
// 1: ROMNAM
// 2: CONTCD
// 3: Shape_STAr
// 4: ISO3CD
// 5: Shape_STLe
// 6: ISOADM
// 7: STSCOD
// 8: system:index
// 9: MAPLAB
// 10: GlobalID

//NB this parameter is not dynamic in this code as requires exporting step for forest to higher res
// var year= 20 //i.e., choice of year to use for forest cover. Where 20 is 2020.

//////// 1a: admin boundaries 


// from Anne Branthomme (UN boundaries - coarse country level with geometry errors fixed)
var admin = ee.FeatureCollection("projects/ee-andyarnellgee/assets/UN_BNDA_2020_repaired");

//other alternative boundaries (less coarse but slower to process) 
// var admin = ee.FeatureCollection("WM/geoLab/geoBoundaries/600/ADM0");

//check columns in admin 
print(admin.first().propertyNames())

var vis_params = {min:0,max:200,palette:['yellow','orange','brown']}
var vis_params_forest = {min:0,max:1,palette:['white','green']}



////////// 1b: soil organic carbon data data


//from GSOC 1.5. roughly 1km pixels (30 arc sec) and in tonnes per ha according to techincal report on
var soc = ee.Image("projects/ee-andyarnellgee/assets/crosscutting/GSOCmap1_5_0");

//other soil datasets if needed in future
// var isric_soc = ee.Image("projects/soilgrids-isric/soc_mean");

// var soc = ee.Image("OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02").select("b0");

Map.addLayer(soc, vis_params,"gsoc - soil organic carbon")


////////// 1c: forest raw data prep



// //prep for hansen - cover from 2000 with loss pixels masked out
// function gladGfc10pcPrep(year) {
//     var gfc = ee.Image("UMD/hansen/global_forest_change_2023_v1_11");
//     var gfcTreecover2000 = gfc.select(["treecover2000"]);
//     var gfcLoss2001_2020 = gfc.select(["lossyear"]).lte(year);
//     var gfcTreecover2020 = gfcTreecover2000.where(gfcLoss2001_2020.eq(1), 0);
//     return gfcTreecover2020.gt(10).rename("GFC_TC_2020");
// }

// //get 10 percent cover for year of choice
// var forest = gladGfc10pcPrep(year)


// Map.addLayer(forest, vis_params_forest ,"forest")


// // Define pixel area in hectares (1 pixel = 30m x 30m = 900 m² = 0.09 hectares)
// var pixelArea = ee.Image.pixelArea().divide(10000); // Convert to hectares

//old
// Multiply SOC and forest layers by pixel area
// // var socInForestArea = soc_in_forest.multiply(pixelArea);

 // // var forestArea = forest.multiply(pixelArea);


/////////////// 1.d: prop forest in 1km
//exported 1km image at same res as the gsoc data 
// NB mistake in naming bands: "pixel_area_km" is actually in Hectares (mistake when making file)

//code for exporting: https://code.earthengine.google.com/46bf76f330a5d032908a2aa87be37411
//https://code.earthengine.google.com/?scriptPath=users%2Fandyarnellgee%2Fgeneral%3Amisc%2Fteam_fra_support%2Ffra_soil_carbon_coarse_forest_export
//hansen 10pc 2020

var forest_10pc_2020_1km = ee.Image("projects/ee-andyarnellgee/assets/misc/team_fra_support/hansen_10pc_cover_2020_pixel_prop_in_1km_aggr");
print(forest_10pc_2020_1km.bandNames())

Map.addLayer(forest_10pc_2020_1km.select("prop_cover_2020"),vis_params_forest,"forest_10pc_2020_1km")



// hansen 20pc 2020
var forest_20pc_2020_1km = ee.Image("projects/ee-andyarnellgee/assets/misc/team_fra_support/hansen_20pc_cover_2020_pixel_prop_in_1km_aggr");
print(forest_20pc_2020_1km.bandNames())

Map.addLayer(forest_20pc_2020_1km.select("prop_cover_2020"),vis_params_forest,"forest_20pc_2020_1km")


// globland forest 2020
var globland_forest_prop_1km = ee.Image("projects/ee-andyarnellgee/assets/misc/team_fra_support/globland_forest__2020_pixel_prop_in_1km_aggr");
print(globland_forest_prop_1km.bandNames())

Map.addLayer(globland_forest_prop_1km.select("prop_cover_2020"),vis_params_forest,"globland_forest_prop_1km")

//jrc gfc 2020
var jrc_gfc_2020_prop_1km = ee.Image("projects/ee-andyarnellgee/assets/misc/team_fra_support/jrc_gfc2020_prop_in_1km_aggr");
print(jrc_gfc_2020_prop_1km.bandNames())

Map.addLayer(jrc_gfc_2020_prop_1km.select("prop_cover_2020"),vis_params_forest,"jrc_gfc_2020_prop_1km")

///////////////////////////////chose output
// var forest_prop = forest_10pc_2020_1km
// var dataset_name = "hansen_10pc_2020"

// var forest_prop = forest_20pc_2020_1km
// var dataset_name = "hansen_20pc_2020"

// var forest_prop = globland_forest_prop_1km
// var dataset_name = "globland_2020"

var forest_prop = jrc_gfc_2020_prop_1km
var dataset_name = "jrc_gfc_2020"


////////////// 2. combine soil and forest areas


// get area of forest per pixel and renaming band for the output NB pixel_area_km is actually in Hectares (mistake when making file)
var forestArea = forest_prop.select('pixel_area_km').multiply(forest_prop.select('prop_cover_2020')).rename("forest_area_ha")

Map.addLayer(forestArea,{min:0,max:100},"forestArea_ha",0,1)

// var socInForestArea = soc.multiply(forest_20pc_2020_1km.select('prop_cover_2020')).rename("soc_weighted_by_forest")
var socInForestArea = soc.multiply(forestArea).rename("soc_weighted_by_forest")



////////////3 statistics


// Function to calculate zonal statistics by administrative boundaries
function calculateZonalStats(image, regions, scale, propertyName) {
    return image.reduceRegions({
        collection: regions,
        reducer: ee.Reducer.sum(),
        scale: scale,
      //  crs: "EPSG:4326" // Use WGS 84 for compatibility
    }).map(function(feature) {
        return feature.set(propertyName, feature.get('sum'));
    });
}

var scale = socInForestArea.projection().nominalScale().getInfo()

print(scale)

// Calculate statistics
var adminStatsSOC = calculateZonalStats(socInForestArea.addBands(forestArea), admin,scale , "SOC_area_sum");

var adminStatsForest = calculateZonalStats(forestArea, admin, scale, "Forest_area_sum");




// Print results
print("SOC in forest stats by admin boundary", adminStatsSOC);
// print("Forest area stats by admin boundary", adminStatsForest);

// Optional: Export the results to Google Drive for further analysis
Export.table.toDrive({
    collection: adminStatsSOC,
    folder:"fra_soc_gap_filling",
    description: "raw_SOC_in_forest_"+dataset_name+"_stats",
    fileFormat: "CSV"
});

// Export.table.toDrive({
//     collection: adminStatsForest,
//     folder:"fra_soc_gap_filling",
//     description: "Forest_area_stats",
//     fileFormat: "CSV"
// });



// get results within a group 

// some countries have multiple polygons (e.g. 270 features but 253 'ISO3CD' codes, and 261 'ROMNAM'  country names)
var groupAndAggregate = function(featureCollection, groupProperty, valueProperties) {
  print('Group Property:', groupProperty);
  print('Value Properties:', valueProperties);

  // Step i: Create a combined reducer for all value properties
  var combinedReducer = ee.Reducer.sum().repeat(valueProperties.length).group({
    groupField: 0, // Index of the group property in the selectors array
  });

  // Step ii: Group and aggregate using the combined reducer
  var grouped = featureCollection.reduceColumns({
    reducer: combinedReducer,
    selectors: [groupProperty].concat(valueProperties) // Group property + value properties
  });

  // Step iii: Extract the list of groups and aggregated values
  var groupsList = ee.List(grouped.get('groups'));
  print('Groups List:', groupsList); // Debug output

  // Step iv: Convert grouped results into a FeatureCollection
  var groupedFeatureCollection = ee.FeatureCollection(
    groupsList.map(function(item) {
      item = ee.Dictionary(item); // Convert each item in the list to a dictionary
      var groupName = item.get('group');
      var values = ee.List(item.get('sum')); // Aggregated values list
      var properties = { group: groupName };

      // Assign each value to its respective property
      valueProperties.forEach(function(prop, index) {
        properties[prop] = values.get(index);
      });

      return ee.Feature(null, properties);
    })
  );

  return groupedFeatureCollection; // Return the grouped FeatureCollection
};


// Call the function to group and sum
var groupedFC = groupAndAggregate(adminStatsSOC, "ISO3CD", ['soc_weighted_by_forest','forest_area_ha']);

// // Print and visualize the grouped FeatureCollection
// print('Grouped and Summed FeatureCollection:', groupedFC);

///////get mean values per group

// var adminStatsSOC.map(function feature {return  feature.set("mean_soc",(feature.get("forest_area_km2").divide(feature.get("soc_weighted_by_forest")))) })
var groupedFC = groupedFC.map(function(feature) {
  return feature.set(
    "mean_soc",
    (feature.getNumber("soc_weighted_by_forest").divide(feature.getNumber("forest_area_ha")))
  );
});

// Print and visualize the grouped FeatureCollection
print('Grouped and Summed FeatureCollection:', groupedFC);

///////get total soc in forest 
var global_sum = ee.Number(groupedFC.reduceColumns(ee.Reducer.sum(),["soc_weighted_by_forest"]).get("sum"))

print("global_sum - soc_weighted_by_forest - gt", global_sum.divide(1e9)) //in gigatonnes if soc is in tonnes per ha

/////////////

// Optional: Export the results to Google Drive for further analysis
Export.table.toDrive({
    collection: groupedFC,
    folder:"fra_soc_gap_filling",
    description: "SOC_in_forest_"+dataset_name+"_stats_grouped_by_"+groupProperty,
    fileFormat: "CSV" 
});
