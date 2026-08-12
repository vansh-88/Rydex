export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  formattedAddress: string;
  coordinates: Coordinates;
}

export interface Route {
  distanceMeters: number;
  durationSeconds: number;
  // GeoJSON geometry, stored as-is (claude.md §15 `route_geometry`). The
  // exact shape is provider-defined — callers treat it as opaque.
  geometry: string;
}

export interface DistanceMatrixCell {
  distanceMeters: number;
  durationSeconds: number;
}

export interface DistanceMatrix {
  // elements[i][j] = distance/duration from origins[i] to destinations[j].
  elements: DistanceMatrixCell[][];
}

// claude.md §17: the Ride module depends only on this interface, never on
// a concrete provider (Mapbox/Geoapify/Google/...) directly.
export interface MapProvider {
  geocode(address: string): Promise<Coordinates>;
  reverseGeocode(coordinates: Coordinates): Promise<Address>;
  getRoute(origin: Coordinates, destination: Coordinates, waypoints?: Coordinates[]): Promise<Route>;
  getDistanceMatrix(origins: Coordinates[], destinations: Coordinates[]): Promise<DistanceMatrix>;
}
