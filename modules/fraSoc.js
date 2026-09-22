/**
 * fraSoc.js — FRA-reported forest soil organic carbon, per country.
 * Usage: var fraSoc = require('users/andyarnellgee/apps:modules/fraSoc.js');
 * Regenerate with tools/fra_soc/ (fetch.py + build.py).
 *
 * Source: FRA data platform API (fra-data.fao.org), the same JSON the platform frontend uses.
 *   Endpoint: /api/cycle-data/table/table-data?assessmentName=fra&cycleName=2025
 *             &tableNames[]=carbonStockAvg&tableNames[]=carbonStockSoilDepth&countryISOs[]=...
 *   (FRA 2020 cycle used as fallback, tableNames[]=carbonStock, where a country has no
 *   FRA 2025 value; entry.cycle says which.)
 * Table: FRA 2d "Carbon stock", category "Soil carbon", tonnes/ha; plus reported
 *   "Soil depth (cm) used for soil carbon".
 * Retrieved: 2026-09-22. Values flagged in calculatedYears were derived by the platform
 *   (e.g. per-ha value computed from reported totals), not entered directly.
 * deskStudy: true = FAO desk study for that country/cycle, not a country report.
 *
 * Plain JS lookup — no Earth Engine API calls.
 */

var DATA = {
  "AND": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Andorra",
    "soc": {
      "2025": 14.57
    }
  },
  "ARG": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Argentina",
    "soc": {
      "1990": 43.68,
      "2000": 43.96,
      "2010": 44.34,
      "2015": 44.51,
      "2020": 44.58,
      "2025": 44.69
    },
    "soilDepthCm": 30.0
  },
  "ARM": {
    "calculatedYears": [
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Armenia",
    "soc": {
      "1990": 36.84,
      "2000": 36.82,
      "2010": 36.8,
      "2015": 36.81,
      "2020": 37.1,
      "2025": 37.98
    },
    "soilDepthCm": 30.0
  },
  "AUS": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Australia",
    "soc": {
      "1990": 53.35,
      "2000": 53.35,
      "2010": 53.68,
      "2015": 53.75,
      "2020": 53.68,
      "2025": 53.68
    },
    "soilDepthCm": 30.0
  },
  "AUT": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Austria",
    "soc": {
      "1990": 106.0,
      "2010": 104.0
    },
    "soilDepthCm": 50.0
  },
  "BDI": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Burundi",
    "soilDepthCm": 30.0
  },
  "BEL": {
    "calculatedYears": [
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Belgium",
    "soc": {
      "1990": 80.4,
      "2000": 84.42,
      "2010": 89.29,
      "2015": 87.6,
      "2020": 87.84,
      "2025": 87.84
    },
    "soilDepthCm": 20.0
  },
  "BEN": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Benin",
    "soc": {
      "1990": 47.0,
      "2000": 47.0,
      "2010": 47.0,
      "2015": 47.0,
      "2020": 47.0,
      "2025": 47.0
    },
    "soilDepthCm": 30.0
  },
  "BFA": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Burkina Faso",
    "soc": {
      "1990": 35.0,
      "2000": 35.0,
      "2010": 35.0,
      "2015": 35.0,
      "2020": 35.0
    },
    "soilDepthCm": 30.0
  },
  "BGD": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Bangladesh",
    "soc": {
      "1990": 80.4,
      "2000": 80.4,
      "2010": 80.4,
      "2015": 80.4,
      "2020": 89.04,
      "2025": 89.04
    },
    "soilDepthCm": 30.0
  },
  "BLR": {
    "calculatedYears": [
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": true,
    "name": "Belarus",
    "soc": {
      "1990": 92.6,
      "2000": 97.1,
      "2010": 99.8,
      "2015": 103.7,
      "2020": 107.0,
      "2025": 111.0
    },
    "soilDepthCm": 30.0
  },
  "BRA": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Brazil",
    "soc": {
      "1990": 42.81,
      "2000": 43.06,
      "2010": 43.12,
      "2015": 43.3,
      "2020": 43.44,
      "2025": 43.58
    },
    "soilDepthCm": 35.0
  },
  "BRN": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Brunei Darussalam",
    "soc": {
      "1990": 58.16,
      "2000": 52.86,
      "2010": 52.68,
      "2015": 52.68,
      "2020": 52.68
    },
    "soilDepthCm": 30.0
  },
  "BTN": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Bhutan",
    "soc": {
      "1990": 64.05,
      "2000": 64.05,
      "2010": 64.05,
      "2015": 64.05,
      "2020": 63.86,
      "2025": 68.12
    },
    "soilDepthCm": 30.0
  },
  "CAN": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Canada",
    "soc": {
      "1990": 81.99,
      "2000": 82.26,
      "2010": 82.54,
      "2015": 82.67,
      "2020": 82.77,
      "2025": 82.8
    },
    "soilDepthCm": 55.0
  },
  "CHE": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Switzerland",
    "soc": {
      "2000": 123.28,
      "2010": 123.28,
      "2015": 123.28,
      "2020": 123.28,
      "2025": 123.28
    },
    "soilDepthCm": 100.0
  },
  "CHL": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Chile",
    "soc": {
      "1990": 50.0,
      "2000": 50.0,
      "2010": 50.0,
      "2015": 50.0,
      "2020": 50.0,
      "2025": 50.0
    },
    "soilDepthCm": 30.0
  },
  "COD": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Democratic Republic of the Congo",
    "soc": {
      "1990": 187.14,
      "2000": 187.14,
      "2010": 187.14,
      "2015": 187.14,
      "2020": 187.14,
      "2025": 187.14
    },
    "soilDepthCm": 50.0
  },
  "COL": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Colombia",
    "soc": {
      "1990": 42.45,
      "2000": 42.45,
      "2010": 42.45,
      "2015": 42.45,
      "2020": 42.45,
      "2025": 42.45
    },
    "soilDepthCm": 30.0
  },
  "CPV": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Cabo Verde",
    "soc": {
      "1990": 50.0,
      "2000": 50.0,
      "2010": 50.0,
      "2015": 50.0,
      "2020": 50.0
    },
    "soilDepthCm": 30.0
  },
  "CRI": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Costa Rica",
    "soc": {
      "1990": 109.58,
      "2000": 109.58,
      "2010": 109.58,
      "2015": 109.58,
      "2020": 109.58,
      "2025": 109.58
    },
    "soilDepthCm": 30.0
  },
  "CYP": {
    "calculatedYears": [
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Cyprus",
    "soc": {
      "1990": 22.5,
      "2000": 22.5,
      "2010": 22.5,
      "2015": 22.5,
      "2020": 22.5,
      "2025": 22.48
    }
  },
  "CZE": {
    "calculatedYears": [
      "2015"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Czechia",
    "soc": {
      "2010": 93.32,
      "2015": 93.32,
      "2020": 93.32,
      "2025": 93.32
    },
    "soilDepthCm": 83.0
  },
  "DEU": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Germany",
    "soc": {
      "1990": 55.24,
      "2000": 59.34,
      "2010": 63.44,
      "2015": 65.49,
      "2020": 67.54,
      "2025": 69.59
    },
    "soilDepthCm": 30.0
  },
  "DJI": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Djibouti",
    "soilDepthCm": 30.0
  },
  "DNK": {
    "calculatedYears": [
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Denmark",
    "soc": {
      "1990": 171.83,
      "2000": 173.29,
      "2010": 174.47,
      "2015": 174.82,
      "2020": 174.85,
      "2025": 167.75
    },
    "soilDepthCm": 100.0
  },
  "DOM": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Dominican Republic",
    "soc": {
      "1990": 210.5,
      "2000": 210.5,
      "2010": 210.5,
      "2015": 210.5,
      "2020": 210.5,
      "2025": 210.5
    },
    "soilDepthCm": 30.0
  },
  "DZA": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Algeria",
    "soc": {
      "1990": 38.0,
      "2000": 38.0,
      "2010": 38.0,
      "2015": 38.0,
      "2020": 38.0,
      "2025": 38.0
    },
    "soilDepthCm": 30.0
  },
  "ESH": {
    "cycle": "2025",
    "deskStudy": true,
    "name": "Western Sahara",
    "soc": {
      "1990": 27.91,
      "2000": 27.88,
      "2010": 28.14,
      "2015": 28.18,
      "2020": 28.34,
      "2025": 28.01
    },
    "soilDepthCm": 30.0
  },
  "ESP": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Spain",
    "soc": {
      "2020": 19.53
    },
    "soilDepthCm": 10.0
  },
  "EST": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Estonia",
    "soc": {
      "1990": 155.97,
      "2000": 155.97,
      "2010": 155.97,
      "2015": 155.97,
      "2020": 155.97,
      "2025": 155.97
    },
    "soilDepthCm": 55.0
  },
  "ETH": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Ethiopia",
    "soc": {
      "1990": 60.3,
      "2000": 60.3,
      "2010": 60.3,
      "2015": 60.3,
      "2020": 60.3,
      "2025": 60.3
    },
    "soilDepthCm": 60.0
  },
  "FIN": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Finland",
    "soc": {
      "1990": 165.15,
      "2000": 166.46,
      "2010": 168.65,
      "2015": 168.88,
      "2020": 168.88,
      "2025": 168.88
    },
    "soilDepthCm": 30.0
  },
  "FLK": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Falkland Islands (Malvinas)",
    "soc": {
      "1990": 0.0,
      "2000": 0.0,
      "2010": 0.0,
      "2015": 0.0,
      "2020": 0.0
    }
  },
  "FRA": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "France",
    "soc": {
      "1990": 70.3
    },
    "soilDepthCm": 30.0
  },
  "GAB": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Gabon",
    "soc": {
      "1990": 163.4,
      "2000": 163.4,
      "2010": 163.4,
      "2015": 163.4,
      "2020": 163.4,
      "2025": 163.4
    },
    "soilDepthCm": 200.0
  },
  "GBR": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "United Kingdom of Great Britain and Northern Ireland",
    "soc": {
      "1990": 232.33,
      "2000": 233.89,
      "2010": 234.39,
      "2015": 235.66,
      "2020": 234.18,
      "2025": 234.56
    },
    "soilDepthCm": 100.0
  },
  "GEO": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Georgia",
    "soc": {
      "1990": 67.71,
      "2000": 69.22,
      "2010": 67.71,
      "2015": 67.71,
      "2020": 67.71,
      "2025": 67.71
    }
  },
  "GIB": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Gibraltar",
    "soc": {
      "1990": 0.0,
      "2000": 0.0,
      "2010": 0.0,
      "2015": 0.0,
      "2020": 0.0
    }
  },
  "GLP": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Guadeloupe",
    "soc": {
      "1990": 100.0,
      "2000": 100.0,
      "2010": 100.0,
      "2015": 100.0,
      "2020": 100.0,
      "2025": 100.0
    },
    "soilDepthCm": 100.0
  },
  "GNB": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Guinea-Bissau",
    "soc": {
      "1990": 47.0,
      "2000": 47.0,
      "2010": 47.0,
      "2015": 47.0,
      "2020": 47.0
    },
    "soilDepthCm": 30.0
  },
  "GNQ": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Equatorial Guinea",
    "soc": {
      "1990": 65.0,
      "2000": 65.0,
      "2010": 65.0,
      "2015": 65.0,
      "2020": 65.0,
      "2025": 65.0
    },
    "soilDepthCm": 30.0
  },
  "GUF": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "French Guiana",
    "soc": {
      "1990": 100.2,
      "2000": 100.2,
      "2010": 100.2,
      "2015": 100.2,
      "2020": 100.2,
      "2025": 100.2
    },
    "soilDepthCm": 100.0
  },
  "GUY": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Guyana",
    "soc": {
      "1990": 94.16,
      "2000": 94.16,
      "2010": 94.16,
      "2015": 94.16,
      "2020": 94.16,
      "2025": 94.16
    },
    "soilDepthCm": 30.0
  },
  "HTI": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Haiti",
    "soc": {
      "1990": 110.0,
      "2000": 111.0,
      "2010": 111.0,
      "2015": 111.0,
      "2020": 110.0,
      "2025": 110.0
    },
    "soilDepthCm": 30.0
  },
  "IND": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "India",
    "soc": {
      "1990": 58.7,
      "2000": 56.9,
      "2010": 56.9,
      "2015": 56.2,
      "2020": 56.17,
      "2025": 56.09
    },
    "soilDepthCm": 30.0
  },
  "IRL": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Ireland",
    "soc": {
      "1990": 343.3,
      "2000": 337.6,
      "2010": 330.46,
      "2015": 326.45,
      "2020": 317.67,
      "2025": 313.32
    },
    "soilDepthCm": 100.0
  },
  "ISL": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Iceland",
    "soc": {
      "1990": 84.73,
      "2000": 84.73,
      "2010": 84.73,
      "2015": 84.73,
      "2020": 84.73,
      "2025": 84.73
    },
    "soilDepthCm": 30.0
  },
  "ISR": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Israel",
    "soc": {
      "1990": 0.95,
      "2000": 0.9,
      "2010": 0.9,
      "2015": 0.9
    },
    "soilDepthCm": 30.0
  },
  "ITA": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Italy",
    "soc": {
      "1990": 81.7,
      "2000": 81.7,
      "2010": 81.7,
      "2015": 81.7,
      "2020": 81.7,
      "2025": 83.5
    },
    "soilDepthCm": 30.0
  },
  "KEN": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Kenya",
    "soc": {
      "1990": 65.0,
      "2000": 65.0,
      "2010": 65.0,
      "2015": 65.0,
      "2020": 65.0
    },
    "soilDepthCm": 30.0
  },
  "KOR": {
    "calculatedYears": [
      "2020"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Republic of Korea",
    "soc": {
      "2020": 44.46
    },
    "soilDepthCm": 30.0
  },
  "LBN": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Lebanon",
    "soilDepthCm": 30.0
  },
  "LTU": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Lithuania",
    "soc": {
      "1990": 72.0,
      "2000": 72.0,
      "2010": 72.0,
      "2015": 72.0,
      "2020": 72.0,
      "2025": 72.0
    },
    "soilDepthCm": 30.0
  },
  "LVA": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Latvia",
    "soc": {
      "1990": 181.7,
      "2000": 176.99,
      "2010": 168.77,
      "2015": 168.17,
      "2020": 168.5,
      "2025": 168.48
    },
    "soilDepthCm": 30.0
  },
  "MAR": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Morocco",
    "soc": {
      "1990": 27.91,
      "2000": 27.88,
      "2010": 28.14,
      "2015": 28.18,
      "2020": 28.34,
      "2025": 28.01
    },
    "soilDepthCm": 30.0
  },
  "MCO": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Monaco",
    "soc": {
      "1990": 0.0,
      "2000": 0.0,
      "2010": 0.0,
      "2015": 0.0,
      "2020": 0.0
    }
  },
  "MDA": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Republic of Moldova",
    "soc": {
      "1990": 61.83,
      "2000": 61.83,
      "2010": 61.83,
      "2015": 61.83,
      "2020": 61.83,
      "2025": 66.83
    },
    "soilDepthCm": 30.0
  },
  "MDG": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Madagascar",
    "soc": {
      "1990": 55.7,
      "2000": 55.7,
      "2010": 55.7,
      "2015": 55.7,
      "2020": 55.7,
      "2025": 55.7
    },
    "soilDepthCm": 30.0
  },
  "MEX": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Mexico",
    "soc": {
      "1990": 44.16,
      "2000": 44.16,
      "2010": 44.16,
      "2015": 44.16,
      "2020": 44.16,
      "2025": 44.16
    },
    "soilDepthCm": 30.0
  },
  "MLI": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Mali",
    "soc": {
      "1990": 35.0,
      "2000": 35.0,
      "2010": 35.0,
      "2015": 35.0,
      "2020": 35.0
    },
    "soilDepthCm": 30.0
  },
  "MNG": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Mongolia",
    "soc": {
      "1990": 83.9,
      "2000": 83.9,
      "2010": 83.9,
      "2015": 83.9,
      "2020": 83.9,
      "2025": 83.9
    },
    "soilDepthCm": 30.0
  },
  "MTQ": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Martinique",
    "soc": {
      "1990": 69.0,
      "2000": 69.0,
      "2010": 69.0,
      "2015": 69.0,
      "2020": 69.0,
      "2025": 69.0
    },
    "soilDepthCm": 30.0
  },
  "MUS": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Mauritius",
    "soc": {
      "1990": 70.0,
      "2000": 70.0,
      "2010": 70.0,
      "2015": 70.0,
      "2020": 70.0,
      "2025": 70.0
    },
    "soilDepthCm": 30.0
  },
  "MWI": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Malawi",
    "soc": {
      "1990": 56.1,
      "2000": 56.1,
      "2010": 56.1,
      "2015": 56.1,
      "2020": 56.1,
      "2025": 56.1
    },
    "soilDepthCm": 30.0
  },
  "MYT": {
    "calculatedYears": [
      "2010"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Mayotte",
    "soc": {
      "1990": 93.18,
      "2000": 93.18,
      "2010": 93.18,
      "2015": 93.18,
      "2020": 93.18,
      "2025": 93.18
    },
    "soilDepthCm": 30.0
  },
  "NCL": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "New Caledonia",
    "soc": {
      "1990": 78.0,
      "2000": 78.0,
      "2010": 78.0,
      "2015": 78.0,
      "2020": 78.0,
      "2025": 78.0
    },
    "soilDepthCm": 100.0
  },
  "NLD": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Netherlands (Kingdom of the)",
    "soc": {
      "1990": 96.0,
      "2000": 96.0,
      "2010": 96.0,
      "2015": 96.0,
      "2020": 96.0,
      "2025": 96.0
    },
    "soilDepthCm": 30.0
  },
  "NOR": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Norway",
    "soc": {
      "1990": 152.5
    },
    "soilDepthCm": 100.0
  },
  "NPL": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Nepal",
    "soc": {
      "1990": 66.88,
      "2000": 66.88,
      "2010": 66.88,
      "2015": 66.88,
      "2020": 66.88
    }
  },
  "NRU": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Naoero",
    "soc": {
      "1990": 0.0,
      "2000": 0.0,
      "2010": 0.0,
      "2015": 0.0,
      "2020": 0.0
    }
  },
  "NZL": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "New Zealand",
    "soc": {
      "1990": 94.44,
      "2000": 94.68,
      "2010": 94.64,
      "2015": 94.58,
      "2020": 94.02,
      "2025": 94.21
    },
    "soilDepthCm": 30.0
  },
  "PAK": {
    "calculatedYears": [
      "2020"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Pakistan",
    "soc": {
      "1990": 55.01,
      "2000": 55.01,
      "2010": 55.01,
      "2015": 55.01,
      "2020": 55.01,
      "2025": 55.01
    },
    "soilDepthCm": 30.0
  },
  "PAN": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Panama",
    "soc": {
      "1990": 65.8,
      "2000": 65.8,
      "2010": 65.8,
      "2015": 65.8,
      "2020": 65.8,
      "2025": 65.8
    },
    "soilDepthCm": 30.0
  },
  "POL": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Poland",
    "soc": {
      "2010": 88.0
    },
    "soilDepthCm": 40.0
  },
  "PRY": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Paraguay",
    "soc": {
      "1990": 55.25,
      "2000": 55.25,
      "2010": 55.25,
      "2015": 55.25,
      "2020": 55.25,
      "2025": 55.25
    },
    "soilDepthCm": 50.0
  },
  "QAT": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Qatar",
    "soc": {
      "1990": 0.0,
      "2000": 0.0,
      "2010": 0.0,
      "2015": 0.0,
      "2020": 0.0
    }
  },
  "REU": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "R\u00e9union",
    "soc": {
      "1990": 17.1,
      "2000": 17.1,
      "2010": 17.1,
      "2015": 17.1,
      "2020": 17.1,
      "2025": 17.1
    },
    "soilDepthCm": 30.0
  },
  "ROU": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Romania",
    "soc": {
      "1990": 90.81,
      "2000": 90.81,
      "2010": 90.81,
      "2015": 90.81,
      "2020": 90.81,
      "2025": 90.81
    },
    "soilDepthCm": 30.0
  },
  "RUS": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Russian Federation",
    "soc": {
      "1990": 91.41,
      "2000": 91.68,
      "2010": 91.84,
      "2015": 91.95,
      "2020": 92.04,
      "2025": 92.07
    },
    "soilDepthCm": 30.0
  },
  "RWA": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Rwanda",
    "soc": {
      "1990": 47.0,
      "2000": 47.0,
      "2010": 47.0,
      "2015": 47.0,
      "2020": 47.0
    },
    "soilDepthCm": 30.0
  },
  "SAU": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Saudi Arabia",
    "soc": {
      "1990": 34.21,
      "2000": 34.21,
      "2010": 34.21,
      "2015": 34.21,
      "2020": 34.21
    },
    "soilDepthCm": 30.0
  },
  "SGP": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Singapore",
    "soc": {
      "1990": 74.86,
      "2000": 74.65,
      "2010": 74.41,
      "2015": 74.67,
      "2020": 74.68,
      "2025": 74.68
    },
    "soilDepthCm": 50.0
  },
  "SJM": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Svalbard and Jan Mayen Islands",
    "soc": {
      "1990": 0.0,
      "2000": 0.0,
      "2010": 0.0,
      "2015": 0.0,
      "2020": 0.0
    }
  },
  "SLV": {
    "cycle": "2025",
    "deskStudy": true,
    "name": "El Salvador",
    "soc": {
      "1990": 188.58,
      "2000": 188.58,
      "2010": 188.58,
      "2015": 188.58,
      "2020": 188.58,
      "2025": 188.58
    },
    "soilDepthCm": 20.0
  },
  "SRB": {
    "cycle": "2020",
    "deskStudy": false,
    "name": "Serbia",
    "soc": {
      "1990": 247.0,
      "2000": 283.2,
      "2010": 284.72,
      "2015": 306.62,
      "2020": 306.62
    },
    "soilDepthCm": 20.0
  },
  "SVK": {
    "calculatedYears": [
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Slovakia",
    "soc": {
      "1990": 142.18,
      "2000": 142.26,
      "2010": 141.04,
      "2015": 140.76,
      "2020": 140.45,
      "2025": 139.4
    },
    "soilDepthCm": 100.0
  },
  "SVN": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Slovenia",
    "soc": {
      "1990": 98.5,
      "2000": 98.5,
      "2010": 98.5,
      "2015": 98.5,
      "2020": 98.5,
      "2025": 98.5
    },
    "soilDepthCm": 50.0
  },
  "SWE": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "Sweden",
    "soc": {
      "1990": 67.88,
      "2000": 68.14,
      "2010": 71.6,
      "2015": 73.2,
      "2020": 73.75,
      "2025": 73.75
    },
    "soilDepthCm": 50.0
  },
  "TCD": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Chad",
    "soc": {
      "1990": 38.0,
      "2000": 38.0,
      "2010": 38.0,
      "2015": 38.0,
      "2020": 38.0,
      "2025": 38.0
    },
    "soilDepthCm": 30.0
  },
  "TKL": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Tokelau",
    "soc": {
      "1990": 0.0,
      "2000": 0.0,
      "2010": 0.0,
      "2015": 0.0,
      "2020": 0.0
    }
  },
  "TKM": {
    "calculatedYears": [
      "1990",
      "2000",
      "2010",
      "2015",
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": true,
    "name": "Turkmenistan",
    "soc": {
      "1990": 33.73,
      "2000": 33.73,
      "2010": 33.73,
      "2015": 33.73,
      "2020": 33.73,
      "2025": 33.73
    },
    "soilDepthCm": 30.0
  },
  "TUR": {
    "calculatedYears": [
      "2020",
      "2025"
    ],
    "cycle": "2025",
    "deskStudy": false,
    "name": "T\u00fcrkiye",
    "soc": {
      "1990": 43.53,
      "2000": 46.15,
      "2010": 46.46,
      "2015": 48.91,
      "2020": 51.46,
      "2025": 50.52
    },
    "soilDepthCm": 30.0
  },
  "UKR": {
    "cycle": "2025",
    "deskStudy": true,
    "name": "Ukraine",
    "soc": {
      "1990": 24.99,
      "2000": 25.01,
      "2010": 25.07
    }
  },
  "USA": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "United States of America",
    "soc": {
      "1990": 121.3,
      "2000": 121.4,
      "2010": 121.8,
      "2015": 121.9,
      "2020": 122.0,
      "2025": 122.1
    },
    "soilDepthCm": 100.0
  },
  "VAT": {
    "cycle": "2020",
    "deskStudy": true,
    "name": "Holy See",
    "soc": {
      "1990": 0.0,
      "2000": 0.0,
      "2010": 0.0,
      "2015": 0.0,
      "2020": 0.0
    }
  },
  "WLF": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Wallis and Futuna Islands",
    "soc": {
      "1990": 51.1,
      "2000": 51.18,
      "2010": 51.19,
      "2015": 51.17,
      "2020": 51.15,
      "2025": 51.13
    },
    "soilDepthCm": 100.0
  },
  "YEM": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Yemen",
    "soc": {
      "1990": 35.01,
      "2000": 35.01,
      "2010": 35.01,
      "2015": 35.01,
      "2020": 35.01,
      "2025": 35.01
    },
    "soilDepthCm": 30.0
  },
  "ZMB": {
    "cycle": "2025",
    "deskStudy": false,
    "name": "Zambia",
    "soc": {
      "1990": 36.7,
      "2000": 36.7,
      "2010": 36.7,
      "2015": 36.7,
      "2020": 36.7,
      "2025": 36.7
    },
    "soilDepthCm": 30.0
  }
};

// Case-insensitive name -> ISO3 index, built once.
var NAME_INDEX = {};
Object.keys(DATA).forEach(function (iso) {
  NAME_INDEX[DATA[iso].name.toLowerCase()] = iso;
});

var YEARS = ['1990', '2000', '2010', '2015', '2020', '2025'];

/**
 * Resolve an ISO3 code or a country name (as FRA spells it) to a DATA entry.
 * Returns null when unknown.
 */
function resolve(iso3OrName) {
  if (!iso3OrName) return null;
  var key = String(iso3OrName).trim();
  if (DATA[key.toUpperCase()]) return DATA[key.toUpperCase()];
  var iso = NAME_INDEX[key.toLowerCase()];
  return iso ? DATA[iso] : null;
}

/**
 * Short human-readable summary of the FRA-reported soil carbon for a country.
 * year is optional: omitted, the most recent reported year is used.
 * Returns e.g. "FRA-reported soil carbon (2020): 143.0 t/ha at 0-30 cm", or null
 * when the country has no reported soil carbon (for that year).
 */
function formatFRASoc(iso3OrName, year) {
  var entry = resolve(iso3OrName);
  if (!entry || !entry.soc) return null;

  var y = null;
  if (year !== undefined && year !== null) {
    y = String(year);
    if (entry.soc[y] === undefined) return null;
  } else {
    for (var i = YEARS.length - 1; i >= 0; i--) {
      if (entry.soc[YEARS[i]] !== undefined) { y = YEARS[i]; break; }
    }
  }
  if (y === null) return null;

  var s = 'FRA-reported soil carbon (' + y + '): ' + entry.soc[y].toFixed(1) + ' t/ha';
  if (entry.soilDepthCm) s += ' at 0-' + Math.round(entry.soilDepthCm) + ' cm';
  if (entry.deskStudy) s += ' (FAO desk study)';
  return s;
}

var VERSION = {
  cycle: 'FRA 2025, FRA 2020 fallback where entry.cycle says so',
  retrieved: '2026-09-22',
  endpoint: 'fra-data.fao.org/api/cycle-data/table/table-data'
};

var CITATION = 'FAO. 2026. FRA Platform, accessed 2026-09-22. ' +
               'https://fra-data.fao.org. Licence: CC-BY-4.0.';

/**
 * Reported soil carbon for one year.
 * @param {string} iso3OrName
 * @param {number|string} year
 * @return {Object|null} {value, depthCm, deskStudy, cycle}, or null when the
 *     country has no figure for that year.
 */
function getSoc(iso3OrName, year) {
  var e = resolve(iso3OrName);
  if (!e || !e.soc) return null;
  var v = e.soc[String(year)];
  if (v === undefined || v === null) return null;
  return {value: v, depthCm: e.soilDepthCm || null,
          deskStudy: !!e.deskStudy, cycle: e.cycle};
}

/**
 * True when the soil-carbon table has a row for this country. NB the table
 * holds value-holders only: a non-reporter can be absent here and still file
 * FRA reports, so callers combine this with fraStats forest-area presence.
 * @param {string} iso3OrName
 * @return {boolean}
 */
function hasReport(iso3OrName) {
  return resolve(iso3OrName) !== null;
}

/**
 * True when the country has at least one reported soil carbon value in any
 * year. Some rows carry only the depth field (BDI, DJI, LBN) -- those return
 * false. Use this for "has a figure" tests; hasReport only proves a row.
 * @param {string} iso3OrName
 * @return {boolean}
 */
function hasValue(iso3OrName) {
  var e = resolve(iso3OrName);
  if (!e || !e.soc) return false;
  for (var i = 0; i < YEARS.length; i++) {
    if (e.soc[YEARS[i]] !== undefined && e.soc[YEARS[i]] !== null) return true;
  }
  return false;
}

/**
 * True when this country's FRA report is an FAO desk study -- the figures were
 * compiled by FAO, not reported by the country. Combine with hasValue to split
 * value-holders into country-reported vs gap-filled.
 * @param {string} iso3OrName
 * @return {boolean}
 */
function isDeskStudy(iso3OrName) {
  var e = resolve(iso3OrName);
  return e ? !!e.deskStudy : false;
}

/**
 * The most recent reported soil carbon value, for countries whose series stops
 * before the comparison year (Ukraine ends 2010, Austria 2010, Israel 2015).
 * @param {string} iso3OrName
 * @return {Object|null} getSoc's shape plus {year}, or null with no value at all
 */
function getLatestSoc(iso3OrName) {
  for (var i = YEARS.length - 1; i >= 0; i--) {
    var s = getSoc(iso3OrName, YEARS[i]);
    if (s) { s.year = YEARS[i]; return s; }
  }
  return null;
}

exports.DATA = DATA;
exports.formatFRASoc = formatFRASoc;
exports.getSoc = getSoc;
exports.hasReport = hasReport;
exports.hasValue = hasValue;
exports.isDeskStudy = isDeskStudy;
exports.getLatestSoc = getLatestSoc;
exports.VERSION = VERSION;
exports.CITATION = CITATION;
