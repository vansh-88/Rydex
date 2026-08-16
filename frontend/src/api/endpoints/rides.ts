import { apiRequest, withQuery } from '@/api/client';
import type {
  Paginated,
  PlaceSuggestion,
  Ride,
  RideBooking,
  RideDetail,
  RideListItem,
  RideSearchParams,
  RideSearchResult,
  TripScope,
} from '@/api/types';

export function autocompletePlaces(
  query: string,
  signal?: AbortSignal,
  limit = 5,
): Promise<{ items: PlaceSuggestion[] }> {
  return apiRequest(withQuery('/places/autocomplete', { q: query, limit }), { signal });
}

export function searchRides(
  params: RideSearchParams,
  signal?: AbortSignal,
): Promise<Paginated<RideSearchResult>> {
  return apiRequest(withQuery('/rides/search', { ...params }), { signal });
}

export function getRide(rideId: string, signal?: AbortSignal): Promise<RideDetail> {
  return apiRequest(`/rides/${rideId}`, { signal });
}

export function listMyRides(
  scope: TripScope,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<Paginated<RideListItem>> {
  return apiRequest(withQuery('/rides/mine', { scope, cursor }), { signal });
}

export function listRideBookings(
  rideId: string,
  signal?: AbortSignal,
): Promise<{ items: RideBooking[] }> {
  return apiRequest(`/rides/${rideId}/bookings`, { signal });
}

export function cancelRide(rideId: string): Promise<Ride> {
  return apiRequest(`/rides/${rideId}/cancel`, { method: 'POST' });
}

export function startRide(rideId: string): Promise<Ride> {
  return apiRequest(`/rides/${rideId}/start`, { method: 'POST' });
}

export function completeRide(rideId: string): Promise<Ride> {
  return apiRequest(`/rides/${rideId}/complete`, { method: 'POST' });
}
