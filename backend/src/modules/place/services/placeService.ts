import { mapProvider } from '../../../infrastructure/maps/index.js';
import type { PlaceSuggestion } from '../../../infrastructure/maps/mapProvider.js';

const DEFAULT_SUGGESTION_LIMIT = 5;

export interface PlaceSuggestionDto {
  id: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

// Flattened coordinates rather than the provider's nested shape: every
// consumer (ride search query params, createRide's origin/destination) wants
// the numbers directly, and this keeps the wire format the same as the rest
// of the API's coordinate handling.
function toDto(suggestion: PlaceSuggestion): PlaceSuggestionDto {
  return {
    id: suggestion.id,
    name: suggestion.name,
    formattedAddress: suggestion.formattedAddress,
    latitude: suggestion.coordinates.latitude,
    longitude: suggestion.coordinates.longitude,
  };
}

// claude.md §17/§37: the module depends on the MapProvider interface, never
// on Geoapify directly — the same arrangement rideService already uses for
// getRoute.
export async function autocomplete(
  query: string,
  limit: number | undefined,
): Promise<{ items: PlaceSuggestionDto[] }> {
  const suggestions = await mapProvider.autocomplete(query, limit ?? DEFAULT_SUGGESTION_LIMIT);
  return { items: suggestions.map(toDto) };
}
