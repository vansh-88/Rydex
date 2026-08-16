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

// A place suggestion for as-you-type search. Distinct from `Address`
// (a resolved single result) because a suggestion needs an id to key a list
// on and a short label to show in bold above the full address.
export interface PlaceSuggestion {
  id: string;
  name: string;
  formattedAddress: string;
  coordinates: Coordinates;
}

// claude.md §17: the Ride module depends only on this interface, never on
// a concrete provider (Mapbox/Geoapify/Google/...) directly.
export interface MapProvider {
  geocode(address: string): Promise<Coordinates>;
  reverseGeocode(coordinates: Coordinates): Promise<Address>;
  // Backs the client's From/To fields. Ride creation and ride search both
  // take coordinates and never free text (claude.md §18/§20/§23), so
  // something has to turn what a user types into a coordinate pair — this
  // is it. Returns [] for a query with no matches rather than throwing:
  // "no suggestions yet" is the normal state of a search box mid-keystroke,
  // not the error `geocode` treats it as.
  autocomplete(query: string, limit: number): Promise<PlaceSuggestion[]>;
  getRoute(origin: Coordinates, destination: Coordinates, waypoints?: Coordinates[]): Promise<Route>;
  getDistanceMatrix(origins: Coordinates[], destinations: Coordinates[]): Promise<DistanceMatrix>;
}
