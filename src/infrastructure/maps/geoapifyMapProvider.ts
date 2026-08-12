import { AppError } from '../../shared/errors/AppError.js';
import type { Address, Coordinates, DistanceMatrix, MapProvider, Route } from './mapProvider.js';

const GEOAPIFY_BASE_URL = 'https://api.geoapify.com/v1';

interface GeoapifyGeocodeResult {
  lat: number;
  lon: number;
  formatted: string;
}

interface GeoapifyGeocodeResponse {
  results: GeoapifyGeocodeResult[];
}

interface GeoapifyRoutingResponse {
  features: {
    properties: {
      distance: number;
      time: number;
    };
    geometry: unknown;
  }[];
}

interface GeoapifyMatrixCell {
  distance: number;
  time: number;
  source_index: number;
  target_index: number;
}

interface GeoapifyMatrixResponse {
  sources_to_targets: GeoapifyMatrixCell[][];
}

function toWaypointParam(point: Coordinates): string {
  return `${point.latitude},${point.longitude}`;
}

function toMatrixLocation(point: Coordinates): { location: [number, number] } {
  return { location: [point.longitude, point.latitude] };
}

// claude.md §17-style strategy implementation. This is Rydex's initial
// MapProvider (Geoapify instead of the originally-named Mapbox — see the
// Architecture Change Log entry recording why: Mapbox's signup flow now
// requires a payment method even for free-tier usage).
export class GeoapifyMapProvider implements MapProvider {
  constructor(private readonly apiKey: string) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const separator = path.includes('?') ? '&' : '?';
    const url = `${GEOAPIFY_BASE_URL}${path}${separator}apiKey=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, init);
    } catch {
      throw new AppError(502, 'MAP_PROVIDER_ERROR', 'Failed to reach the map provider');
    }

    if (!response.ok) {
      throw new AppError(502, 'MAP_PROVIDER_ERROR', `Map provider request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async geocode(address: string): Promise<Coordinates> {
    const data = await this.request<GeoapifyGeocodeResponse>(
      `/geocode/search?text=${encodeURIComponent(address)}&format=json&limit=1`,
    );

    const result = data.results[0];
    if (!result) {
      throw new AppError(404, 'GEOCODE_NOT_FOUND', `No geocoding result for "${address}"`);
    }

    return { latitude: result.lat, longitude: result.lon };
  }

  async reverseGeocode(coordinates: Coordinates): Promise<Address> {
    const data = await this.request<GeoapifyGeocodeResponse>(
      `/geocode/reverse?lat=${coordinates.latitude}&lon=${coordinates.longitude}&format=json`,
    );

    const result = data.results[0];
    if (!result) {
      throw new AppError(404, 'GEOCODE_NOT_FOUND', 'No address found for the given coordinates');
    }

    return {
      formattedAddress: result.formatted,
      coordinates: { latitude: result.lat, longitude: result.lon },
    };
  }

  async getRoute(origin: Coordinates, destination: Coordinates, waypoints: Coordinates[] = []): Promise<Route> {
    const points = [origin, ...waypoints, destination].map(toWaypointParam).join('|');
    const data = await this.request<GeoapifyRoutingResponse>(`/routing?waypoints=${points}&mode=drive`);

    const feature = data.features[0];
    if (!feature) {
      throw new AppError(422, 'ROUTE_NOT_FOUND', 'No route could be calculated between the given points');
    }

    return {
      distanceMeters: Math.round(feature.properties.distance),
      durationSeconds: Math.round(feature.properties.time),
      geometry: JSON.stringify(feature.geometry),
    };
  }

  async getDistanceMatrix(origins: Coordinates[], destinations: Coordinates[]): Promise<DistanceMatrix> {
    const data = await this.request<GeoapifyMatrixResponse>('/routematrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'drive',
        sources: origins.map(toMatrixLocation),
        targets: destinations.map(toMatrixLocation),
      }),
    });

    const elements = data.sources_to_targets.map((row) =>
      row.map((cell) => ({
        distanceMeters: Math.round(cell.distance),
        durationSeconds: Math.round(cell.time),
      })),
    );

    return { elements };
  }
}
