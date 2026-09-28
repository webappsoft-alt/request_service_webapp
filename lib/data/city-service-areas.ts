/**
 * City + area neighborhoods for Pro Service Areas.
 * Area labels are neighborhood names. No frontend IDs.
 */

export type CityServiceAreaNeighborhood = {
  name: string;
  lat: number;
  lng: number;
  zip?: string;
};

export type CityServiceAreaCity = {
  city: string;
  state: string;
  areas: CityServiceAreaNeighborhood[];
};

export const CITY_SERVICE_AREAS: CityServiceAreaCity[] = [
  {
    city: "New York",
    state: "NY",
    areas: [
      { name: "Manhattan", lat: 40.7831, lng: -73.9712 },
      { name: "Brooklyn", lat: 40.6782, lng: -73.9442 },
      { name: "Queens", lat: 40.7282, lng: -73.7949 },
      { name: "Bronx", lat: 40.8448, lng: -73.8648 },
      { name: "Staten Island", lat: 40.5795, lng: -74.1502 },
      { name: "Times Square", lat: 40.758, lng: -73.9855 },
      { name: "Harlem", lat: 40.8116, lng: -73.9465 },
    ],
  },
  {
    city: "Los Angeles",
    state: "CA",
    areas: [
      { name: "Downtown LA", lat: 34.0407, lng: -118.2468 },
      { name: "Hollywood", lat: 34.0928, lng: -118.3287 },
      { name: "Venice", lat: 33.985, lng: -118.4695 },
      { name: "Koreatown", lat: 34.0577, lng: -118.3009 },
      { name: "Westwood", lat: 34.0633, lng: -118.4456 },
      { name: "San Pedro", lat: 33.7358, lng: -118.2923 },
      { name: "Sherman Oaks", lat: 34.1508, lng: -118.4489 },
    ],
  },
  {
    city: "Chicago",
    state: "IL",
    areas: [
      { name: "The Loop", lat: 41.8819, lng: -87.6278 },
      { name: "Lincoln Park", lat: 41.9214, lng: -87.6513 },
      { name: "Wicker Park", lat: 41.9088, lng: -87.6796 },
      { name: "Hyde Park", lat: 41.7943, lng: -87.5907 },
      { name: "Lakeview", lat: 41.9436, lng: -87.6536 },
      { name: "Pilsen", lat: 41.8525, lng: -87.6614 },
      { name: "O'Hare", lat: 41.9742, lng: -87.9073 },
    ],
  },
  {
    city: "Houston",
    state: "TX",
    areas: [
      { name: "Downtown", lat: 29.7604, lng: -95.3698 },
      { name: "Galleria", lat: 29.7387, lng: -95.4618 },
      { name: "Montrose", lat: 29.7452, lng: -95.39 },
      { name: "The Heights", lat: 29.7986, lng: -95.398 },
      { name: "Midtown", lat: 29.74, lng: -95.38 },
      { name: "Memorial", lat: 29.7663, lng: -95.539 },
    ],
  },
  {
    city: "Phoenix",
    state: "AZ",
    areas: [
      { name: "Downtown", lat: 33.4484, lng: -112.074 },
      { name: "Arcadia", lat: 33.5029, lng: -111.9946 },
      { name: "Ahwatukee", lat: 33.3253, lng: -111.984 },
      { name: "Deer Valley", lat: 33.68, lng: -112.1 },
      { name: "Sky Harbor Airport", lat: 33.4342, lng: -112.0116 },
    ],
  },
  {
    city: "Philadelphia",
    state: "PA",
    areas: [
      { name: "Center City", lat: 39.9526, lng: -75.1652 },
      { name: "South Philadelphia", lat: 39.919, lng: -75.17 },
      { name: "Northern Liberties", lat: 39.966, lng: -75.14 },
      { name: "University City", lat: 39.9522, lng: -75.1932 },
      { name: "Old City", lat: 39.95, lng: -75.145 },
      { name: "Germantown", lat: 40.035, lng: -75.174 },
    ],
  },
  {
    city: "San Antonio",
    state: "TX",
    areas: [
      { name: "Downtown", lat: 29.4241, lng: -98.4936 },
      { name: "Alamo Heights", lat: 29.486, lng: -98.466 },
      { name: "Stone Oak", lat: 29.63, lng: -98.49 },
      { name: "Southtown", lat: 29.411, lng: -98.498 },
      { name: "Medical Center", lat: 29.506, lng: -98.575 },
    ],
  },
  {
    city: "San Diego",
    state: "CA",
    areas: [
      { name: "Downtown", lat: 32.7157, lng: -117.1611 },
      { name: "La Jolla", lat: 32.8328, lng: -117.2713 },
      { name: "Pacific Beach", lat: 32.797, lng: -117.255 },
      { name: "Gaslamp Quarter", lat: 32.711, lng: -117.1594 },
      { name: "Balboa Park", lat: 32.7341, lng: -117.1446 },
      { name: "Hillcrest", lat: 32.748, lng: -117.162 },
    ],
  },
  {
    city: "Dallas",
    state: "TX",
    areas: [
      { name: "Downtown", lat: 32.7767, lng: -96.797 },
      { name: "Uptown", lat: 32.8, lng: -96.803 },
      { name: "Deep Ellum", lat: 32.784, lng: -96.783 },
      { name: "Oak Lawn", lat: 32.81, lng: -96.81 },
      { name: "Bishop Arts District", lat: 32.749, lng: -96.829 },
      { name: "Preston Hollow", lat: 32.86, lng: -96.8 },
    ],
  },
  {
    city: "Jacksonville",
    state: "FL",
    areas: [
      { name: "Downtown", lat: 30.3322, lng: -81.6557 },
      { name: "Riverside", lat: 30.317, lng: -81.68 },
      { name: "San Marco", lat: 30.307, lng: -81.649 },
      { name: "Jacksonville Beach", lat: 30.2947, lng: -81.3931 },
      { name: "Southside", lat: 30.25, lng: -81.58 },
    ],
  },
  {
    city: "Fort Worth",
    state: "TX",
    areas: [
      { name: "Sundance Square", lat: 32.7589, lng: -97.328, zip: "76102" },
      { name: "Arlington Heights", lat: 32.7392, lng: -97.3852, zip: "76107" },
      { name: "Ryanwood", lat: 32.7493, lng: -97.2181, zip: "76112" },
      { name: "Glen Park", lat: 32.6914, lng: -97.2675, zip: "76119" },
      { name: "Hamlet", lat: 32.6192, lng: -97.2735, zip: "76140" },
    ],
  },
  {
    city: "San Jose",
    state: "CA",
    areas: [
      { name: "Downtown", lat: 37.3382, lng: -121.8863 },
      { name: "Willow Glen", lat: 37.3016, lng: -121.9 },
      { name: "Santana Row", lat: 37.321, lng: -121.948 },
      { name: "Evergreen", lat: 37.305, lng: -121.79 },
      { name: "North San Jose", lat: 37.39, lng: -121.94 },
    ],
  },
  {
    city: "Austin",
    state: "TX",
    areas: [
      { name: "Downtown", lat: 30.2672, lng: -97.7431 },
      { name: "South Congress", lat: 30.25, lng: -97.75 },
      { name: "East Austin", lat: 30.263, lng: -97.715 },
      { name: "Zilker", lat: 30.266, lng: -97.773 },
      { name: "The Domain", lat: 30.402, lng: -97.725 },
      { name: "Hyde Park", lat: 30.305, lng: -97.728 },
    ],
  },
  {
    city: "Columbus",
    state: "OH",
    areas: [
      { name: "Colburn", lat: 40.0999, lng: -83.0157, zip: "43085" },
      { name: "Near East Side", lat: 39.9569, lng: -82.9644, zip: "43205" },
      { name: "South Linden", lat: 40.0118, lng: -82.9732, zip: "43211" },
      { name: "South Columbus", lat: 39.8277, lng: -82.9342, zip: "43217" },
      { name: "Southwest Columbus", lat: 39.9388, lng: -83.0463, zip: "43223" },
      { name: "The Crossing at McKenna Creek", lat: 40.0347, lng: -82.8726, zip: "43230" },
    ],
  },
  {
    city: "Charlotte",
    state: "NC",
    areas: [
      { name: "Charlotte center city", lat: 35.229, lng: -80.8419, zip: "28202" },
      { name: "Myers Park", lat: 35.1935, lng: -80.8272, zip: "28207" },
      { name: "Newell South", lat: 35.2836, lng: -80.7638, zip: "28213" },
      { name: "Olde Providence South", lat: 35.0869, lng: -80.8167, zip: "28226" },
      { name: "Nevin Community", lat: 35.2886, lng: -80.8209, zip: "28269" },
    ],
  },
  {
    city: "Indianapolis",
    state: "IN",
    areas: [
      { name: "Near Eastside", lat: 39.775, lng: -86.1093, zip: "46201" },
      { name: "Chapel Hill / Ben Davis", lat: 39.7924, lng: -86.2875, zip: "46214" },
      { name: "West Indianapolis", lat: 39.7509, lng: -86.1924, zip: "46221" },
      { name: "East Warren", lat: 39.7886, lng: -85.9779, zip: "46229" },
      { name: "Southeast Warren", lat: 39.7265, lng: -86.0005, zip: "46239" },
      { name: "South Franklin", lat: 39.667, lng: -85.9981, zip: "46259" },
    ],
  },
  {
    city: "San Francisco",
    state: "CA",
    areas: [
      { name: "Financial District", lat: 37.7946, lng: -122.3999 },
      { name: "Mission District", lat: 37.7599, lng: -122.4148 },
      { name: "Haight-Ashbury", lat: 37.7692, lng: -122.4481 },
      { name: "Chinatown", lat: 37.7941, lng: -122.4078 },
      { name: "SoMa", lat: 37.7785, lng: -122.4056 },
      { name: "Sunset District", lat: 37.753, lng: -122.494 },
      { name: "Fisherman's Wharf", lat: 37.808, lng: -122.4177 },
    ],
  },
  {
    city: "Seattle",
    state: "WA",
    areas: [
      { name: "Downtown", lat: 47.6062, lng: -122.3321 },
      { name: "Capitol Hill", lat: 47.6253, lng: -122.3222 },
      { name: "Ballard", lat: 47.6685, lng: -122.384 },
      { name: "Fremont", lat: 47.651, lng: -122.35 },
      { name: "Queen Anne", lat: 47.637, lng: -122.357 },
      { name: "University District", lat: 47.6588, lng: -122.3138 },
    ],
  },
  {
    city: "Denver",
    state: "CO",
    areas: [
      { name: "Downtown", lat: 39.7392, lng: -104.9903 },
      { name: "LoDo", lat: 39.753, lng: -104.999 },
      { name: "Capitol Hill", lat: 39.73, lng: -104.98 },
      { name: "Cherry Creek", lat: 39.718, lng: -104.953 },
      { name: "RiNo", lat: 39.769, lng: -104.98 },
      { name: "Highlands", lat: 39.76, lng: -105.01 },
    ],
  },
  {
    city: "Washington",
    state: "DC",
    areas: [
      { name: "Downtown", lat: 38.9072, lng: -77.0369 },
      { name: "Georgetown", lat: 38.9076, lng: -77.0723 },
      { name: "Capitol Hill", lat: 38.8899, lng: -76.996 },
      { name: "Dupont Circle", lat: 38.9096, lng: -77.0434 },
      { name: "Adams Morgan", lat: 38.9214, lng: -77.0425 },
      { name: "Foggy Bottom", lat: 38.9007, lng: -77.0508 },
    ],
  },
  {
    city: "Nashville",
    state: "TN",
    areas: [
      { name: "Downtown", lat: 36.1627, lng: -86.7816 },
      { name: "East Nashville", lat: 36.18, lng: -86.75 },
      { name: "The Gulch", lat: 36.152, lng: -86.789 },
      { name: "Germantown", lat: 36.177, lng: -86.792 },
      { name: "12 South", lat: 36.124, lng: -86.79 },
    ],
  },
  {
    city: "Oklahoma City",
    state: "OK",
    areas: [
      { name: "Central Oklahoma City", lat: 35.4726, lng: -97.5199, zip: "73102" },
      { name: "Uptown Oklahoma City", lat: 35.5136, lng: -97.5319, zip: "73118" },
      { name: "Fox Run", lat: 35.599, lng: -97.6251, zip: "73142" },
      { name: "Northeast Oklahoma City", lat: 35.5514, lng: -97.4075, zip: "73163" },
    ],
  },
  {
    city: "El Paso",
    state: "TX",
    areas: [
      { name: "El Segundo Barrio", lat: 31.7584, lng: -106.4783, zip: "79901" },
      { name: "Sunrise Acres East", lat: 31.8533, lng: -106.4381, zip: "79904" },
      { name: "Mission Valley", lat: 31.7432, lng: -106.3686, zip: "79915" },
      { name: "Northeast El Paso", lat: 31.9386, lng: -106.4073, zip: "79934" },
    ],
  },
  {
    city: "Boston",
    state: "MA",
    areas: [
      { name: "Back Bay", lat: 42.3503, lng: -71.081 },
      { name: "Beacon Hill", lat: 42.3588, lng: -71.0707 },
      { name: "North End", lat: 42.3647, lng: -71.0542 },
      { name: "South Boston", lat: 42.3381, lng: -71.0476 },
      { name: "Fenway", lat: 42.3467, lng: -71.0972 },
      { name: "Jamaica Plain", lat: 42.3097, lng: -71.1151 },
    ],
  },
  {
    city: "Portland",
    state: "OR",
    areas: [
      { name: "Downtown", lat: 45.5152, lng: -122.6784 },
      { name: "Pearl District", lat: 45.527, lng: -122.683 },
      { name: "Alberta Arts District", lat: 45.559, lng: -122.645 },
      { name: "Hawthorne", lat: 45.512, lng: -122.628 },
      { name: "St. Johns", lat: 45.594, lng: -122.758 },
    ],
  },
  {
    city: "Detroit",
    state: "MI",
    areas: [
      { name: "Cass Corridor", lat: 42.3474, lng: -83.0604, zip: "48201" },
      { name: "Boston-Edison Historic District", lat: 42.3749, lng: -83.1087, zip: "48206" },
      { name: "Poletown East", lat: 42.3809, lng: -83.0409, zip: "48211" },
      { name: "Boynton", lat: 42.2719, lng: -83.1545, zip: "48217" },
      { name: "Morningside", lat: 42.4098, lng: -82.9441, zip: "48224" },
      { name: "Farwell", lat: 42.4337, lng: -83.0434, zip: "48234" },
    ],
  },
  {
    city: "Las Vegas",
    state: "NV",
    areas: [
      { name: "The Strip", lat: 36.1147, lng: -115.1728 },
      { name: "Downtown", lat: 36.1699, lng: -115.1398 },
      { name: "Summerlin", lat: 36.15, lng: -115.33 },
      { name: "Spring Valley", lat: 36.108, lng: -115.245 },
      { name: "Paradise", lat: 36.097, lng: -115.146 },
    ],
  },
  {
    city: "Memphis",
    state: "TN",
    areas: [
      { name: "Downtown Memphis", lat: 35.144, lng: -90.048, zip: "38103" },
      { name: "Bethel Grove", lat: 35.0981, lng: -89.9825, zip: "38114" },
      { name: "Kirby Trace", lat: 35.0821, lng: -89.8501, zip: "38119" },
      { name: "Frayser", lat: 35.251, lng: -90.0296, zip: "38127" },
    ],
  },
  {
    city: "Louisville",
    state: "KY",
    areas: [
      { name: "Downtown", lat: 38.2507, lng: -85.7476, zip: "40202" },
      { name: "Portland", lat: 38.2651, lng: -85.8045, zip: "40212" },
      { name: "Highview", lat: 38.1442, lng: -85.6265, zip: "40228" },
      { name: "Lake Forest", lat: 38.2683, lng: -85.4845, zip: "40245" },
    ],
  },
  {
    city: "Baltimore",
    state: "MD",
    areas: [
      { name: "Seton Hill", lat: 39.2946, lng: -76.6252, zip: "21201" },
      { name: "Frankford", lat: 39.3365, lng: -76.5411, zip: "21206" },
      { name: "Rosebank", lat: 39.3626, lng: -76.61, zip: "21212" },
      { name: "Walbrook", lat: 39.3093, lng: -76.6699, zip: "21216" },
      { name: "Greektown", lat: 39.2876, lng: -76.5568, zip: "21224" },
      { name: "Stadium/Entertainment Area", lat: 39.2847, lng: -76.6205, zip: "21233" },
    ],
  },
  {
    city: "Albuquerque",
    state: "NM",
    areas: [
      { name: "Bosque Dell Acres", lat: 35.1996, lng: -106.6448, zip: "87101" },
      { name: "Vanderbilt", lat: 35.0448, lng: -106.6893, zip: "87105" },
      { name: "South San Pedro", lat: 35.0726, lng: -106.5749, zip: "87108" },
      { name: "Oso Grande", lat: 35.1347, lng: -106.5222, zip: "87111" },
      { name: "Paradise Hills Civic", lat: 35.1868, lng: -106.6652, zip: "87114" },
      { name: "Quaker Heights", lat: 35.1421, lng: -106.7041, zip: "87120" },
    ],
  },
  {
    city: "Milwaukee",
    state: "WI",
    areas: [
      { name: "Lower East Side", lat: 43.0506, lng: -87.8968, zip: "53202" },
      { name: "North Division", lat: 43.0753, lng: -87.9347, zip: "53206" },
      { name: "Cambridge Heights", lat: 43.082, lng: -87.8895, zip: "53211" },
      { name: "Grasslyn Manor", lat: 43.0859, lng: -87.9742, zip: "53216" },
      { name: "Timmerman Airport", lat: 43.1154, lng: -88.0346, zip: "53225" },
    ],
  },
  {
    city: "Tucson",
    state: "AZ",
    areas: [
      { name: "Armory Park", lat: 32.2139, lng: -110.9694, zip: "85701" },
      { name: "Kendall Square", lat: 32.2138, lng: -110.824, zip: "85710" },
      { name: "Woodland Hills", lat: 32.2519, lng: -110.82, zip: "85715" },
      { name: "Eastside", lat: 32.215, lng: -110.7758, zip: "85748" },
    ],
  },
  {
    city: "Fresno",
    state: "CA",
    areas: [
      { name: "Pinedale", lat: 36.8411, lng: -119.801, zip: "93650" },
      { name: "McLane", lat: 36.7684, lng: -119.7594, zip: "93703" },
      { name: "Roosevelt", lat: 36.7528, lng: -119.7061, zip: "93727" },
    ],
  },
  {
    city: "Sacramento",
    state: "CA",
    areas: [
      { name: "Downtown", lat: 38.5762, lng: -121.488, zip: "95811" },
      { name: "Oak Park", lat: 38.5498, lng: -121.4583, zip: "95817" },
      { name: "Airport", lat: 38.5091, lng: -121.4935, zip: "95822" },
      { name: "Bradshaw Woods", lat: 38.5662, lng: -121.3286, zip: "95827" },
      { name: "Southwestern Sacramento", lat: 38.4695, lng: -121.4883, zip: "95832" },
    ],
  },
  {
    city: "Atlanta",
    state: "GA",
    areas: [
      { name: "Downtown", lat: 33.749, lng: -84.388 },
      { name: "Midtown", lat: 33.7838, lng: -84.383 },
      { name: "Buckhead", lat: 33.838, lng: -84.379 },
      { name: "Old Fourth Ward", lat: 33.762, lng: -84.365 },
      { name: "West End", lat: 33.736, lng: -84.415 },
    ],
  },
  {
    city: "Miami",
    state: "FL",
    areas: [
      { name: "Downtown", lat: 25.7743, lng: -80.1937 },
      { name: "South Beach", lat: 25.7826, lng: -80.1341 },
      { name: "Wynwood", lat: 25.801, lng: -80.199 },
      { name: "Brickell", lat: 25.7617, lng: -80.1918 },
      { name: "Coconut Grove", lat: 25.727, lng: -80.242 },
      { name: "Little Havana", lat: 25.765, lng: -80.219 },
    ],
  },
  {
    city: "Omaha",
    state: "NE",
    areas: [
      { name: "Downtown", lat: 41.259, lng: -95.9409, zip: "68102" },
      { name: "Dahlman", lat: 41.2382, lng: -95.9336, zip: "68108" },
      { name: "Mockingbird Hills", lat: 41.2074, lng: -96.0612, zip: "68127" },
      { name: "Millard", lat: 41.2104, lng: -96.1698, zip: "68135" },
      { name: "West Omaha", lat: 41.2335, lng: -96.1188, zip: "68144" },
    ],
  },
  {
    city: "Raleigh",
    state: "NC",
    areas: [
      { name: "Downtown", lat: 35.7727, lng: -78.6324, zip: "27601" },
      { name: "Northeast Raleigh", lat: 35.8334, lng: -78.5799, zip: "27604" },
      { name: "North Hills", lat: 35.8014, lng: -78.6877, zip: "27607" },
      { name: "Lakemont", lat: 35.848, lng: -78.6317, zip: "27609" },
      { name: "Northwest Raleigh", lat: 35.8949, lng: -78.7051, zip: "27613" },
      { name: "Summerfield North", lat: 35.8887, lng: -78.6393, zip: "27615" },
    ],
  },
  {
    city: "Kansas City",
    state: "MO",
    areas: [
      { name: "Downtown Kansas City", lat: 39.1024, lng: -94.5986, zip: "64101" },
      { name: "Sunset Hill", lat: 39.0382, lng: -94.5929, zip: "64112" },
      { name: "Northeast Kansas City", lat: 39.1136, lng: -94.5235, zip: "64123" },
      { name: "South Kansas City", lat: 38.9911, lng: -94.5522, zip: "64132" },
      { name: "Mission Lake", lat: 38.8973, lng: -94.5764, zip: "64146" },
    ],
  },
  {
    city: "Long Beach",
    state: "CA",
    areas: [
      { name: "East Village", lat: 33.7706, lng: -118.182, zip: "90802" },
      { name: "Traffic Circle Area", lat: 33.7857, lng: -118.1357, zip: "90804" },
      { name: "Belmont Heights", lat: 33.7716, lng: -118.148, zip: "90814" },
    ],
  },
  {
    city: "Mesa",
    state: "AZ",
    areas: [
      { name: "Alta Mesa Community Association", lat: 33.4368, lng: -111.7129, zip: "85205" },
      { name: "Marbella Community Association", lat: 33.3782, lng: -111.6406, zip: "85209" },
      { name: "Eastmark", lat: 33.3425, lng: -111.6353, zip: "85212" },
    ],
  },
  {
    city: "Colorado Springs",
    state: "CO",
    areas: [
      { name: "Northeast Colorado Springs", lat: 38.876, lng: -104.817, zip: "80907" },
      { name: "Downtown", lat: 38.8339, lng: -104.8214, zip: "80912" },
    ],
  },
  {
    city: "Virginia Beach",
    state: "VA",
    areas: [
      { name: "North Virginia Beach", lat: 36.8585, lng: -76.0019, zip: "23451" },
      { name: "Northwest", lat: 36.8881, lng: -76.1446, zip: "23455" },
      { name: "Oceana Naval Air Station", lat: 36.808, lng: -76.0284, zip: "23460" },
    ],
  },
  {
    city: "Oakland",
    state: "CA",
    areas: [
      { name: "Harrington", lat: 37.7806, lng: -122.2166, zip: "94601" },
      { name: "North Stonehurst", lat: 37.7402, lng: -122.171, zip: "94603" },
      { name: "Oak Center", lat: 37.8071, lng: -122.2851, zip: "94607" },
      { name: "Lakeshore", lat: 37.8126, lng: -122.2443, zip: "94610" },
      { name: "Prescott", lat: 37.8067, lng: -122.3004, zip: "94615" },
      { name: "Upper Rockridge", lat: 37.8431, lng: -122.2402, zip: "94618" },
    ],
  },
  {
    city: "Tampa",
    state: "FL",
    areas: [
      { name: "Tampa Heights", lat: 27.9614, lng: -82.4597, zip: "33602" },
      { name: "Downtown", lat: 27.9475, lng: -82.4584, zip: "33606" },
      { name: "Sun Bay South", lat: 27.8914, lng: -82.5067, zip: "33611" },
      { name: "Virginia Park", lat: 27.921, lng: -82.5079, zip: "33629" },
    ],
  },
  {
    city: "Tulsa",
    state: "OK",
    areas: [
      { name: "Downtown", lat: 36.1539, lng: -95.9954, zip: "74103" },
      { name: "Maplewood", lat: 36.1754, lng: -95.9112, zip: "74115" },
      { name: "Suburban Hills", lat: 36.2383, lng: -95.9931, zip: "74126" },
      { name: "Timberlane Heights", lat: 36.0605, lng: -95.9452, zip: "74136" },
    ],
  },
  {
    city: "Minneapolis",
    state: "MN",
    areas: [
      { name: "Central Minneapolis", lat: 44.9835, lng: -93.2683, zip: "55401" },
      { name: "King Field", lat: 44.9264, lng: -93.2818, zip: "55409" },
      { name: "Northeast Minneapolis", lat: 45.0192, lng: -93.2401, zip: "55418" },
      { name: "Texa Tonka", lat: 44.955, lng: -93.3829, zip: "55426" },
    ],
  },
  {
    city: "Wichita",
    state: "KS",
    areas: [
      { name: "Linwood", lat: 37.6662, lng: -97.3165, zip: "67211" },
    ],
  },
  {
    city: "Arlington",
    state: "TX",
    areas: [
      { name: "Southwest Arlington", lat: 32.6289, lng: -97.1517, zip: "76001" },
      { name: "Carter Riverside", lat: 32.7714, lng: -97.2915, zip: "76005" },
      { name: "East Arlington", lat: 32.7204, lng: -97.0826, zip: "76010" },
      { name: "West Arlington", lat: 32.754, lng: -97.1348, zip: "76012" },
    ],
  },
  {
    city: "Bakersfield",
    state: "CA",
    areas: [
      { name: "Downtown", lat: 35.3866, lng: -119.0171, zip: "93301" },
      { name: "Campus Park", lat: 35.3039, lng: -119.1056, zip: "93311" },
    ],
  },
  {
    city: "Cleveland",
    state: "OH",
    areas: [
      { name: "Detroit - Shoreway", lat: 41.4735, lng: -81.7398, zip: "44102" },
      { name: "University Circle", lat: 41.5084, lng: -81.6076, zip: "44106" },
      { name: "North Collinwood", lat: 41.5882, lng: -81.5468, zip: "44119" },
    ],
  },
  {
    city: "New Orleans",
    state: "LA",
    areas: [
      { name: "Iberville", lat: 29.9605, lng: -90.0753, zip: "70112" },
      { name: "Seventh Ward", lat: 29.9686, lng: -90.0646, zip: "70116" },
      { name: "Uptown/Carrollton", lat: 29.9512, lng: -90.1028, zip: "70125" },
      { name: "New Orleans East Area", lat: 30.0877, lng: -89.8462, zip: "70129" },
      { name: "Central Business District", lat: 29.9546, lng: -90.0751, zip: "70145" },
    ],
  },
  {
    city: "Aurora",
    state: "CO",
    areas: [
      { name: "Delmar Parkway", lat: 39.7398, lng: -104.8562, zip: "80010" },
      { name: "Chambers Heights", lat: 39.7378, lng: -104.8152, zip: "80011" },
      { name: "Seven Hills", lat: 39.6604, lng: -104.7632, zip: "80013" },
      { name: "Tollgate Overlook", lat: 39.6981, lng: -104.7818, zip: "80017" },
    ],
  },
  {
    city: "Honolulu",
    state: "HI",
    areas: [
      { name: "Nuuanu - Punchbowl", lat: 21.3179, lng: -157.8521, zip: "96813" },
      { name: "Waikiki", lat: 21.2811, lng: -157.8266, zip: "96815" },
      { name: "Liliha - Kapalama", lat: 21.3295, lng: -157.8615, zip: "96817" },
      { name: "Moanalua", lat: 21.3488, lng: -157.8759, zip: "96819" },
      { name: "Makiki/Lower/ Punchbowl/Tantalus", lat: 21.3117, lng: -157.8298, zip: "96822" },
      { name: "McCully - Moiliili", lat: 21.2941, lng: -157.8284, zip: "96826" },
    ],
  },
  {
    city: "Anaheim",
    state: "CA",
    areas: [
      { name: "Northwest Anaheim", lat: 33.8428, lng: -117.9546, zip: "92801" },
      { name: "Anaheim Resort", lat: 33.8085, lng: -117.9228, zip: "92802" },
      { name: "Downtown Anaheim", lat: 33.8359, lng: -117.9086, zip: "92805" },
      { name: "Southeast Anaheim", lat: 33.8356, lng: -117.8681, zip: "92806" },
      { name: "Anaheim Hills", lat: 33.8579, lng: -117.7513, zip: "92808" },
    ],
  },
  {
    city: "Orlando",
    state: "FL",
    areas: [
      { name: "Northeast Orlando", lat: 28.5399, lng: -81.3727, zip: "32801" },
      { name: "Southport", lat: 28.4317, lng: -81.343, zip: "32827" },
    ],
  },
  {
    city: "Lexington",
    state: "KY",
    areas: [
      { name: "Indian Mound", lat: 38.0174, lng: -84.4854, zip: "40502" },
      { name: "Pine Meadow", lat: 38.0406, lng: -84.5433, zip: "40504" },
      { name: "Martin Luther King", lat: 38.0464, lng: -84.4953, zip: "40507" },
      { name: "Hartland Homeowners", lat: 37.9651, lng: -84.4708, zip: "40515" },
    ],
  },
  {
    city: "Riverside",
    state: "CA",
    areas: [
      { name: "Downtown Riverside", lat: 33.9924, lng: -117.3694, zip: "92501" },
      { name: "Arlington", lat: 33.9208, lng: -117.4589, zip: "92503" },
      { name: "Casa Blanca", lat: 33.9315, lng: -117.4119, zip: "92504" },
      { name: "La Sierra", lat: 33.9228, lng: -117.4867, zip: "92505" },
      { name: "Victoria", lat: 33.9455, lng: -117.3757, zip: "92506" },
      { name: "University", lat: 33.9761, lng: -117.3389, zip: "92507" },
    ],
  },
  {
    city: "Corpus Christi",
    state: "TX",
    areas: [
      { name: "Central City", lat: 27.7941, lng: -97.403, zip: "78401" },
      { name: "South Side", lat: 27.677, lng: -97.365, zip: "78414" },
    ],
  },
  {
    city: "Cincinnati",
    state: "OH",
    areas: [
      { name: "Mount Adams", lat: 39.1072, lng: -84.502, zip: "45202" },
      { name: "Oakley", lat: 39.1516, lng: -84.4278, zip: "45209" },
      { name: "North Avondale", lat: 39.149, lng: -84.4892, zip: "45229" },
      { name: "Roselawn", lat: 39.188, lng: -84.458, zip: "45237" },
    ],
  },
  {
    city: "Santa Ana",
    state: "CA",
    areas: [
      { name: "Centennial Park", lat: 33.7249, lng: -117.909, zip: "92704" },
      { name: "Riverview", lat: 33.7691, lng: -117.8855, zip: "92706" },
      { name: "South Coast Metro", lat: 33.7086, lng: -117.8701, zip: "92707" },
    ],
  },
  {
    city: "Stockton",
    state: "CA",
    areas: [
      { name: "Civic Center", lat: 37.9606, lng: -121.2871, zip: "95202" },
      { name: "Pacific", lat: 37.9532, lng: -121.3116, zip: "95203" },
      { name: "Park", lat: 37.9625, lng: -121.2624, zip: "95205" },
      { name: "Lakeview", lat: 38.0024, lng: -121.3238, zip: "95207" },
      { name: "Valley Oak", lat: 38.025, lng: -121.2972, zip: "95210" },
    ],
  },
  {
    city: "Pittsburgh",
    state: "PA",
    areas: [
      { name: "Central Lawrenceville", lat: 40.4752, lng: -79.9528, zip: "15201" },
      { name: "Homewood South", lat: 40.4532, lng: -79.8995, zip: "15208" },
      { name: "Banksville", lat: 40.4001, lng: -80.0462, zip: "15216" },
      { name: "Chateau", lat: 40.4608, lng: -80.0348, zip: "15233" },
    ],
  },
  {
    city: "Saint Paul",
    state: "MN",
    areas: [
      { name: "Downtown", lat: 44.9512, lng: -93.0902, zip: "55101" },
      { name: "Dayton's Bluff", lat: 44.9684, lng: -93.0488, zip: "55106" },
      { name: "Highland Park", lat: 44.914, lng: -93.1727, zip: "55116" },
    ],
  },
  {
    city: "Lincoln",
    state: "NE",
    areas: [
      { name: "Irvingdale", lat: 40.7893, lng: -96.6938, zip: "68502" },
      { name: "Bethany", lat: 40.8247, lng: -96.6252, zip: "68505" },
      { name: "Witherbee", lat: 40.8063, lng: -96.6545, zip: "68510" },
      { name: "Pester Ridge", lat: 40.7408, lng: -96.7583, zip: "68523" },
    ],
  },
  {
    city: "Anchorage",
    state: "AK",
    areas: [
      { name: "Fairview", lat: 61.2225, lng: -149.8677, zip: "99501" },
      { name: "Midtown", lat: 61.1891, lng: -149.8862, zip: "99503" },
      { name: "Abbott Loop", lat: 61.1456, lng: -149.7733, zip: "99507" },
      { name: "Bayshore / Klatt", lat: 61.1104, lng: -149.9043, zip: "99515" },
      { name: "Turnagain", lat: 61.1907, lng: -149.941, zip: "99517" },
    ],
  },
  {
    city: "Henderson",
    state: "NV",
    areas: [
      { name: "Highland Hills", lat: 36.0008, lng: -114.9588, zip: "89002" },
      { name: "MacDonald Highlands", lat: 36.0085, lng: -115.04, zip: "89012" },
      { name: "Valley View", lat: 36.0357, lng: -114.9718, zip: "89015" },
      { name: "Seven Hills", lat: 35.9878, lng: -115.1167, zip: "89052" },
    ],
  },
  {
    city: "Greensboro",
    state: "NC",
    areas: [
      { name: "Tolbert", lat: 36.0697, lng: -79.7682, zip: "27401" },
      { name: "Brice Street Area", lat: 36.0641, lng: -79.8202, zip: "27403" },
      { name: "Woodlea Lakes", lat: 36.022, lng: -79.7821, zip: "27406" },
      { name: "Kirkwood", lat: 36.1064, lng: -79.8165, zip: "27408" },
    ],
  },
  {
    city: "Plano",
    state: "TX",
    areas: [
      { name: "Hunter's Glen Village", lat: 33.055, lng: -96.7365, zip: "75023" },
      { name: "Deerfield", lat: 33.0752, lng: -96.7843, zip: "75024" },
      { name: "Park Ridge", lat: 33.0784, lng: -96.7291, zip: "75025" },
      { name: "Briarwood", lat: 33.0277, lng: -96.6777, zip: "75074" },
      { name: "The Castlery", lat: 33.025, lng: -96.7397, zip: "75075" },
      { name: "Preston Ridge", lat: 33.0299, lng: -96.7889, zip: "75093" },
    ],
  },
  {
    city: "Newark",
    state: "NJ",
    areas: [
      { name: "Central Ward", lat: 40.732, lng: -74.1765, zip: "07102" },
      { name: "West Side", lat: 40.737, lng: -74.1964, zip: "07103" },
      { name: "North Ironbound", lat: 40.7271, lng: -74.1563, zip: "07105" },
      { name: "Lower Vailsburg", lat: 40.7415, lng: -74.233, zip: "07106" },
      { name: "Upper Clinton Hill", lat: 40.7236, lng: -74.2015, zip: "07108" },
      { name: "Weequahic", lat: 40.7107, lng: -74.2131, zip: "07112" },
    ],
  },
  {
    city: "Madison",
    state: "WI",
    areas: [
      { name: "Old Market Place", lat: 43.0775, lng: -89.3831, zip: "53703" },
      { name: "Dunn's Marsh", lat: 43.0356, lng: -89.4526, zip: "53711" },
    ],
  },
  {
    city: "St. Louis",
    state: "MO",
    areas: [
      { name: "City Center", lat: 38.6273, lng: -90.1979 },
    ],
  },
  {
    city: "Chula Vista",
    state: "CA",
    areas: [
      { name: "Eastlake", lat: 32.6513, lng: -116.9852, zip: "91913" },
      { name: "Rolling Hills Ranch", lat: 32.6587, lng: -116.9652, zip: "91914" },
      { name: "Eastlake Vistas", lat: 32.6315, lng: -116.9408, zip: "91915" },
    ],
  },
  {
    city: "Toledo",
    state: "OH",
    areas: [
      { name: "North Towne", lat: 41.7207, lng: -83.5694, zip: "43601" },
      { name: "East Toledo", lat: 41.6525, lng: -83.5085, zip: "43605" },
      { name: "Lagrange", lat: 41.6779, lng: -83.5344, zip: "43608" },
      { name: "DeVeaux", lat: 41.7039, lng: -83.6034, zip: "43613" },
    ],
  },
  {
    city: "Jersey City",
    state: "NJ",
    areas: [
      { name: "Downtown Jersey City", lat: 40.7221, lng: -74.0469, zip: "07302" },
      { name: "West Side", lat: 40.718, lng: -74.0754, zip: "07304" },
      { name: "Greenville", lat: 40.702, lng: -74.089, zip: "07305" },
      { name: "Journal Square", lat: 40.7321, lng: -74.066, zip: "07306" },
      { name: "The Heights", lat: 40.7482, lng: -74.0498, zip: "07307" },
    ],
  },
  {
    city: "Reno",
    state: "NV",
    areas: [
      { name: "Downtown", lat: 39.5268, lng: -119.8113, zip: "89501" },
      { name: "West University", lat: 39.5354, lng: -119.8374, zip: "89503" },
      { name: "Northeast Reno", lat: 39.5483, lng: -119.7957, zip: "89512" },
    ],
  },
  {
    city: "Chandler",
    state: "AZ",
    areas: [
      { name: "Galveston Neighborhood", lat: 33.3105, lng: -111.8239, zip: "85225" },
      { name: "Fox Crossing", lat: 33.2509, lng: -111.8593, zip: "85248" },
    ],
  },
  {
    city: "Fort Wayne",
    state: "IN",
    areas: [
      { name: "West Central", lat: 41.0707, lng: -85.1543, zip: "46802" },
      { name: "Fairmont", lat: 41.0491, lng: -85.1462, zip: "46807" },
      { name: "Branning Hills", lat: 41.0165, lng: -85.0976, zip: "46816" },
    ],
  },
  {
    city: "Buffalo",
    state: "NY",
    areas: [
      { name: "Lakeview", lat: 42.8967, lng: -78.8846, zip: "14201" },
      { name: "Kaisertown", lat: 42.8811, lng: -78.8104, zip: "14206" },
      { name: "Genesee Moselle", lat: 42.9082, lng: -78.8225, zip: "14211" },
      { name: "Kensington", lat: 42.9335, lng: -78.8115, zip: "14215" },
      { name: "Abbott McKinley", lat: 42.8441, lng: -78.8182, zip: "14220" },
    ],
  },
  {
    city: "Durham",
    state: "NC",
    areas: [
      { name: "Downtown", lat: 35.9967, lng: -78.8966, zip: "27701" },
      { name: "Hope Valley", lat: 35.9631, lng: -78.9315, zip: "27707" },
      { name: "Dover Ridge", lat: 36.0918, lng: -78.9299, zip: "27712" },
    ],
  },
  {
    city: "St. Petersburg",
    state: "FL",
    areas: [
      { name: "City Center", lat: 27.7709, lng: -82.6793 },
    ],
  },
  {
    city: "Irvine",
    state: "CA",
    areas: [
      { name: "Orchard Hills", lat: 33.7419, lng: -117.7467, zip: "92602" },
      { name: "Shady Canyon", lat: 33.6245, lng: -117.794, zip: "92603" },
      { name: "Irvine Business Complex", lat: 33.6951, lng: -117.8224, zip: "92606" },
      { name: "University Park", lat: 33.6607, lng: -117.8264, zip: "92612" },
      { name: "Portola Springs", lat: 33.7074, lng: -117.7054, zip: "92618" },
    ],
  },
  {
    city: "Laredo",
    state: "TX",
    areas: [
      { name: "Western Division", lat: 27.5085, lng: -99.5036, zip: "78040" },
    ],
  },
  {
    city: "Lubbock",
    state: "TX",
    areas: [
      { name: "North Overton", lat: 33.5865, lng: -101.8606, zip: "79401" },
      { name: "Bowie", lat: 33.5684, lng: -101.9423, zip: "79407" },
      { name: "Heart of Lubbock", lat: 33.5704, lng: -101.8626, zip: "79411" },
      { name: "Caprock", lat: 33.5466, lng: -101.8871, zip: "79413" },
      { name: "North by Northwest", lat: 33.5924, lng: -101.9367, zip: "79416" },
    ],
  },
  {
    city: "Gilbert",
    state: "AZ",
    areas: [
      { name: "The Islands", lat: 33.3354, lng: -111.8153, zip: "85233" },
      { name: "Groves Of Gilbert", lat: 33.3527, lng: -111.7809, zip: "85234" },
      { name: "Santan Village", lat: 33.3054, lng: -111.7408, zip: "85295" },
      { name: "Cottonwoods Crossing", lat: 33.3354, lng: -111.7406, zip: "85296" },
      { name: "Power Ranch", lat: 33.2781, lng: -111.7096, zip: "85297" },
      { name: "Trilogy", lat: 33.2522, lng: -111.7022, zip: "85298" },
    ],
  },
  {
    city: "Winston-Salem",
    state: "NC",
    areas: [
      { name: "City Center", lat: 36.0999, lng: -80.2442 },
    ],
  },
  {
    city: "Glendale",
    state: "AZ",
    areas: [
      { name: "Luke Air Force Base", lat: 33.5376, lng: -112.3137, zip: "85307" },
      { name: "Deer Valley", lat: 33.6539, lng: -112.1694, zip: "85308" },
    ],
  },
  {
    city: "Norfolk",
    state: "VA",
    areas: [
      { name: "Poplar Halls", lat: 36.8546, lng: -76.2143, zip: "23502" },
      { name: "Bruce's Park", lat: 36.8586, lng: -76.2686, zip: "23504" },
      { name: "Ghent", lat: 36.8645, lng: -76.3004, zip: "23507" },
      { name: "Downtown", lat: 36.8529, lng: -76.2878, zip: "23510" },
      { name: "Norfolk Garden", lat: 36.8914, lng: -76.2396, zip: "23513" },
      { name: "Roosevelt Gardens Area", lat: 36.9202, lng: -76.216, zip: "23518" },
    ],
  },
  {
    city: "Garland",
    state: "TX",
    areas: [
      { name: "Orchard Hills", lat: 32.8794, lng: -96.6411, zip: "75041" },
      { name: "Apollo, Arapaho & Camelot", lat: 32.9522, lng: -96.6654, zip: "75044" },
    ],
  },
  {
    city: "Scottsdale",
    state: "AZ",
    areas: [
      { name: "South Scottsdale", lat: 33.5218, lng: -111.9049, zip: "85250" },
      { name: "Desert Village Shopping Center", lat: 33.6968, lng: -111.8892, zip: "85255" },
      { name: "Central Scottsdale", lat: 33.5879, lng: -111.8404, zip: "85259" },
      { name: "Sunrise Desert Vistas", lat: 33.7752, lng: -111.7791, zip: "85262" },
    ],
  },
  {
    city: "Irving",
    state: "TX",
    areas: [
      { name: "Las Colinas", lat: 32.8653, lng: -96.9905, zip: "75038" },
      { name: "Arts District", lat: 32.8479, lng: -96.974, zip: "75062" },
      { name: "Valley Ranch", lat: 32.9247, lng: -96.9598, zip: "75063" },
    ],
  },
  {
    city: "Boise",
    state: "ID",
    areas: [
      { name: "North End", lat: 43.6322, lng: -116.2052, zip: "83702" },
      { name: "Collister", lat: 43.6601, lng: -116.2524, zip: "83703" },
      { name: "Boise Bench", lat: 43.5851, lng: -116.2191, zip: "83705" },
      { name: "Southwest Ada County Alliance", lat: 43.5741, lng: -116.2941, zip: "83709" },
      { name: "West Boise", lat: 43.634, lng: -116.3419, zip: "83713" },
    ],
  },
  {
    city: "Chesapeake",
    state: "VA",
    areas: [
      { name: "Greenbrier West", lat: 36.7352, lng: -76.2384, zip: "23320" },
      { name: "Western Branch South", lat: 36.8012, lng: -76.423, zip: "23321" },
      { name: "Pleasant Grove West", lat: 36.6434, lng: -76.242, zip: "23322" },
      { name: "Deep Creek North", lat: 36.7634, lng: -76.3397, zip: "23323" },
      { name: "South Norfolk", lat: 36.8056, lng: -76.2666, zip: "23324" },
      { name: "Indian River", lat: 36.814, lng: -76.2406, zip: "23325" },
    ],
  },
  {
    city: "Fremont",
    state: "CA",
    areas: [
      { name: "Centerville", lat: 37.5605, lng: -121.9999, zip: "94536" },
      { name: "South Sundale", lat: 37.5308, lng: -121.9712, zip: "94538" },
      { name: "Cameron Hills", lat: 37.5176, lng: -121.9287, zip: "94539" },
      { name: "Ardenwood", lat: 37.5735, lng: -122.0469, zip: "94555" },
    ],
  },
  {
    city: "Spokane",
    state: "WA",
    areas: [
      { name: "West Central", lat: 47.6665, lng: -117.4365, zip: "99201" },
      { name: "Manito", lat: 47.6294, lng: -117.4041, zip: "99203" },
      { name: "Audubon-Downriver", lat: 47.6964, lng: -117.4399, zip: "99205" },
      { name: "Five Mile Prairie", lat: 47.7374, lng: -117.4352, zip: "99208" },
      { name: "Veradale", lat: 47.6634, lng: -117.2193, zip: "99216" },
    ],
  },
  {
    city: "Baton Rouge",
    state: "LA",
    areas: [
      { name: "Mid City South", lat: 30.4485, lng: -91.13, zip: "70806" },
      { name: "Westminster", lat: 30.4089, lng: -91.0842, zip: "70809" },
      { name: "Park Forest/LA North", lat: 30.4848, lng: -91.0689, zip: "70814" },
      { name: "Shenandoah", lat: 30.3904, lng: -91.0021, zip: "70817" },
      { name: "Highlands/Perkins", lat: 30.3795, lng: -91.1671, zip: "70820" },
    ],
  },
  {
    city: "Richmond",
    state: "VA",
    areas: [
      { name: "Downtown", lat: 37.5463, lng: -77.4378, zip: "23219" },
      { name: "Museum District", lat: 37.5583, lng: -77.4845, zip: "23221" },
      { name: "South Richmond", lat: 37.4955, lng: -77.471, zip: "23224" },
      { name: "North Chesterfield", lat: 37.4373, lng: -77.4788, zip: "23234" },
    ],
  },
  {
    city: "Tacoma",
    state: "WA",
    areas: [
      { name: "New Tacoma", lat: 47.2545, lng: -122.4405, zip: "98402" },
      { name: "Central Tacoma", lat: 47.2484, lng: -122.4643, zip: "98405" },
      { name: "South End", lat: 47.2073, lng: -122.4444, zip: "98408" },
      { name: "Joint Base Lewis-McChord", lat: 47.1125, lng: -122.5891, zip: "98433" },
    ],
  },
  {
    city: "San Bernardino",
    state: "CA",
    areas: [
      { name: "Feldheym", lat: 34.1105, lng: -117.2898, zip: "92401" },
      { name: "Carousel", lat: 34.1083, lng: -117.2898, zip: "92403" },
      { name: "NE - Sterling", lat: 34.1426, lng: -117.2606, zip: "92404" },
      { name: "Verdemont", lat: 34.2166, lng: -117.3908, zip: "92407" },
      { name: "Valley View", lat: 34.0831, lng: -117.2711, zip: "92408" },
    ],
  },
  {
    city: "Salt Lake City",
    state: "UT",
    areas: [
      { name: "Ballpark", lat: 40.7559, lng: -111.8967, zip: "84101" },
      { name: "East Central", lat: 40.7372, lng: -111.8581, zip: "84105" },
      { name: "Canyon Rim", lat: 40.7043, lng: -111.8142, zip: "84109" },
    ],
  },
  {
    city: "Des Moines",
    state: "IA",
    areas: [
      { name: "Capitol Park", lat: 41.6005, lng: -93.6091, zip: "50307" },
      { name: "Downtown Des Moines", lat: 41.5887, lng: -93.6212, zip: "50309" },
      { name: "North of Grand", lat: 41.5855, lng: -93.6719, zip: "50312" },
      { name: "Evelyn Davis Park", lat: 41.603, lng: -93.633, zip: "50314" },
      { name: "Gray's Woods", lat: 41.6122, lng: -93.5296, zip: "50317" },
    ],
  },
  {
    city: "Fontana",
    state: "CA",
    areas: [
      { name: "Southwest Industrial Park", lat: 34.0498, lng: -117.4706, zip: "92337" },
    ],
  },
  {
    city: "Modesto",
    state: "CA",
    areas: [
      { name: "Shackelford", lat: 37.6236, lng: -120.9966, zip: "95351" },
    ],
  },
  {
    city: "Rochester",
    state: "NY",
    areas: [
      { name: "Downtown", lat: 43.1577, lng: -77.608, zip: "14604" },
      { name: "Park Avenue", lat: 43.1501, lng: -77.589, zip: "14607" },
      { name: "19th Ward", lat: 43.1484, lng: -77.6394, zip: "14611" },
      { name: "Maplewood Historic District", lat: 43.2058, lng: -77.6521, zip: "14615" },
    ],
  },
  {
    city: "Arlington",
    state: "VA",
    areas: [
      { name: "Court House", lat: 38.8871, lng: -77.0932, zip: "22201" },
      { name: "Aurora Highlands", lat: 38.8565, lng: -77.0592, zip: "22202" },
      { name: "Douglas Park", lat: 38.859, lng: -77.0997, zip: "22204" },
      { name: "Shirlington", lat: 38.8415, lng: -77.0905, zip: "22206" },
      { name: "Yorktown", lat: 38.9033, lng: -77.1263, zip: "22207" },
      { name: "East Falls Church", lat: 38.8954, lng: -77.1633, zip: "22213" },
    ],
  },
  {
    city: "Oxnard",
    state: "CA",
    areas: [
      { name: "West Village", lat: 34.2141, lng: -119.175, zip: "93030" },
      { name: "Blackstock North", lat: 34.1685, lng: -119.1717, zip: "93033" },
      { name: "Via Marina", lat: 34.1822, lng: -119.216, zip: "93035" },
      { name: "South Bank", lat: 34.2351, lng: -119.182, zip: "93036" },
    ],
  },
  {
    city: "Columbus",
    state: "GA",
    areas: [
      { name: "East Columbus", lat: 32.4779, lng: -84.898, zip: "31907" },
    ],
  },
  {
    city: "Worcester",
    state: "MA",
    areas: [
      { name: "Tatnuck", lat: 42.2703, lng: -71.8417, zip: "01602" },
      { name: "Webster Square", lat: 42.245, lng: -71.838, zip: "01603" },
      { name: "Brittan Square", lat: 42.2894, lng: -71.7888, zip: "01605" },
      { name: "Quinsigamond Village", lat: 42.2303, lng: -71.7938, zip: "01607" },
      { name: "Central Business District", lat: 42.2624, lng: -71.8003, zip: "01608" },
      { name: "South Worcester", lat: 42.2492, lng: -71.8108, zip: "01610" },
    ],
  },
  {
    city: "Little Rock",
    state: "AR",
    areas: [
      { name: "Downtown", lat: 34.7483, lng: -92.2819, zip: "72201" },
      { name: "Broadmoor", lat: 34.7269, lng: -92.344, zip: "72204" },
      { name: "Cloverdale", lat: 34.6725, lng: -92.3529, zip: "72209" },
      { name: "Woodland Edge", lat: 34.7413, lng: -92.4222, zip: "72211" },
    ],
  },
  {
    city: "Fayetteville",
    state: "NC",
    areas: [
      { name: "Terry Sanford", lat: 35.0743, lng: -78.8836, zip: "28301" },
      { name: "Westover", lat: 35.0742, lng: -78.965, zip: "28303" },
      { name: "Douglas Byrd", lat: 35.0257, lng: -78.9705, zip: "28304" },
      { name: "Cape Fear", lat: 34.9549, lng: -78.7408, zip: "28312" },
    ],
  },
  {
    city: "Huntington Beach",
    state: "CA",
    areas: [
      { name: "Goldenwest", lat: 33.721, lng: -118.0033, zip: "92647" },
    ],
  },
  {
    city: "Tallahassee",
    state: "FL",
    areas: [
      { name: "Indian Head-Lehigh", lat: 30.4286, lng: -84.2593, zip: "32301" },
      { name: "Centerville", lat: 30.5422, lng: -84.1413, zip: "32309" },
      { name: "Lake Bradford/Cascade Lake", lat: 30.3991, lng: -84.3298, zip: "32310" },
      { name: "Bobbin Brook", lat: 30.5185, lng: -84.2627, zip: "32312" },
    ],
  },
  {
    city: "Yonkers",
    state: "NY",
    areas: [
      { name: "Bryn Mawr Park", lat: 40.9461, lng: -73.8669, zip: "10701" },
      { name: "Northwest Yonkers", lat: 40.9518, lng: -73.8852, zip: "10703" },
      { name: "Southeast Yonkers", lat: 40.9176, lng: -73.8593, zip: "10704" },
      { name: "Park Hill", lat: 40.9177, lng: -73.895, zip: "10705" },
      { name: "Northeast Yonkers", lat: 40.9656, lng: -73.8434, zip: "10710" },
    ],
  },
  {
    city: "Glendale",
    state: "CA",
    areas: [
      { name: "Grandview", lat: 34.1716, lng: -118.2899, zip: "91201" },
      { name: "Glenwood", lat: 34.1652, lng: -118.2656, zip: "91202" },
      { name: "Pacific - Edison", lat: 34.1379, lng: -118.2599, zip: "91204" },
      { name: "Mariposa", lat: 34.1378, lng: -118.2425, zip: "91205" },
      { name: "Oakmont", lat: 34.1921, lng: -118.235, zip: "91208" },
    ],
  },
  {
    city: "Akron",
    state: "OH",
    areas: [
      { name: "Firestone Park", lat: 41.0449, lng: -81.52, zip: "44301" },
      { name: "Highland Square", lat: 41.1025, lng: -81.5386, zip: "44303" },
      { name: "East Akron", lat: 41.0479, lng: -81.4916, zip: "44306" },
      { name: "North Hill", lat: 41.1075, lng: -81.5006, zip: "44310" },
      { name: "Northwest Akron", lat: 41.122, lng: -81.5685, zip: "44313" },
      { name: "West Akron", lat: 41.0835, lng: -81.5674, zip: "44320" },
    ],
  },
  {
    city: "Vancouver",
    state: "WA",
    areas: [
      { name: "Carter Park", lat: 45.6418, lng: -122.6801, zip: "98660" },
      { name: "Bagley Downs", lat: 45.6418, lng: -122.6251, zip: "98661" },
      { name: "West Minnehaha", lat: 45.6514, lng: -122.6604, zip: "98663" },
      { name: "Hazel Dell North", lat: 45.6892, lng: -122.6616, zip: "98665" },
      { name: "Fairway 164th", lat: 45.6032, lng: -122.5133, zip: "98683" },
      { name: "Felida-Starcrest", lat: 45.7162, lng: -122.6899, zip: "98685" },
    ],
  },
  {
    city: "Birmingham",
    state: "AL",
    areas: [
      { name: "Central City", lat: 33.521, lng: -86.8066, zip: "35203" },
      { name: "Collegeville", lat: 33.5594, lng: -86.8153, zip: "35207" },
      { name: "Woodlawn", lat: 33.5409, lng: -86.7495, zip: "35212" },
      { name: "Norwood", lat: 33.5378, lng: -86.8068, zip: "35234" },
    ],
  },
  {
    city: "Montgomery",
    state: "AL",
    areas: [
      { name: "Forest Park", lat: 32.3543, lng: -86.2673, zip: "36106" },
    ],
  },
  {
    city: "Grand Rapids",
    state: "MI",
    areas: [
      { name: "Midtown", lat: 42.9659, lng: -85.6527, zip: "49503" },
      { name: "Creston", lat: 43.012, lng: -85.6309, zip: "49505" },
      { name: "Garfield Park", lat: 42.9318, lng: -85.6542, zip: "49507" },
    ],
  },
  {
    city: "Peoria",
    state: "AZ",
    areas: [
      { name: "Springer Ranch", lat: 33.5735, lng: -112.2596, zip: "85345" },
      { name: "Ridgemere", lat: 33.6048, lng: -112.2237, zip: "85381" },
      { name: "Westwing Mountain", lat: 33.7169, lng: -112.238, zip: "85383" },
    ],
  },
  {
    city: "Providence",
    state: "RI",
    areas: [
      { name: "Downtown Providence", lat: 41.82, lng: -71.4158, zip: "02903" },
      { name: "Wanskuck", lat: 41.8541, lng: -71.4378, zip: "02904" },
      { name: "Edgewood", lat: 41.7845, lng: -71.3959, zip: "02905" },
      { name: "College Hill", lat: 41.8351, lng: -71.3971, zip: "02906" },
      { name: "Elmwood", lat: 41.7971, lng: -71.4255, zip: "02907" },
      { name: "Elmhurst", lat: 41.8383, lng: -71.4377, zip: "02908" },
    ],
  },
  {
    city: "Knoxville",
    state: "TN",
    areas: [
      { name: "Downtown", lat: 35.9625, lng: -83.9209, zip: "37902" },
      { name: "Belle Morris", lat: 35.998, lng: -83.9152, zip: "37917" },
      { name: "Cedar Bluff", lat: 35.9331, lng: -84.0761, zip: "37923" },
    ],
  },
  {
    city: "Shreveport",
    state: "LA",
    areas: [
      { name: "Allendale-Lakeside", lat: 32.5037, lng: -93.7487, zip: "71101" },
      { name: "Highland, Stoner Hill", lat: 32.483, lng: -93.7349, zip: "71104" },
      { name: "Forbing", lat: 32.3912, lng: -93.7116, zip: "71106" },
      { name: "Mooretown", lat: 32.4486, lng: -93.7814, zip: "71108" },
      { name: "Western Hills and Yarborough Subdivision", lat: 32.4771, lng: -93.8726, zip: "71119" },
    ],
  },
  {
    city: "Overland Park",
    state: "KS",
    areas: [
      { name: "Strang Line", lat: 38.9928, lng: -94.6771, zip: "66204" },
      { name: "Sylvan Grove", lat: 38.9568, lng: -94.6832, zip: "66212" },
      { name: "Congleton Industrial Park", lat: 38.9649, lng: -94.7209, zip: "66214" },
      { name: "Deerbrook", lat: 38.8636, lng: -94.7103, zip: "66221" },
      { name: "Pavilions Of Leawood", lat: 38.8591, lng: -94.6314, zip: "66224" },
    ],
  },
  {
    city: "Newport News",
    state: "VA",
    areas: [
      { name: "South Newport News", lat: 37.058, lng: -76.4607, zip: "23601" },
      { name: "North Newport News", lat: 37.1132, lng: -76.5179, zip: "23602" },
      { name: "Lee Hall", lat: 37.1989, lng: -76.5821, zip: "23603" },
      { name: "Central Newport News", lat: 37.0768, lng: -76.4967, zip: "23606" },
    ],
  },
  {
    city: "Mobile",
    state: "AL",
    areas: [
      { name: "Central Business District", lat: 30.6888, lng: -88.0453, zip: "36602" },
      { name: "Leinkauf", lat: 30.682, lng: -88.0678, zip: "36604" },
      { name: "Park Place", lat: 30.6975, lng: -88.1029, zip: "36607" },
      { name: "Magazine", lat: 30.7309, lng: -88.0789, zip: "36610" },
      { name: "Brookley Aeroplex", lat: 30.6411, lng: -88.0622, zip: "36615" },
      { name: "Devonshire", lat: 30.5928, lng: -88.1946, zip: "36619" },
    ],
  },
  {
    city: "Fort Lauderdale",
    state: "FL",
    areas: [
      { name: "Colee Hammock", lat: 26.1216, lng: -80.1288, zip: "33301" },
      { name: "Chula Vista", lat: 26.0984, lng: -80.1822, zip: "33308" },
    ],
  },
  {
    city: "Santa Clarita",
    state: "CA",
    areas: [
      { name: "Canyon Country", lat: 34.4336, lng: -118.5007, zip: "91350" },
      { name: "Newhall", lat: 34.3917, lng: -118.5426, zip: "91382" },
    ],
  },
  {
    city: "Chattanooga",
    state: "TN",
    areas: [
      { name: "Ridgedale", lat: 35.0306, lng: -85.2722, zip: "37404" },
      { name: "East Lake", lat: 35.0024, lng: -85.2849, zip: "37407" },
      { name: "Piney Woods", lat: 35.0018, lng: -85.3138, zip: "37410" },
      { name: "Lookout Valley", lat: 35.0331, lng: -85.3687, zip: "37419" },
    ],
  },
  {
    city: "Santa Rosa",
    state: "CA",
    areas: [
      { name: "Southwest Santa Rosa", lat: 38.4089, lng: -122.7339, zip: "95407" },
    ],
  },
  {
    city: "Eugene",
    state: "OR",
    areas: [
      { name: "Cal Young", lat: 44.0682, lng: -123.0819, zip: "97401" },
      { name: "Western", lat: 44.0612, lng: -123.1555, zip: "97402" },
      { name: "Fairmont", lat: 44.0385, lng: -123.0614, zip: "97403" },
      { name: "South Hills", lat: 44.0185, lng: -123.0998, zip: "97405" },
    ],
  },
  {
    city: "Tempe",
    state: "AZ",
    areas: [
      { name: "South Tempe", lat: 33.3917, lng: -111.9249, zip: "85282" },
      { name: "Kiwanis Park", lat: 33.3665, lng: -111.9312, zip: "85283" },
    ],
  },
  {
    city: "Oceanside",
    state: "CA",
    areas: [
      { name: "Loma Alta", lat: 33.2072, lng: -117.3573, zip: "92054" },
      { name: "Tri-City", lat: 33.1968, lng: -117.2831, zip: "92056" },
      { name: "San Luis Rey", lat: 33.2407, lng: -117.3025, zip: "92057" },
      { name: "Townsite", lat: 33.1959, lng: -117.3795, zip: "92058" },
    ],
  },
  {
    city: "Salem",
    state: "OR",
    areas: [
      { name: "Northeast Salem", lat: 44.949, lng: -123.004, zip: "97301" },
      { name: "Morningside", lat: 44.9039, lng: -123.0445, zip: "97302" },
      { name: "West Salem", lat: 44.9588, lng: -123.0753, zip: "97304" },
      { name: "South Gateway", lat: 44.8685, lng: -123.0438, zip: "97306" },
    ],
  },
  {
    city: "Garden Grove",
    state: "CA",
    areas: [
      { name: "West Garden Grove", lat: 33.7787, lng: -118.0267, zip: "92845" },
    ],
  },
  {
    city: "Rancho Cucamonga",
    state: "CA",
    areas: [
      { name: "Alta Loma", lat: 34.1467, lng: -117.5803, zip: "91737" },
      { name: "Etiwanda", lat: 34.1705, lng: -117.5182, zip: "91739" },
    ],
  },
  {
    city: "Cape Coral",
    state: "FL",
    areas: [
      { name: "Caloosahatchee", lat: 26.6065, lng: -81.9502, zip: "33904" },
      { name: "Diplomat", lat: 26.6939, lng: -81.9452, zip: "33909" },
      { name: "Pelican", lat: 26.5557, lng: -82.0206, zip: "33914" },
      { name: "Hancock", lat: 26.6265, lng: -81.9677, zip: "33990" },
      { name: "Trafalgar", lat: 26.6281, lng: -82.0182, zip: "33991" },
      { name: "Burnt Store", lat: 26.6786, lng: -82.0254, zip: "33993" },
    ],
  },
  {
    city: "Sioux Falls",
    state: "SD",
    areas: [
      { name: "North End West", lat: 43.5514, lng: -96.7375, zip: "57104" },
    ],
  },
  {
    city: "Fort Collins",
    state: "CO",
    areas: [
      { name: "South Sheldon Lake", lat: 40.5813, lng: -105.1039, zip: "80521" },
      { name: "Alta Vista", lat: 40.5986, lng: -105.0581, zip: "80524" },
      { name: "Collindale", lat: 40.5384, lng: -105.0547, zip: "80525" },
      { name: "Silver Plume", lat: 40.5473, lng: -105.1076, zip: "80526" },
    ],
  },
  {
    city: "Springfield",
    state: "MO",
    areas: [
      { name: "West Central", lat: 37.2117, lng: -93.299, zip: "65802" },
      { name: "Southeast Springfield", lat: 37.1654, lng: -93.2522, zip: "65804" },
    ],
  },
  {
    city: "Pembroke Pines",
    state: "FL",
    areas: [
      { name: "Town Gate", lat: 26.0185, lng: -80.3449, zip: "33028" },
    ],
  },
  {
    city: "Port Saint Lucie",
    state: "FL",
    areas: [
      { name: "Saint Lucie West", lat: 27.2625, lng: -80.3793, zip: "34953" },
    ],
  },
  {
    city: "McKinney",
    state: "TX",
    areas: [
      { name: "City Center", lat: 33.1976, lng: -96.6153 },
    ],
  },
  {
    city: "Cary",
    state: "NC",
    areas: [
      { name: "Farmington Woods", lat: 35.7641, lng: -78.7786, zip: "27511" },
      { name: "Taylor's Pond", lat: 35.7956, lng: -78.7941, zip: "27513" },
      { name: "Windsong of Lochmere", lat: 35.7299, lng: -78.7735, zip: "27518" },
    ],
  },
  {
    city: "Alexandria",
    state: "VA",
    areas: [
      { name: "Potomac West", lat: 38.82, lng: -77.0589, zip: "22301" },
      { name: "Jefferson Manor", lat: 38.7912, lng: -77.0814, zip: "22303" },
      { name: "Community", lat: 38.7589, lng: -77.0873, zip: "22306" },
      { name: "Engleside", lat: 38.7192, lng: -77.1073, zip: "22309" },
      { name: "Alexandria West", lat: 38.832, lng: -77.12, zip: "22311" },
      { name: "Kingstowne", lat: 38.7596, lng: -77.1485, zip: "22315" },
    ],
  },
  {
    city: "Hayward",
    state: "CA",
    areas: [
      { name: "North Hayward", lat: 37.674, lng: -122.0894, zip: "94541" },
      { name: "Hayward Highland", lat: 37.6586, lng: -122.0472, zip: "94542" },
      { name: "Harder-Tennyson", lat: 37.6374, lng: -122.067, zip: "94544" },
      { name: "Southgate", lat: 37.6332, lng: -122.0971, zip: "94545" },
    ],
  },
  {
    city: "Sunnyvale",
    state: "CA",
    areas: [
      { name: "Snail", lat: 37.3886, lng: -122.0177, zip: "94085" },
      { name: "Heritage District", lat: 37.3764, lng: -122.0238, zip: "94086" },
      { name: "Nimitz", lat: 37.3502, lng: -122.0349, zip: "94087" },
      { name: "Lakewood", lat: 37.3983, lng: -122.0006, zip: "94089" },
    ],
  },
  {
    city: "Frisco",
    state: "TX",
    areas: [
      { name: "Frisco Original Donation", lat: 33.1499, lng: -96.8241, zip: "75034" },
      { name: "Richwoods", lat: 33.1377, lng: -96.7524, zip: "75035" },
    ],
  },
  {
    city: "Springfield",
    state: "MA",
    areas: [
      { name: "Metro Center", lat: 42.1029, lng: -72.5887, zip: "01103" },
      { name: "Six Corners", lat: 42.0999, lng: -72.5783, zip: "01105" },
      { name: "Forest Park", lat: 42.0853, lng: -72.5584, zip: "01108" },
      { name: "East Forest Park", lat: 42.0929, lng: -72.5274, zip: "01118" },
      { name: "Sixteen Acres", lat: 42.0944, lng: -72.4889, zip: "01128" },
    ],
  },
  {
    city: "Pasadena",
    state: "TX",
    areas: [
      { name: "Frontier East", lat: 29.6789, lng: -95.1982, zip: "77502" },
      { name: "Houston Suburban Homes", lat: 29.6877, lng: -95.1572, zip: "77503" },
      { name: "Parkview South", lat: 29.6501, lng: -95.1885, zip: "77504" },
      { name: "Pasadena Gardens", lat: 29.7009, lng: -95.1989, zip: "77506" },
      { name: "Bayport", lat: 29.6224, lng: -95.0545, zip: "77507" },
    ],
  },
  {
    city: "Jackson",
    state: "MS",
    areas: [
      { name: "Belhaven", lat: 32.3149, lng: -90.1782, zip: "39202" },
      { name: "Valley Park", lat: 32.2435, lng: -90.2612, zip: "39212" },
      { name: "Fondren", lat: 32.3386, lng: -90.1708, zip: "39216" },
    ],
  },
  {
    city: "Kansas City",
    state: "KS",
    areas: [
      { name: "Riverview", lat: 39.1157, lng: -94.6271, zip: "66101" },
      { name: "Kensington", lat: 39.1132, lng: -94.6693, zip: "66102" },
      { name: "Bethel Welborn", lat: 39.1375, lng: -94.6792, zip: "66104" },
      { name: "Morris", lat: 39.0694, lng: -94.7178, zip: "66106" },
      { name: "Muncie", lat: 39.0803, lng: -94.7806, zip: "66111" },
      { name: "Northeast", lat: 39.1364, lng: -94.616, zip: "66115" },
    ],
  },
  {
    city: "Lakewood",
    state: "CO",
    areas: [
      { name: "City Center", lat: 39.7047, lng: -105.0814 },
    ],
  },
  {
    city: "Escondido",
    state: "CA",
    areas: [
      { name: "Central Escondido", lat: 33.1101, lng: -117.07, zip: "92025" },
      { name: "North Broadway", lat: 33.1605, lng: -117.0978, zip: "92026" },
      { name: "Midway", lat: 33.1388, lng: -117.052, zip: "92027" },
      { name: "Felicita", lat: 33.0895, lng: -117.1128, zip: "92029" },
    ],
  },
  {
    city: "Hollywood",
    state: "FL",
    areas: [
      { name: "Hollywood Lakes", lat: 26.007, lng: -80.1219, zip: "33019" },
      { name: "North Central", lat: 26.0161, lng: -80.1517, zip: "33020" },
      { name: "Boulevard Heights", lat: 25.9894, lng: -80.2153, zip: "33023" },
    ],
  },
  {
    city: "Savannah",
    state: "GA",
    areas: [
      { name: "North Historic District", lat: 32.0749, lng: -81.0883, zip: "31401" },
      { name: "The Landings", lat: 31.9268, lng: -81.0381, zip: "31411" },
    ],
  },
  {
    city: "Bridgeport",
    state: "CT",
    areas: [
      { name: "Downtown", lat: 41.1796, lng: -73.2019, zip: "06604" },
      { name: "West End/West Side", lat: 41.1668, lng: -73.2163, zip: "06605" },
      { name: "North End", lat: 41.2091, lng: -73.2086, zip: "06606" },
      { name: "East End", lat: 41.1784, lng: -73.165, zip: "06607" },
      { name: "East Side", lat: 41.1895, lng: -73.1811, zip: "06608" },
      { name: "North Bridgeport", lat: 41.2005, lng: -73.1688, zip: "06610" },
    ],
  },
  {
    city: "Naperville",
    state: "IL",
    areas: [
      { name: "Naperville Park District", lat: 41.7662, lng: -88.141, zip: "60540" },
    ],
  },
  {
    city: "Gainesville",
    state: "FL",
    areas: [
      { name: "University Park", lat: 29.6515, lng: -82.3493, zip: "32603" },
    ],
  },
  {
    city: "Mesquite",
    state: "TX",
    areas: [
      { name: "Scyene Plaza", lat: 32.7678, lng: -96.6082, zip: "75149" },
      { name: "Crossroads Place", lat: 32.8154, lng: -96.6307, zip: "75150" },
    ],
  },
  {
    city: "Syracuse",
    state: "NY",
    areas: [
      { name: "Southside", lat: 43.041, lng: -76.1489, zip: "13202" },
      { name: "Westside", lat: 43.0444, lng: -76.1758, zip: "13204" },
    ],
  },
  {
    city: "Torrance",
    state: "CA",
    areas: [
      { name: "Old Torrance", lat: 33.8268, lng: -118.3118, zip: "90501" },
      { name: "Delthorne", lat: 33.8397, lng: -118.3542, zip: "90503" },
      { name: "Northwest Torrance", lat: 33.8708, lng: -118.3295, zip: "90504" },
      { name: "Southwood Riviera", lat: 33.8106, lng: -118.3507, zip: "90505" },
      { name: "Harbor City", lat: 33.7866, lng: -118.2987, zip: "90506" },
    ],
  },
  {
    city: "Surprise",
    state: "AZ",
    areas: [
      { name: "Surprise Original Townsite", lat: 33.63, lng: -112.3314, zip: "85374" },
      { name: "Marley Park", lat: 33.6021, lng: -112.3736, zip: "85379" },
      { name: "Waddell Haciendas", lat: 33.6134, lng: -112.4512, zip: "85388" },
    ],
  },
  {
    city: "Columbia",
    state: "SC",
    areas: [
      { name: "Midtown - Downtown", lat: 34.0004, lng: -81.0334, zip: "29201" },
      { name: "Shandon", lat: 33.9903, lng: -80.9997, zip: "29205" },
    ],
  },
  {
    city: "Pasadena",
    state: "CA",
    areas: [
      { name: "Playhouse Village", lat: 34.1468, lng: -118.1391, zip: "91101" },
      { name: "North Central", lat: 34.1669, lng: -118.1551, zip: "91103" },
      { name: "Bungalow Heaven", lat: 34.1678, lng: -118.1261, zip: "91104" },
      { name: "South Arroyo", lat: 34.1355, lng: -118.1636, zip: "91105" },
      { name: "Daisy-Villa", lat: 34.151, lng: -118.0889, zip: "91107" },
    ],
  },
  {
    city: "McAllen",
    state: "TX",
    areas: [
      { name: "City Center", lat: 26.2034, lng: -98.23 },
    ],
  },
  {
    city: "Bellevue",
    state: "WA",
    areas: [
      { name: "Northwest Bellevue", lat: 47.6155, lng: -122.2072, zip: "98004" },
      { name: "Wilburton", lat: 47.615, lng: -122.1663, zip: "98005" },
      { name: "Somerset", lat: 47.5614, lng: -122.1552, zip: "98006" },
      { name: "Crossroads", lat: 47.6174, lng: -122.1426, zip: "98007" },
      { name: "Northeast Bellevue", lat: 47.6115, lng: -122.1162, zip: "98008" },
    ],
  },
  {
    city: "Hampton",
    state: "VA",
    areas: [
      { name: "Wythe", lat: 37.0074, lng: -76.3801, zip: "23661" },
      { name: "Phoebus", lat: 37.0318, lng: -76.3199, zip: "23663" },
      { name: "Buckroe Beach", lat: 37.0566, lng: -76.2966, zip: "23664" },
      { name: "Langley Air Force Base", lat: 37.0831, lng: -76.36, zip: "23665" },
      { name: "Northampton", lat: 37.0462, lng: -76.4096, zip: "23666" },
      { name: "Willow Oaks", lat: 37.0436, lng: -76.3426, zip: "23669" },
    ],
  },
  {
    city: "Miramar",
    state: "FL",
    areas: [
      { name: "City Center", lat: 25.9873, lng: -80.2323 },
    ],
  },
  {
    city: "Dayton",
    state: "OH",
    areas: [
      { name: "Downtown", lat: 39.7563, lng: -84.1895, zip: "45402" },
      { name: "College Hill", lat: 39.7821, lng: -84.2373, zip: "45406" },
      { name: "Northern Hills", lat: 39.8011, lng: -84.2578, zip: "45416" },
    ],
  },
  {
    city: "Olathe",
    state: "KS",
    areas: [
      { name: "Tomahawk Trails", lat: 38.8733, lng: -94.7752, zip: "66062" },
    ],
  },
  {
    city: "Warren",
    state: "MI",
    areas: [
      { name: "Warren Woods", lat: 42.5164, lng: -82.9832, zip: "48088" },
      { name: "Fitzgerald", lat: 42.4665, lng: -83.0593, zip: "48091" },
    ],
  },
  {
    city: "Carrollton",
    state: "TX",
    areas: [
      { name: "Southwest Carrollton", lat: 32.9657, lng: -96.8825, zip: "75006" },
      { name: "Northeast Carrollton", lat: 33.0033, lng: -96.882, zip: "75007" },
      { name: "Meadow Ridge / Harvest Run", lat: 33.0304, lng: -96.8777, zip: "75010" },
    ],
  },
  {
    city: "Charleston",
    state: "SC",
    areas: [
      { name: "Harleston Village", lat: 32.7795, lng: -79.9371, zip: "29401" },
      { name: "Westside", lat: 32.7976, lng: -79.9493, zip: "29403" },
      { name: "West Ashley", lat: 32.7993, lng: -80.006, zip: "29407" },
    ],
  },
  {
    city: "Midland",
    state: "TX",
    areas: [
      { name: "Southern", lat: 31.9896, lng: -102.0626, zip: "79701" },
      { name: "Western Hills", lat: 31.9721, lng: -102.1369, zip: "79703" },
      { name: "Porras", lat: 32.0295, lng: -102.0915, zip: "79705" },
      { name: "Fairmont Park", lat: 32.0199, lng: -102.1476, zip: "79707" },
    ],
  },
  {
    city: "Waco",
    state: "TX",
    areas: [
      { name: "Downtown", lat: 31.5525, lng: -97.1396, zip: "76701" },
      { name: "Carver", lat: 31.5773, lng: -97.1241, zip: "76704" },
      { name: "Alta Vista", lat: 31.5171, lng: -97.1198, zip: "76706" },
      { name: "Sanger Heights", lat: 31.5527, lng: -97.1588, zip: "76707" },
      { name: "Mountainview", lat: 31.535, lng: -97.1899, zip: "76710" },
      { name: "Kendrick", lat: 31.5175, lng: -97.1547, zip: "76711" },
    ],
  },
  {
    city: "Cedar Rapids",
    state: "IA",
    areas: [
      { name: "Oakhill Jackson", lat: 41.9743, lng: -91.6554, zip: "52401" },
      { name: "Noelridge Park", lat: 42.0188, lng: -91.6612, zip: "52402" },
      { name: "Southwest Area", lat: 41.9521, lng: -91.6853, zip: "52404" },
    ],
  },
  {
    city: "New Haven",
    state: "CT",
    areas: [
      { name: "Downtown", lat: 41.3087, lng: -72.9271, zip: "06510" },
      { name: "Dixwell", lat: 41.3184, lng: -72.9318, zip: "06511" },
      { name: "Fair Haven Heights", lat: 41.3072, lng: -72.8654, zip: "06513" },
      { name: "Amity", lat: 41.3293, lng: -72.9664, zip: "06515" },
      { name: "The Hill", lat: 41.2963, lng: -72.9373, zip: "06519" },
    ],
  },
  {
    city: "Roseville",
    state: "CA",
    areas: [
      { name: "Johnson Ranch", lat: 38.7346, lng: -121.234, zip: "95661" },
      { name: "Diamond Oaks", lat: 38.7609, lng: -121.2867, zip: "95678" },
      { name: "Quail Glen", lat: 38.7703, lng: -121.3372, zip: "95747" },
    ],
  },
  {
    city: "Coral Springs",
    state: "FL",
    areas: [
      { name: "City Center", lat: 26.2729, lng: -80.2603, zip: "33065" },
      { name: "Lakewood Village", lat: 26.2435, lng: -80.2601, zip: "33071" },
    ],
  },
  {
    city: "Stamford",
    state: "CT",
    areas: [
      { name: "Downtown", lat: 41.0531, lng: -73.539, zip: "06901" },
      { name: "Ridgeway-Bulls Head", lat: 41.0602, lng: -73.5445, zip: "06902" },
      { name: "North Stamford", lat: 41.1352, lng: -73.5684, zip: "06903" },
      { name: "Turn Of River-Newfield", lat: 41.0888, lng: -73.5435, zip: "06905" },
      { name: "Glenbrook-Belltown", lat: 41.0692, lng: -73.5236, zip: "06906" },
      { name: "Springdale", lat: 41.0942, lng: -73.5203, zip: "06907" },
    ],
  },
  {
    city: "East Los Angeles",
    state: "CA",
    areas: [
      { name: "City Center", lat: 34.0239, lng: -118.172 },
    ],
  },
  {
    city: "Sunset Park",
    state: "NY",
    areas: [
      { name: "City Center", lat: 40.6455, lng: -74.0124 },
    ],
  },
  {
    city: "Topeka",
    state: "KS",
    areas: [
      { name: "Ward Meade", lat: 39.0553, lng: -95.6802, zip: "66603" },
      { name: "Central Topeka 1", lat: 39.0583, lng: -95.7095, zip: "66606" },
      { name: "South/Southeast 3", lat: 38.9919, lng: -95.6681, zip: "66609" },
      { name: "Monroe", lat: 39.0427, lng: -95.6818, zip: "66612" },
      { name: "Oakland", lat: 39.0645, lng: -95.6413, zip: "66616" },
    ],
  },
  {
    city: "Abilene",
    state: "TX",
    areas: [
      { name: "Abilene Heights Area", lat: 32.4682, lng: -99.7182, zip: "79601" },
      { name: "Lytle Area", lat: 32.4178, lng: -99.7214, zip: "79602" },
      { name: "Westwood Richland", lat: 32.4679, lng: -99.7619, zip: "79603" },
      { name: "Elmwood Area", lat: 32.432, lng: -99.7724, zip: "79605" },
      { name: "Chimney Rock Area", lat: 32.392, lng: -99.7746, zip: "79606" },
    ],
  },
  {
    city: "Koreatown",
    state: "CA",
    areas: [
      { name: "City Center", lat: 34.0578, lng: -118.3009 },
    ],
  },
  {
    city: "Sheepshead Bay",
    state: "NY",
    areas: [
      { name: "City Center", lat: 40.5912, lng: -73.9446 },
    ],
  },
  {
    city: "Amherst",
    state: "NY",
    areas: [
      { name: "City Center", lat: 42.9784, lng: -78.7998 },
    ],
  },
  {
    city: "North Stamford",
    state: "CT",
    areas: [
      { name: "City Center", lat: 41.1382, lng: -73.5435 },
    ],
  },
  {
    city: "Hartford",
    state: "CT",
    areas: [
      { name: "Clay Arsenal", lat: 41.7801, lng: -72.6771, zip: "06101" },
      { name: "Downtown", lat: 41.7672, lng: -72.676, zip: "06103" },
      { name: "Asylum Hill", lat: 41.7691, lng: -72.701, zip: "06105" },
      { name: "South End", lat: 41.7403, lng: -72.6807, zip: "06114" },
      { name: "Northeast", lat: 41.786, lng: -72.6758, zip: "06120" },
    ],
  },
  {
    city: "Berkeley",
    state: "CA",
    areas: [
      { name: "Poets Corner", lat: 37.8656, lng: -122.2851, zip: "94702" },
      { name: "South Berkeley", lat: 37.863, lng: -122.2749, zip: "94703" },
      { name: "Southside", lat: 37.8664, lng: -122.257, zip: "94704" },
      { name: "Berkeley Hills", lat: 37.8927, lng: -122.2761, zip: "94707" },
      { name: "Cragmont", lat: 37.8918, lng: -122.2604, zip: "94708" },
      { name: "Northside", lat: 37.8784, lng: -122.2655, zip: "94709" },
    ],
  },
  {
    city: "West Palm Beach",
    state: "FL",
    areas: [
      { name: "Villages of Palm Beach Lakes", lat: 26.7162, lng: -80.0965, zip: "33409" },
    ],
  },
  {
    city: "Allentown",
    state: "PA",
    areas: [
      { name: "Hamilton District", lat: 40.6026, lng: -75.4691, zip: "18101" },
      { name: "Old Allentown", lat: 40.6068, lng: -75.4781, zip: "18102" },
      { name: "Fairview", lat: 40.5891, lng: -75.4645, zip: "18103" },
    ],
  },
  {
    city: "Evansville",
    state: "IN",
    areas: [
      { name: "Downtown", lat: 37.9718, lng: -87.572, zip: "47708" },
      { name: "Country Club Manor", lat: 38.0086, lng: -87.5746, zip: "47710" },
      { name: "Westside", lat: 37.929, lng: -87.6604, zip: "47712" },
      { name: "Goosetown", lat: 37.9623, lng: -87.5577, zip: "47713" },
      { name: "Rolling Greens", lat: 37.9678, lng: -87.4855, zip: "47715" },
    ],
  },
  {
    city: "Palm Bay",
    state: "FL",
    areas: [
      { name: "Port Malabar Industrial Park", lat: 28.0313, lng: -80.5995, zip: "32905" },
    ],
  },
  {
    city: "Fargo",
    state: "ND",
    areas: [
      { name: "South High", lat: 46.8564, lng: -96.8123, zip: "58103" },
      { name: "Maple Valley", lat: 46.7932, lng: -96.8397, zip: "58104" },
    ],
  },
  {
    city: "Billings",
    state: "MT",
    areas: [
      { name: "South Side", lat: 45.7745, lng: -108.5005, zip: "59101" },
    ],
  },
  {
    city: "Ann Arbor",
    state: "MI",
    areas: [
      { name: "Lakewood", lat: 42.2794, lng: -83.784, zip: "48103" },
      { name: "Burns Park", lat: 42.2694, lng: -83.7282, zip: "48104" },
      { name: "Logan", lat: 42.3042, lng: -83.7068, zip: "48105" },
      { name: "Mitchell", lat: 42.2328, lng: -83.7015, zip: "48108" },
    ],
  },
  {
    city: "Westminster",
    state: "CO",
    areas: [
      { name: "South Westminster", lat: 39.8302, lng: -105.037, zip: "80030" },
      { name: "East Central Westminster", lat: 39.8753, lng: -105.0345, zip: "80031" },
    ],
  },
  {
    city: "Round Rock",
    state: "TX",
    areas: [
      { name: "Brushy Slope Addition", lat: 30.5145, lng: -97.668, zip: "78664" },
      { name: "Round Rock Original Plat", lat: 30.5083, lng: -97.6789, zip: "78681" },
    ],
  },
  {
    city: "Wilmington",
    state: "NC",
    areas: [
      { name: "Historic District", lat: 34.2257, lng: -77.9447, zip: "28401" },
      { name: "St James Village", lat: 34.2237, lng: -77.8862, zip: "28403" },
      { name: "Whitehurst", lat: 34.1663, lng: -77.8723, zip: "28409" },
      { name: "Kirkland", lat: 34.3033, lng: -77.8039, zip: "28411" },
      { name: "Echo Farms", lat: 34.1572, lng: -77.9141, zip: "28412" },
    ],
  },
  {
    city: "Arvada",
    state: "CO",
    areas: [
      { name: "Arvada Plaza Area", lat: 39.7945, lng: -105.0984, zip: "80002" },
      { name: "South Westminster", lat: 39.8286, lng: -105.0655, zip: "80003" },
      { name: "Northwest Arvada", lat: 39.8141, lng: -105.1177, zip: "80004" },
      { name: "Meadowglen", lat: 39.8422, lng: -105.1097, zip: "80005" },
    ],
  },
  {
    city: "Beaumont",
    state: "TX",
    areas: [
      { name: "Oaks Historic District", lat: 30.0871, lng: -94.1254, zip: "77702" },
    ],
  },
  {
    city: "Provo",
    state: "UT",
    areas: [
      { name: "Franklin", lat: 40.2319, lng: -111.6755, zip: "84601" },
      { name: "Pleasant View", lat: 40.2607, lng: -111.6549, zip: "84604" },
      { name: "Joaquin", lat: 40.2347, lng: -111.6447, zip: "84606" },
    ],
  },
];

function normalizePlace(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function listServiceAreaCities(): CityServiceAreaCity[] {
  return CITY_SERVICE_AREAS;
}

export function findServiceAreaCity(
  city?: string,
  state?: string,
): CityServiceAreaCity | undefined {
  const name = city ? normalizePlace(city) : "";
  if (!name) return undefined;
  const code = state?.trim().toUpperCase();
  return CITY_SERVICE_AREAS.find((entry) => {
    if (code && entry.state !== code) return false;
    return normalizePlace(entry.city) === name;
  });
}

export function cityServiceAreaKey(city: string, state: string) {
  return `${city}|${state}`;
}

export function areasForServiceAreaCity(
  city?: string,
  state?: string,
): CityServiceAreaNeighborhood[] {
  return findServiceAreaCity(city, state)?.areas ?? [];
}
