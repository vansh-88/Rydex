// Mirrors of the backend DTOs. Kept as hand-written types rather than
// generated ones because the backend ships no OpenAPI spec (deliberately —
// backend/docs/steps.md §21 lists it as out of scope).
//
// Field names and enum values here must match the backend exactly; where a
// shape is easy to get wrong, the source file is named in a comment.

// Explicitly imported rather than relied on as a global: tsconfig.app.json
// pins `types: ["vite/client"]`, so ambient @types packages are not included.
import type { Geometry } from 'geojson';

export type UserRole = 'PASSENGER' | 'DRIVER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type DriverLicenseStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type VehicleType = 'HATCHBACK' | 'SEDAN' | 'SUV' | 'MUV';
export type VehicleStatus = 'ACTIVE' | 'INACTIVE';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type VehicleDocumentType = 'RC' | 'INSURANCE' | 'POLLUTION';
export type RideStatus =
  | 'PENDING_PAYMENT'
  | 'OPEN'
  | 'FULL'
  | 'STARTED'
  | 'COMPLETED'
  | 'CANCELLED';
export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED'
  | 'COMPLETED';
export type RatingRole = 'DRIVER' | 'PASSENGER';
export type TripScope = 'upcoming' | 'past';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

// --- auth -------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// POST /auth/refresh returns tokens only — no user object.
export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

// --- user -------------------------------------------------------------

export interface UserProfile {
  id: string;
  email: string;
  phone: string;
  name: string;
  profileImageUrl: string | null;
  role: UserRole;
  status: UserStatus;
  driverRatingAverage: number | null;
  driverRatingCount: number;
  passengerRatingAverage: number | null;
  passengerRatingCount: number;
  driverLicenseStatus: DriverLicenseStatus;
  driverLicenseRejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- vehicle ----------------------------------------------------------

export interface VehicleDocument {
  id: string;
  documentType: VehicleDocumentType;
  status: VerificationStatus;
  documentUrl: string;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  registrationNumber: string;
  make: string;
  model: string;
  variant: string | null;
  color: string | null;
  seatCapacity: number;
  vehicleType: VehicleType;
  isAc: boolean;
  isAcWorking: boolean | null;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
  // Present only on GET /vehicles/:id, never on the list.
  documents?: VehicleDocument[];
}

// --- ride -------------------------------------------------------------

// GET /rides/:id. Note routeGeometry is ~10KB of GeoJSON — detail only,
// never a list.
export interface Ride {
  id: string;
  driverId: string;
  vehicleId: string;
  origin: Coordinates & { address: string | null };
  destination: Coordinates & { address: string | null };
  departureTime: string;
  availableSeats: number;
  totalSeats: number;
  farePerSeat: number;
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: Geometry;
  postingCommissionAmount: number;
  // Lets a driver reopen checkout for a ride whose publish payment never
  // completed. Without it a PENDING_PAYMENT ride is unrecoverable.
  postingCommissionOrderId: string;
  status: RideStatus;
  createdAt: string;
  updatedAt: string;
}

// GET /rides/:id returns this — RideDto plus the driver and vehicle facts a
// passenger needs to decide, which the bare ride row does not carry.
export interface RideDetail extends Ride {
  driver: { id: string; name: string; rating: number | null };
  vehicle: {
    id: string;
    make: string;
    model: string;
    registrationNumber: string;
    vehicleType: VehicleType;
    isAc: boolean;
    seatCapacity: number;
  };
}

// GET /rides/search. Deliberately has no addresses and no geometry — the
// backend returns only how far each ride is from the points you asked about.
export interface RideSearchResult {
  id: string;
  departureTime: string;
  pickupDistanceKm: number;
  destinationDistanceKm: number;
  farePerSeat: number;
  availableSeats: number;
  driver: { id: string; name: string; rating: number | null };
  vehicle: { type: VehicleType; model: string; ac: boolean };
}

export type RideSearchSort =
  | 'DEPARTURE_TIME'
  | 'PICKUP_DISTANCE'
  | 'DESTINATION_DISTANCE'
  | 'FARE'
  | 'DRIVER_RATING';

export interface RideSearchParams {
  date: string;
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
  sort?: RideSearchSort;
  cursor?: string;
  limit?: number;
}

// POST /rides/preview — computed, not persisted. The figures are reproducible
// rather than estimated: fare depends only on route distance, vehicle type and
// driver rating, so creating the ride yields the same numbers.
export interface RidePreview {
  distanceMeters: number;
  durationSeconds: number;
  routeGeometry: Geometry;
  farePerSeat: number;
  totalSeats: number;
  postingCommissionAmount: number;
  currency: string;
}

// GET /rides/mine
export interface RideListItem {
  id: string;
  originAddress: string | null;
  destinationAddress: string | null;
  departureTime: string;
  availableSeats: number;
  totalSeats: number;
  farePerSeat: number;
  status: RideStatus;
  vehicle: { make: string; model: string; registrationNumber: string };
  confirmedBookingCount: number;
}

// --- booking ----------------------------------------------------------

export interface Booking {
  id: string;
  rideId: string;
  passengerId: string;
  seatCount: number;
  pickup: Coordinates;
  drop: Coordinates;
  farePerSeat: number;
  totalFare: number;
  prepaidAmount: number;
  prepaymentOrderId: string | null;
  finalPaymentOrderId: string | null;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
}

// GET /bookings — a booking plus enough of its ride to render a trip card
// without a follow-up fetch.
export interface BookingWithRide extends Booking {
  ride: {
    id: string;
    originAddress: string | null;
    destinationAddress: string | null;
    departureTime: string;
    status: RideStatus;
    driver: { id: string; name: string; rating: number | null };
  };
}

// GET /rides/:id/bookings — the driver's passenger list. `phone` is released
// only once the booking is CONFIRMED or COMPLETED.
export interface RideBooking {
  id: string;
  seatCount: number;
  pickup: Coordinates;
  drop: Coordinates;
  totalFare: number;
  prepaidAmount: number;
  status: BookingStatus;
  createdAt: string;
  passenger: { id: string; name: string; rating: number | null; phone: string | null };
}

export interface PaymentOrder {
  providerOrderId: string;
  amount: number;
  currency: string;
}

// --- rating -----------------------------------------------------------

export interface Rating {
  id: string;
  rideId: string;
  bookingId: string;
  raterId: string;
  rateeId: string;
  rateeRole: RatingRole;
  score: number;
  comment: string | null;
  createdAt: string;
}

// --- chat / notifications --------------------------------------------

export interface Conversation {
  id: string;
  rideId: string;
  counterpart: { id: string; name: string };
  lastMessage: { message: string; senderId: string; createdAt: string } | null;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  message: string;
  // Never written by any backend path today — no read receipts.
  readAt: string | null;
  createdAt: string;
}

export type NotificationType =
  | 'RIDE_BOOKED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'RIDE_CANCELLED'
  | 'RIDE_STARTING'
  | 'RIDE_COMPLETED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'REFUND_PROCESSED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string> | null;
  readAt: string | null;
  createdAt: string;
}

// --- places -----------------------------------------------------------

export interface PlaceSuggestion {
  id: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

// --- support ----------------------------------------------------------

export type SupportConversationStatus = 'OPEN' | 'RESOLVED' | 'ESCALATED';
export type SupportMessageRole = 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';

export interface SupportConversation {
  id: string;
  status: SupportConversationStatus;
  lastMessageAt: string;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  role: SupportMessageRole;
  content: string | null;
  createdAt: string;
}

// --- admin ------------------------------------------------------------

export interface PendingDriverApplication {
  userId: string;
  name: string;
  email: string;
  phone: string;
  submittedAt: string;
  licenseDocumentUrl: string | null;
}

export interface VehicleReview {
  owner: { id: string; name: string; email: string; phone: string };
  vehicle: Vehicle;
}
