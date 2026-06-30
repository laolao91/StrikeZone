export interface Stadium {
  team: string
  name: string
  lat: number
  lng: number
}

export const STADIUMS: Stadium[] = [
  { team: 'ARI', name: 'Chase Field',              lat: 33.4453,  lng: -112.0667 },
  { team: 'ATL', name: 'Truist Park',              lat: 33.8908,  lng: -84.4678  },
  { team: 'BAL', name: 'Oriole Park',              lat: 39.2838,  lng: -76.6218  },
  { team: 'BOS', name: 'Fenway Park',              lat: 42.3467,  lng: -71.0972  },
  { team: 'CHC', name: 'Wrigley Field',            lat: 41.9484,  lng: -87.6553  },
  { team: 'CWS', name: 'Guaranteed Rate Field',    lat: 41.8300,  lng: -87.6338  },
  { team: 'CIN', name: 'Great American Ball Park', lat: 39.0979,  lng: -84.5082  },
  { team: 'CLE', name: 'Progressive Field',        lat: 41.4962,  lng: -81.6852  },
  { team: 'COL', name: 'Coors Field',              lat: 39.7559,  lng: -104.9942 },
  { team: 'DET', name: 'Comerica Park',            lat: 42.3390,  lng: -83.0485  },
  { team: 'HOU', name: 'Minute Maid Park',         lat: 29.7573,  lng: -95.3555  },
  { team: 'KC',  name: 'Kauffman Stadium',         lat: 39.0517,  lng: -94.4803  },
  { team: 'LAA', name: 'Angel Stadium',            lat: 33.8003,  lng: -117.8827 },
  { team: 'LAD', name: 'Dodger Stadium',           lat: 34.0739,  lng: -118.2400 },
  { team: 'MIA', name: 'loanDepot park',           lat: 25.7781,  lng: -80.2197  },
  { team: 'MIL', name: 'American Family Field',    lat: 43.0280,  lng: -87.9712  },
  { team: 'MIN', name: 'Target Field',             lat: 44.9817,  lng: -93.2781  },
  { team: 'NYM', name: 'Citi Field',               lat: 40.7571,  lng: -73.8458  },
  { team: 'NYY', name: 'Yankee Stadium',           lat: 40.8296,  lng: -73.9262  },
  { team: 'OAK', name: 'Oakland Coliseum',         lat: 37.7516,  lng: -122.2005 },
  { team: 'PHI', name: 'Citizens Bank Park',       lat: 39.9061,  lng: -75.1665  },
  { team: 'PIT', name: 'PNC Park',                 lat: 40.4469,  lng: -80.0057  },
  { team: 'SD',  name: 'Petco Park',               lat: 32.7076,  lng: -117.1570 },
  { team: 'SEA', name: 'T-Mobile Park',            lat: 47.5914,  lng: -122.3325 },
  { team: 'SF',  name: 'Oracle Park',              lat: 37.7786,  lng: -122.3893 },
  { team: 'STL', name: 'Busch Stadium',            lat: 38.6226,  lng: -90.1928  },
  { team: 'TB',  name: 'Tropicana Field',          lat: 27.7683,  lng: -82.6534  },
  { team: 'TEX', name: 'Globe Life Field',         lat: 32.7473,  lng: -97.0825  },
  { team: 'TOR', name: 'Rogers Centre',            lat: 43.6414,  lng: -79.3894  },
  { team: 'WSH', name: 'Nationals Park',           lat: 38.8730,  lng: -77.0074  },
]

const EARTH_RADIUS_M = 6_371_000

function toRad(deg: number): number {
  return deg * Math.PI / 180
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface NearbyResult {
  team: string
  stadiumName: string
  distanceMeters: number
}

// Returns stadiums within radiusMeters of the given coordinates, nearest first.
export function nearbyTeams(lat: number, lng: number, radiusMeters = 1500): NearbyResult[] {
  return STADIUMS
    .map(s => ({ team: s.team, stadiumName: s.name, distanceMeters: distanceMeters(lat, lng, s.lat, s.lng) }))
    .filter(s => s.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
}
