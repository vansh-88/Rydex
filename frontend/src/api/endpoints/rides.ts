import { apiRequest, withQuery } from '@/api/client';
import type {
  Coordinates,
  Paginated,
  PaymentOrder,
  RidePreview,
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

export interface CreateRideInput {
  origin: Coordinates;
  originAddress?: string;
  destination: Coordinates;
  destinationAddress?: string;
  departureTime: string;
  vehicleId: string;
  availableSeats: number;
}

// Dry run: same inputs as createRide, but nothing is written and no payment
// order is created. Used to show the driver the fare and the posting fee
// before they commit to paying it.
export function previewRide(input: CreateRideInput, signal?: AbortSignal): Promise<RidePreview> {
  return apiRequest('/rides/preview', { method: 'POST', body: input, signal });
}

export function createRide(
  input: CreateRideInput,
  idempotencyKey: string,
): Promise<{ ride: Ride; paymentOrder: PaymentOrder }> {
  return apiRequest('/rides', { method: 'POST', body: input, idempotencyKey });
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
