import { apiRequest, withQuery } from '@/api/client';
import type {
  Booking,
  BookingWithRide,
  Coordinates,
  Paginated,
  PaymentOrder,
  Rating,
  TripScope,
} from '@/api/types';

export interface CreateBookingInput {
  seatCount: number;
  // Omitted means "board and alight at the ride's own endpoints", which is
  // what the backend defaults to.
  pickup?: Coordinates;
  drop?: Coordinates;
}

export function createBooking(
  rideId: string,
  input: CreateBookingInput,
  idempotencyKey: string,
): Promise<{ booking: Booking; paymentOrder: PaymentOrder }> {
  return apiRequest(`/rides/${rideId}/bookings`, {
    method: 'POST',
    body: input,
    idempotencyKey,
  });
}

export function getBooking(bookingId: string, signal?: AbortSignal): Promise<Booking> {
  return apiRequest(`/bookings/${bookingId}`, { signal });
}

export function listMyBookings(
  scope: TripScope,
  cursor: string | undefined,
  signal?: AbortSignal,
): Promise<Paginated<BookingWithRide>> {
  return apiRequest(withQuery('/bookings', { scope, cursor }), { signal });
}

export function cancelBooking(bookingId: string): Promise<Booking> {
  return apiRequest(`/bookings/${bookingId}/cancel`, { method: 'POST' });
}

export function submitRating(
  bookingId: string,
  input: { score: number; comment?: string },
): Promise<Rating> {
  return apiRequest(`/bookings/${bookingId}/ratings`, { method: 'POST', body: input });
}

export function listRatings(
  bookingId: string,
  signal?: AbortSignal,
): Promise<{ items: Rating[] }> {
  return apiRequest(`/bookings/${bookingId}/ratings`, { signal });
}
