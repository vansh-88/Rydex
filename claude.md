# Rydex --- Production-Oriented Architecture & Engineering Specification

> **Purpose:** This document is the source of truth for building the
> Rydex carpooling application.
>
> **Important:** Read this entire document before writing application
> code. Do not replace architectural decisions with simpler alternatives
> unless a requirement is technically impossible or a documented
> decision is made first.

------------------------------------------------------------------------

## 1. Product Overview

Rydex is an India-focused carpooling / ride-sharing application.

Two user roles exist:

-   `DRIVER`
-   `PASSENGER`

A driver can create a ride with an origin, destination, optional
waypoints, departure time, vehicle, seats, and fare.

A passenger searches rides by:

-   date
-   pickup location
-   destination location

The passenger does **not** specify a time range during search.

A ride matches when:

-   its departure date is the requested date,
-   its origin is within approximately **10 km** of the passenger
    pickup,
-   its destination is within approximately **10 km** of the passenger
    destination,
-   the ride is bookable,
-   seats are available.

All matching rides remain discoverable. The passenger can sort the
result set.

Supported sorting should include:

-   departure time
-   pickup distance
-   destination distance
-   fare
-   driver rating

The search radius must be configuration-driven, not hard-coded.

------------------------------------------------------------------------

## 2. Core Architectural Decision

## Use a Modular Monolith

Do **not** initially implement six independently deployed microservices.

The logical services/modules are:

1.  Auth/User
2.  Vehicle
3.  Ride
4.  Booking
5.  Payment
6.  Notification

They run inside one Node.js application initially.

``` text
                    Rydex Backend
                         |
        +----------------+----------------+
        |                |                |
       Auth             User            Vehicle
        |                |                |
        +----------------+----------------+
                         |
                        Ride
                         |
                      Booking
                         |
                      Payment
                         |
                    Notification
```

Supporting infrastructure:

``` text
PostgreSQL + PostGIS
Redis
BullMQ
Cloudinary
Resend
FCM
Map Provider
Payment Provider
```

The modules must remain strongly separated so that a future module can
be extracted into a service without rewriting the domain.

### Do not introduce initially

-   Kubernetes
-   Kafka
-   service mesh
-   distributed transactions
-   six independent backend repositories
-   unnecessary event brokers
-   CQRS
-   event sourcing
-   GraphQL unless explicitly required

The target is approximately **10K users**, so correctness,
maintainability, security, and clean domain boundaries matter more than
premature distributed scaling.

------------------------------------------------------------------------

## 3. Technology Stack

### Backend

-   Node.js
-   TypeScript
-   Express
-   Prisma ORM
-   PostgreSQL
-   PostGIS
-   Redis
-   BullMQ

### Authentication

-   OTP-based authentication
-   Resend for OTP email delivery
-   short-lived access token
-   rotating refresh token

### Notifications

-   Firebase Cloud Messaging (FCM)
-   BullMQ workers
-   Redis

### Documents / Images

-   Cloudinary

### Maps

Use the **Strategy Pattern**.

``` text
MapProvider
   |
   +-- MapboxProvider
   |
   +-- GoogleMapsProvider (future)
```

Business logic must depend on `MapProvider`, never directly on
Mapbox/Google APIs.

### Payments

Use the **Strategy / Adapter Pattern**.

``` text
PaymentProvider
   |
   +-- RazorpayProvider
   |
   +-- FutureProvider
```

The application domain must not directly depend on a payment vendor.

------------------------------------------------------------------------

## 4. High-Level Architecture

``` text
                    Mobile / Web Client
                            |
                          HTTPS
                            |
                     Load Balancer
                            |
                    Node.js / Express
                    Modular Monolith
                            |
       +--------------------+--------------------+
       |         |           |         |         |
      Auth      User       Vehicle    Ride    Booking
       |         |           |         |          |
       +---------+-----------+---------+----------+
                                      |
                                   Payment
                                      |
                                Notification
                                      |
                                    BullMQ
                                      |
                                    Redis

                    +-------------------------+
                    | PostgreSQL + PostGIS    |
                    +-------------------------+

External integrations:

Node Backend
  |
  +-- Resend
  +-- FCM
  +-- Cloudinary
  +-- Payment Provider
  +-- Map Provider
```

------------------------------------------------------------------------

## 5. Architectural Principles

Follow these principles throughout the codebase.

### 5.1 Separation of concerns

Controllers should not contain business logic.

Bad:

``` text
controller
  -> database query
  -> calculate fare
  -> call payment provider
  -> send notification
```

Good:

``` text
Controller
    |
Application Service
    |
Domain / business logic
    |
Repository / infrastructure
```

### 5.2 Dependency inversion

Domain/application code should depend on interfaces.

Example:

``` typescript
interface MapProvider {
  getRoute(...): Promise<Route>;
}
```

Do not directly instantiate `MapboxProvider` inside `RideService`.

Dependency injection should provide the implementation.

### 5.3 Explicit state transitions

Do not allow arbitrary updates to status fields.

Use methods/use cases such as:

``` text
createRide()
cancelRide()
startRide()
completeRide()

createBooking()
confirmBooking()
cancelBooking()

processPayment()
refundPayment()
```

Every transition must validate the current state.

### 5.4 Database is source of truth

Redis is not the primary database.

PostgreSQL is authoritative for:

-   users
-   vehicles
-   rides
-   bookings
-   payments
-   transactions
-   ratings
-   notifications
-   refresh tokens
-   idempotency records

Redis is for:

-   OTPs
-   rate limiting
-   temporary reservations/cache
-   BullMQ
-   short-lived data

### 5.5 External calls are not part of DB transactions

Never do:

``` text
BEGIN
  DB update
  FCM request
  payment API request
COMMIT
```

Instead:

``` text
BEGIN
  DB changes
COMMIT

enqueue async work
```

External calls must be retryable and idempotent.

------------------------------------------------------------------------

## 6. Domain Entities

Initial domain entities:

``` text
User
UserDocument
Vehicle
VehicleDocument
Ride
RideWaypoint
Booking
Payment
Transaction
IdempotencyKey
Rating
Notification
UserDevice
Conversation
Message
RefreshToken
```

There is intentionally no:

-   wallet
-   coupon
-   support ticket
-   blocked-user system
-   report/abuse system
-   audit-log system
-   monthly pass
-   SOS system
-   cab marketplace
-   DigiLocker integration

These are out of scope.

Normal application/operational logs are still required. "No audit logs"
does not mean "no logging."

------------------------------------------------------------------------

## 7. User Module

### Responsibilities

-   user creation
-   profile
-   authentication integration
-   role management
-   driver eligibility checks
-   ratings summary
-   user status

### User fields

Conceptually:

``` text
users
-----
id UUID PK

email
phone
name
profile_image_url

role
status

rating_average
rating_count

created_at
updated_at
```

Use UUIDs.

Use database uniqueness for:

-   email
-   phone

Do not trust application-level uniqueness checks alone.

------------------------------------------------------------------------

## 8. Roles

Roles:

``` text
DRIVER
PASSENGER
ADMIN
```

Do not create separate user tables. `ADMIN` is a third value on the
same `role` column as `DRIVER`/`PASSENGER` — not a separate table or
auth system.

Admin accounts are **not** self-registered. They are provisioned
directly (seed script / manual database insert) and authenticate
through the same OTP login flow as everyone else. See §96 (Admin
Module) for responsibilities and endpoints.

### Becoming a DRIVER

Every signup lands as `PASSENGER` (§9). A `PASSENGER` becomes a
`DRIVER` only through the driving-license verification flow:

``` text
PASSENGER
    |
    | submits a driving-license document
    v
driver_license_status = PENDING
    |
    | admin reviews via the Admin Module (§96)
    |
    +-- approved --> role -> DRIVER, driver_license_status = VERIFIED
    |
    +-- rejected --> driver_license_status = REJECTED
                      (may resubmit; role stays PASSENGER)
```

There is no self-serve role upgrade — a `PASSENGER` cannot set
`role = DRIVER` themselves, and the license document alone does not
grant it. Only an admin approval (§96) flips the role, atomically with
`driver_license_status -> VERIFIED`, in the same transaction.

A role change does not retroactively fix an already-issued access
token (tokens are stateless and short-lived, §10). The user's next
`POST /auth/refresh` re-reads their role from the database and issues
an access token reflecting it — no extra mechanism is needed beyond
the rotation behavior already required by §11.

Driver-only operations must check driver eligibility.

For example, creating a ride requires:

``` text
user.role == DRIVER
AND
vehicle.owner_id == user.id
AND
vehicle.status == ACTIVE
AND
vehicle.verification_status == VERIFIED
AND
vehicle.seat_capacity >= requested seats
```

**Reversal of an earlier decision (see §97, 2026-08-11):** vehicle
`verification_status` now **gates** ride creation — a vehicle must be
admin-verified (§96) before it can be selected to create a ride. An
earlier draft of this document said the opposite ("verification is a
trust signal, not a gate"); that language is superseded by this
section and by §96/§97. `verification_status` is still tracked and
shown to passengers/drivers as before, but `PENDING`/`REJECTED`
vehicles are no longer ride-eligible.

------------------------------------------------------------------------

## 9. Authentication

### OTP Login

Flow:

``` text
Client
  |
  | request OTP
  v
Backend
  |
  +-- generate OTP
  +-- hash OTP
  +-- store hash in Redis
  +-- send via Resend
  |
  v
Email

Client
  |
  | verify OTP
  v
Backend
  |
  +-- verify Redis OTP
  +-- create/find user
  +-- issue access token
  +-- issue refresh token
```

### OTP storage

Never store the plaintext OTP.

Use Redis:

``` text
otp:{purpose}:{identifier}
```

Example:

``` text
otp:login:user@example.com
```

Value should contain:

``` text
otp_hash
attempt_count
purpose
```

TTL should be short, for example 5 minutes.

Use configurable values.

### OTP protections

Implement:

-   expiry
-   maximum verification attempts
-   resend cooldown
-   per-email rate limiting
-   per-IP rate limiting
-   endpoint throttling

Do not leak whether an email/phone account exists where that would
create an account-enumeration problem.

------------------------------------------------------------------------

## 10. Access Tokens

Use a short-lived access token.

Recommended initial lifetime:

``` text
15 minutes
```

Claims should be minimal:

``` json
{
  "sub": "user-id",
  "role": "DRIVER",
  "type": "access"
}
```

Do not put sensitive or frequently changing user data inside the token.

------------------------------------------------------------------------

## 11. Refresh Tokens

Use long-lived rotating refresh tokens.

Recommended lifetime:

``` text
30 days
```

Store a **hash** of the refresh token in PostgreSQL.

``` text
refresh_tokens
--------------
id
user_id
token_hash
device_id
expires_at
revoked_at
created_at
```

### Rotation

``` text
RT1
 |
 | refresh
 v
revoke RT1
 |
create RT2
 |
 v
client receives RT2
```

If a revoked refresh token is reused, treat it as suspicious token reuse
and revoke the relevant token family/session.

Support:

-   logout current session
-   refresh
-   token rotation
-   revocation
-   optional logout-all-devices

------------------------------------------------------------------------

## 12. Vehicle Module

### Responsibilities

-   vehicle registration
-   vehicle ownership
-   vehicle details
-   vehicle document uploads
-   vehicle eligibility
-   vehicle status

Relationship:

``` text
User 1 ---- N Vehicle
```

Conceptual fields:

``` text
vehicles
--------
id UUID PK
owner_id FK users

registration_number
make
model
variant
color

seat_capacity
vehicle_type

is_ac
is_ac_working

verification_status   -- PENDING | VERIFIED | REJECTED
verified_by            -- FK users (admin), nullable
verified_at            -- nullable
rejection_reason       -- nullable, set when REJECTED
status

created_at
updated_at
```

Vehicle registration number should have appropriate uniqueness
constraints.

A ride references one vehicle.

------------------------------------------------------------------------

## 13. Documents

Documents are stored in Cloudinary.

PostgreSQL stores metadata/reference information.

Never store actual document binary data in PostgreSQL.

Conceptual:

``` text
user_documents
--------------
id
user_id
document_type
cloudinary_public_id
secure_url
status
created_at
updated_at
```

Vehicle documents can similarly reference:

``` text
RC
INSURANCE
POLLUTION
```

The current version intentionally does not integrate DigiLocker.

An admin verification workflow **is** in scope (see §96 — Admin
Module): admins manually review uploaded documents via a dashboard and
set `verification_status`. This does not currently gate ride creation
(see §8) — it is a trust/visibility signal, not a hard requirement,
until product policy says otherwise.

Do not hard-code the assumption that every uploaded document is
permanently trusted.

------------------------------------------------------------------------

## 14. Cloudinary Upload Security

Implement:

-   allowed file types
-   maximum file size
-   server-side metadata validation
-   safe upload configuration
-   appropriate signed/private delivery for sensitive documents
-   never trust client-provided MIME type alone
-   do not expose unrestricted document access

The database should store Cloudinary identifiers, not arbitrary
client-supplied URLs.

------------------------------------------------------------------------

## 15. Ride Module

The Ride module is the core business domain.

Responsibilities:

-   ride creation
-   route calculation
-   fare calculation
-   ride search
-   ride matching
-   ride lifecycle
-   cancellation
-   start
-   completion
-   seat availability

Conceptual fields:

``` text
rides
-----
id UUID PK

driver_id FK users
vehicle_id FK vehicles

origin geography(Point, 4326)
destination geography(Point, 4326)

departure_time TIMESTAMPTZ

available_seats
total_seats

fare_per_seat

distance_meters
duration_seconds

route_geometry

status

created_at
updated_at
```

------------------------------------------------------------------------

## 16. PostGIS

Use:

``` text
geography(Point, 4326)
```

for origin and destination.

Create spatial GiST indexes.

Conceptually:

``` sql
CREATE INDEX idx_rides_origin_gist
ON rides USING GIST(origin);

CREATE INDEX idx_rides_destination_gist
ON rides USING GIST(destination);
```

Use PostGIS functions for geographic distance and radius filtering.

Do not calculate geographic distance in JavaScript for the primary
search query.

------------------------------------------------------------------------

## 17. Map Provider Strategy

Create:

``` typescript
interface MapProvider {
  geocode(address: string): Promise<Coordinates>;

  reverseGeocode(
    coordinates: Coordinates
  ): Promise<Address>;

  getRoute(
    origin: Coordinates,
    destination: Coordinates,
    waypoints?: Coordinates[]
  ): Promise<Route>;

  getDistanceMatrix(
    origins: Coordinates[],
    destinations: Coordinates[]
  ): Promise<DistanceMatrix>;
}
```

The ride module depends only on this interface.

**Updated 2026-08-12 (see §97 Architecture Change Log):** the initial
implementation is **Geoapify**, not Mapbox as originally drafted here —
Mapbox's signup flow now requires a payment method before any free-tier
usage, which conflicts with a hard product constraint of no card on file
with any mapping/location vendor. Geoapify's free tier (3,000
credits/day, no card) covers geocoding, routing, and distance-matrix
needs at Rydex's target scale (§92). This is a provider swap only — the
interface below, and the "must be replaceable" requirement, are
unchanged, and Mapbox/Google remain valid future targets if the card
constraint is ever lifted.

The provider must be replaceable.

------------------------------------------------------------------------

## 18. Ride Creation

Driver sends:

``` text
origin
destination
waypoints
departureTime
vehicleId
availableSeats
```

Flow:

``` text
1.  Authenticate driver
2.  Verify role
3.  Verify vehicle ownership
4.  Verify vehicle eligibility (§8: ownership + ACTIVE + seat capacity)
5.  Validate departure time
6.  Validate seats
7.  Call MapProvider.getRoute()
8.  Store distance/duration/polyline
9.  Calculate heuristic fare
10. Calculate driver posting commission
11. Persist ride in PENDING_PAYMENT status (see §19)
12. Create payment order for the posting commission (PaymentProvider)
13. Return ride + payment order to the client
14. Publish relevant async events/jobs
```

Payment confirmation is asynchronous and webhook-driven (§40). The
ride does **not** become `OPEN` synchronously within this request —
the webhook handler transitions `PENDING_PAYMENT -> OPEN` once the
commission payment is confirmed (or `PENDING_PAYMENT -> CANCELLED` if
it fails/expires). This mirrors the Booking module's
`PENDING_PAYMENT -> CONFIRMED` pattern (§33) and keeps ride creation
consistent with "frontend success is never authoritative" (§40).

Do not call FCM inside the DB transaction.

------------------------------------------------------------------------

## 19. Ride Status

Use an explicit state machine.

Initial statuses:

``` text
PENDING_PAYMENT
OPEN
FULL
STARTED
COMPLETED
CANCELLED
```

`PENDING_PAYMENT` exists because ride creation requires the driver's
5% posting commission (§30), and payment confirmation is asynchronous
/ webhook-driven (§40) — a ride cannot become searchable (`OPEN`)
within the same request that created it. This mirrors Booking's
`PENDING_PAYMENT` state (§33).

Potential transitions:

``` text
PENDING_PAYMENT -> OPEN         (posting commission payment confirmed)
PENDING_PAYMENT -> CANCELLED    (payment failed or reservation expired)

OPEN -> FULL
OPEN -> STARTED
OPEN -> CANCELLED

FULL -> OPEN
FULL -> STARTED
FULL -> CANCELLED

STARTED -> COMPLETED
```

A ride in `PENDING_PAYMENT` is never returned by search (§20-22) —
only `OPEN`/`FULL` are searchable, and even then only with
`available_seats > 0`.

Do not allow arbitrary status mutation.

Status transition logic belongs in the Ride application/domain layer.

------------------------------------------------------------------------

## 20. Ride Search --- Critical Requirement

The passenger searches only by:

``` text
date
pickup
destination
```

There is **no time-range filter**.

The system finds rides for the complete requested date.

Example:

``` text
date = 2026-08-10
pickup = A
destination = B
```

A ride matches if:

``` text
departure date == requested date

AND

distance(ride.origin, pickup) <= 10 km

AND

distance(ride.destination, destination) <= 10 km

AND

ride is bookable

AND

available seats > 0
```

The radius must be configurable:

``` text
RIDE_ORIGIN_MATCH_RADIUS_METERS=10000
RIDE_DESTINATION_MATCH_RADIUS_METERS=10000
```

Do not hard-code `10000` throughout the application.

------------------------------------------------------------------------

## 21. Date Filtering

Do not use:

``` sql
WHERE DATE(departure_time) = :date
```

for the production search query.

Convert the requested date into a timezone-aware start/end range.

For India:

``` text
Asia/Kolkata
```

Conceptually:

``` sql
departure_time >= day_start
AND departure_time < day_end
```

Store timestamps as `TIMESTAMPTZ`.

Keep timezone handling explicit.

------------------------------------------------------------------------

## 22. Search Query

Conceptually:

``` sql
SELECT
    r.*,

    ST_Distance(
        r.origin,
        :pickup
    ) AS pickup_distance,

    ST_Distance(
        r.destination,
        :destination
    ) AS destination_distance

FROM rides r

WHERE
    r.departure_time >= :day_start
    AND r.departure_time < :day_end

    AND r.status IN ('OPEN', 'FULL')

    AND r.available_seats > 0

    AND ST_DWithin(
        r.origin,
        :pickup,
        :origin_radius
    )

    AND ST_DWithin(
        r.destination,
        :destination,
        :destination_radius
    );
```

The exact final status condition must match the application's seat/state
semantics.

Do not assume `FULL` is searchable if `available_seats = 0`; the seat
condition remains authoritative.

------------------------------------------------------------------------

## 23. Search Must Not Call the Map Provider

The search request already has coordinates.

PostGIS handles:

-   radius checks
-   distances
-   sorting by geographic distance

Do not make one map API request per ride result.

Map providers are for route/geocoding functionality, not primary ride
discovery.

------------------------------------------------------------------------

## 24. Ride Search Result

Return useful derived data:

``` json
{
  "id": "ride-id",
  "departureTime": "...",
  "pickupDistanceKm": 2.1,
  "destinationDistanceKm": 3.7,
  "farePerSeat": 350,
  "availableSeats": 2,
  "driver": {
    "id": "...",
    "name": "...",
    "rating": 4.8
  },
  "vehicle": {
    "type": "SEDAN",
    "model": "...",
    "ac": true
  }
}
```

Do not expose unnecessary sensitive information.

------------------------------------------------------------------------

## 25. Ride Search Sorting

Supported sorting:

``` text
DEPARTURE_TIME
PICKUP_DISTANCE
DESTINATION_DISTANCE
FARE
DRIVER_RATING
```

Default:

``` text
DEPARTURE_TIME ASC
```

The client must not send arbitrary SQL expressions.

Map API enums to safe SQL expressions internally.

Examples:

``` text
DEPARTURE_TIME
    -> departure_time

PICKUP_DISTANCE
    -> ST_Distance(origin, :pickup)

DESTINATION_DISTANCE
    -> ST_Distance(destination, :destination)

FARE
    -> fare_per_seat

DRIVER_RATING
    -> users.rating_average
```

Use deterministic tie breakers.

Example:

``` sql
ORDER BY departure_time ASC, id ASC
```

------------------------------------------------------------------------

## 26. Pagination

Even though the product says "show all matching rides", the API must
paginate.

Use cursor pagination rather than large offset pagination for the
primary search API.

Default:

``` text
limit = 20
```

Maximum should be configurable and enforced server-side.

The cursor must contain the necessary sort values and a unique
tie-breaker.

Examples:

``` text
departure_time + id
pickup_distance + id
destination_distance + id
fare + id
rating + id
```

The cursor must be opaque to the client.

Do not expose raw SQL or internal query state in the cursor.

------------------------------------------------------------------------

## 27. Ride Matching vs Sorting

Do not secretly use a recommendation score to reorder results when the
user selected a sort.

The initial system has deterministic matching:

``` text
date
+
origin <= 10 km
+
destination <= 10 km
+
bookable
```

Then explicit sorting.

Later, a separate:

``` text
RECOMMENDED
```

mode can be added.

------------------------------------------------------------------------

## 28. Fare Module

Create a dedicated:

``` text
FareService
```

and a strategy:

``` typescript
interface FareStrategy {
  calculate(input: FareInput): FareResult;
}
```

Initial implementation:

``` text
HeuristicFareStrategy
```

Future:

``` text
AIFareStrategy
```

Do not put fare logic inside the Ride controller.

------------------------------------------------------------------------

## 29. Heuristic Fare

Initial inputs:

-   base price
-   distance
-   fuel price
-   vehicle type
-   traffic multiplier
-   driver rating

A reasonable normalized structure is:

``` text
baseFare + distanceComponent
then apply bounded multipliers
```

For example:

``` text
baseFare
+
(distanceKm * pricePerKm)

then:

* vehicleMultiplier
* trafficMultiplier
* ratingMultiplier
```

All values should be configurable.

Avoid uncontrolled multipliers.

Driver-rating influence must be bounded so that it cannot create
unreasonable pricing.

Every created ride should persist its resulting fare rather than
recalculating historical fare from current configuration.

------------------------------------------------------------------------

## 30. Driver Commission

Driver pays a 5% posting commission when creating/publishing a ride.

Define the base precisely.

Recommended:

``` text
expectedRideValue =
    farePerSeat * totalSeats

driverCommission =
    expectedRideValue * 5%
```

The exact business rule must be centralized in a Commission/Fee service.

Do not duplicate the 5% formula across controllers.

------------------------------------------------------------------------

## 31. Driver Cancellation Fee

Business rule:

``` text
Driver cancels >= 18 hours before departure:
    2% of the 5% posting fee is refunded
    3% remains retained

Driver cancels < 18 hours before departure:
    full 5% posting fee is retained
```

This resolves the otherwise conflicting requirements:

-   5% posting commission
-   early cancellation gets 2% refund
-   late cancellation gets no refund

All percentages and thresholds must be configuration-driven.

------------------------------------------------------------------------

## 32. Booking Module

A ride must not contain an array of passenger IDs as the source of
truth.

Use:

``` text
Ride 1 ---- N Booking
User 1 ---- N Booking
```

Conceptual:

``` text
bookings
--------
id UUID PK

ride_id FK rides
passenger_id FK users

seat_count

pickup_location
drop_location

fare_per_seat
total_fare
prepaid_amount

booking_status
payment_status

created_at
updated_at
```

Pickup/drop points can use PostGIS geography where appropriate.

------------------------------------------------------------------------

## 33. Booking State Machine

Initial states:

``` text
PENDING_PAYMENT
CONFIRMED
PAYMENT_FAILED
CANCELLED
COMPLETED
```

Typical flow:

``` text
PENDING_PAYMENT
       |
       +----> PAYMENT_FAILED
       |
       v
CONFIRMED
       |
       +----> CANCELLED
       |
       v
COMPLETED
```

Do not allow arbitrary state updates.

------------------------------------------------------------------------

## 34. Passenger Prepayment

Passenger initially pays:

``` text
10% of fare
```

This payment is:

``` text
non-refundable
```

except:

``` text
driver cancels ride
```

In that case, the passenger's prepaid amount is refunded.

If the passenger cancels:

``` text
10% remains retained
```

unless a future policy explicitly changes this.

The policy must be centralized in the cancellation/refund logic.

------------------------------------------------------------------------

## 35. Seat Reservation

The seat hold **is** the `PENDING_PAYMENT` booking row in PostgreSQL —
there is no separate Redis-held "shadow" reservation for seat counts.

Flow:

``` text
Passenger
   |
create booking request
   |
BEGIN
  SELECT ride FOR UPDATE
  check available_seats > 0
  create booking (PENDING_PAYMENT)
  decrement rides.available_seats
COMMIT
   |
schedule TTL expiry job (BullMQ delayed job)
   |
payment
   |
   +-- success (webhook) -> booking CONFIRMED
   |
   +-- failure / TTL expiry -> booking PAYMENT_FAILED or CANCELLED
                                 -> release seat (increment
                                    rides.available_seats, in a
                                    transaction, row-locked)
```

`available_seats` is decremented **at booking creation**, not at
payment confirmation — this is what makes the seat hold real and
prevents two passengers from both reaching the payment screen for the
same last seat. The TTL expiry job is the release mechanism if the
passenger never completes payment; it must itself use row locking
(§36) so it can never release a seat out from under a booking that
concurrently gets confirmed.

Redis is used only to schedule/track the TTL expiry job (BullMQ), not
to hold a second, independent seat count. PostgreSQL remains the sole
authoritative source of seat allocation at every step.

------------------------------------------------------------------------

## 36. Prevent Overselling

Use PostgreSQL transactions and row locking. Per §35, this transaction
runs at **booking creation** (not at payment confirmation) — the seat
is reserved the moment a `PENDING_PAYMENT` booking is created.

Conceptually:

``` text
BEGIN

SELECT ride
FOR UPDATE

check available_seats > 0

create booking (PENDING_PAYMENT)

decrement available_seats

COMMIT
```

The same row-locked pattern is reused by the TTL expiry job (releasing
a seat) and by payment confirmation (moving `PENDING_PAYMENT ->
CONFIRMED`, which does not touch `available_seats` again — the seat
was already reserved at creation time).

Two concurrent booking requests must never be able to allocate the same
final seat.

Do not rely only on frontend checks.

Do not rely only on a Redis counter.

------------------------------------------------------------------------

## 37. Payment Module

Payment is its own module.

Responsibilities:

-   create payment order
-   payment verification
-   payment status
-   refunds
-   payment provider integration
-   idempotency
-   webhook processing
-   transaction/reconciliation records

Use a provider abstraction:

``` typescript
interface PaymentProvider {
  createOrder(...): Promise<PaymentOrder>;
  verifyPayment(...): Promise<PaymentVerification>;
  refund(...): Promise<RefundResult>;
}
```

**Updated 2026-08-12:** the interface above and a `StubPaymentProvider`
exist as of Phase 7 (`src/infrastructure/payments/`) — Phase 6 should
have stood this up per §87/steps.md Phase 6 but only built
MapProvider/FareStrategy; the gap surfaced while implementing Phase 7's
ride creation, which needs *something* behind `createOrder()` to persist
an order reference against. `StubPaymentProvider.createOrder()` returns
a locally-generated order id and does not talk to a real gateway;
`verifyPayment`/`refund` throw (unused until Phase 10/11). This satisfies
"do not implement payment behavior fully yet" (§87) while giving ride
creation a real, swappable call site. Phase 10 adds `RazorpayProvider`
behind the same interface — no call site above this layer changes.

The domain must not depend directly on Razorpay SDK/API classes.

------------------------------------------------------------------------

## 38. Payment Records

Use separate concepts.

### Payment

Gateway-level payment attempt.

### Transaction

Business-level financial record.

Conceptual:

``` text
payments
--------
id
user_id
booking_id
ride_id

provider
provider_order_id
provider_payment_id

amount
currency

status

created_at
updated_at
```

``` text
transactions
------------
id
user_id
booking_id
ride_id

type
amount

provider
provider_reference

status

created_at
updated_at
```

Transaction types:

``` text
DRIVER_RIDE_FEE
BOOKING_PREPAYMENT
FINAL_PAYMENT
REFUND
```

This is not a wallet.

It is a financial history/reconciliation record.

------------------------------------------------------------------------

## 39. Idempotency

Payment-producing APIs must support:

``` http
Idempotency-Key: <unique-key>
```

Create:

``` text
idempotency_keys
----------------
id
user_id
key
endpoint
request_hash
response_status
response_body
created_at
expires_at
```

Unique constraint:

``` text
(user_id, key)
```

Behavior:

``` text
first request
    -> execute
    -> save result

same key + same request
    -> return previous result

same key + different request
    -> reject
```

Idempotency records must be checked atomically.

------------------------------------------------------------------------

## 40. Payment Webhooks

Frontend success is never the authoritative payment confirmation.

Webhook flow:

``` text
Payment Provider
      |
      v
POST /api/v1/webhooks/payment
      |
      +-- verify signature
      +-- identify transaction
      +-- idempotency check
      +-- update payment
      +-- update booking/ride state
      +-- enqueue notifications
```

Webhook processing itself must be idempotent.

A provider retry must not create:

-   duplicate booking confirmation
-   duplicate refund
-   duplicate financial transaction

------------------------------------------------------------------------

## 41. Final Payment

After the ride is completed:

``` text
fare = 100%

initial prepaid = 10%

remaining payment = 90%
```

The passenger pays the remaining amount.

Application commission:

``` text
3% of fare
```

Driver share:

``` text
97% of fare
```

Example:

``` text
Fare = ₹500

Rydex commission = ₹15
Driver = ₹485
```

The initial 10% is an advance toward the fare, not an additional fee.

Final settlement must use the fare locked for the booking/ride, not a
newly recalculated fare.

------------------------------------------------------------------------

## 42. Notification Module

Notification delivery is asynchronous.

Architecture:

``` text
Business Module
      |
      v
Event / Job
      |
      v
BullMQ
      |
      v
Notification Worker
      |
      v
FCM
```

Examples:

``` text
BookingConfirmed
RideCancelled
PaymentSuccessful
RefundProcessed
RideStarting
RideCompleted
```

Do not block user-facing API requests waiting for FCM.

------------------------------------------------------------------------

## 43. BullMQ

Use Redis-backed BullMQ queues.

Queues can be separated by responsibility, for example:

``` text
notification
payment
refund
```

Start with only the queues actually needed.

Workers must have:

-   retry
-   exponential backoff where appropriate
-   bounded attempts
-   structured logs
-   idempotent job handling

Do not create a new queue for every event type.

------------------------------------------------------------------------

## 44. Notification Types

Initial notifications:

``` text
RIDE_BOOKED
BOOKING_CONFIRMED
BOOKING_CANCELLED
RIDE_CANCELLED
RIDE_STARTING
RIDE_COMPLETED
PAYMENT_SUCCESS
PAYMENT_FAILED
REFUND_PROCESSED
```

OTP email is handled by Auth/Resend, not FCM.

------------------------------------------------------------------------

## 45. FCM Device Tokens

Create:

``` text
user_devices
------------
id
user_id
device_token
platform
last_seen_at
created_at
updated_at
```

A user may have multiple devices.

When FCM indicates a token is invalid/unregistered, deactivate or remove
it.

Never assume one user has exactly one device token.

------------------------------------------------------------------------

## 46. Notification Persistence

Create:

``` text
notifications
-------------
id
user_id

type
title
body

data JSONB

read_at
created_at
```

This allows an in-app notification center.

FCM delivery and notification persistence are separate concerns.

------------------------------------------------------------------------

## 47. Chat

Chat is a module, not an independently deployed service.

Use WebSockets / Socket.IO.

Architecture:

``` text
Client
  |
WebSocket
  |
Node.js
  |
Chat Module
  |
PostgreSQL
```

Entities:

``` text
conversations
-------------
id
ride_id
driver_id
passenger_id
created_at
```

``` text
messages
--------
id
conversation_id
sender_id
message
created_at
read_at
```

A user may only access a conversation if they are authorized
participants for the relevant ride/booking.

Do not trust conversation IDs from the client.

Authenticate the socket and authorize every conversation join.

------------------------------------------------------------------------

## 48. Redis

Redis responsibilities:

``` text
1. OTP
2. Rate limiting
3. Temporary booking/seat reservation
4. BullMQ
5. Short-lived cache
```

Do not store permanent domain state only in Redis.

Do not use Redis as a replacement for PostgreSQL.

------------------------------------------------------------------------

## 49. Rate Limiting

Implement distributed rate limiting using Redis.

Rate limits should consider:

-   IP
-   user ID
-   email where appropriate
-   endpoint

Examples:

``` text
OTP request:
    per email
    per IP

OTP verification:
    per email/OTP
    per IP

Ride search:
    per user/IP

Ride creation:
    per user

Booking:
    per user

Payment:
    per user

WebSocket connection:
    per user/IP
```

Use configurable values.

Return:

``` text
HTTP 429
```

when a hard limit is exceeded.

------------------------------------------------------------------------

## 50. Throttling

Rate limiting and throttling are related but not identical.

Rate limiting:

``` text
maximum allowed requests
```

Throttling:

``` text
control request frequency/pressure
```

Apply stricter controls to expensive operations:

-   route generation
-   ride creation
-   payment initiation
-   search abuse
-   OTP

Do not make normal application usage frustrating.

------------------------------------------------------------------------

## 51. API Versioning

Use:

``` text
/api/v1/...
```

Examples:

``` text
POST /api/v1/auth/request-otp
POST /api/v1/auth/verify-otp
POST /api/v1/auth/refresh
POST /api/v1/auth/logout

POST /api/v1/vehicles
GET  /api/v1/vehicles

POST /api/v1/rides
GET  /api/v1/rides/search
GET  /api/v1/rides/:id
POST /api/v1/rides/:id/cancel
POST /api/v1/rides/:id/start
POST /api/v1/rides/:id/complete

POST /api/v1/rides/:id/bookings
GET  /api/v1/bookings/:id
POST /api/v1/bookings/:id/cancel

POST /api/v1/payments/...
POST /api/v1/webhooks/payment

GET /api/v1/notifications
PATCH /api/v1/notifications/:id/read
```

Admin (§96):

``` text
GET  /api/v1/admin/vehicles
GET  /api/v1/admin/vehicles/:id
POST /api/v1/admin/vehicles/:id/verify
POST /api/v1/admin/vehicles/:id/reject
```

Exact endpoints may be refined during LLD, but preserve domain
boundaries.

------------------------------------------------------------------------

## 52. Request Lifecycle

Every HTTP request should approximately follow:

``` text
Request
  |
CORS
  |
Request ID
  |
Security headers
  |
Rate Limit
  |
Authentication
  |
Authorization
  |
Validation
  |
Controller
  |
Application Service
  |
Domain logic
  |
Repository
  |
PostgreSQL
```

Do not put business logic in middleware.

------------------------------------------------------------------------

## 53. Validation

Use a schema validation library such as Zod.

Validate:

-   body
-   params
-   query
-   headers where needed

Never trust:

-   client role
-   client fare
-   client user ID
-   client payment status
-   client seat availability
-   client ownership claims

Derive sensitive values from authenticated server-side state.

------------------------------------------------------------------------

## 54. Authorization

Authentication answers:

``` text
Who are you?
```

Authorization answers:

``` text
What are you allowed to do?
```

Examples:

``` text
PASSENGER
    can book

DRIVER
    can create ride

driver
    can cancel only own ride

passenger
    can cancel only own booking

user
    can read only authorized chat

user
    can update only own profile/vehicle
```

Never rely on frontend role checks.

------------------------------------------------------------------------

## 55. Error Handling

Use centralized error handling.

Standard response:

``` json
{
  "success": false,
  "error": {
    "code": "RIDE_NOT_FOUND",
    "message": "Ride not found"
  },
  "requestId": "req_123"
}
```

Use stable machine-readable error codes.

Examples:

``` text
INVALID_OTP
OTP_EXPIRED
RATE_LIMITED

UNAUTHORIZED
FORBIDDEN

DRIVER_NOT_ELIGIBLE
VEHICLE_NOT_FOUND
VEHICLE_NOT_ELIGIBLE

RIDE_NOT_FOUND
RIDE_NOT_BOOKABLE
NO_SEATS_AVAILABLE
INVALID_RIDE_STATE

BOOKING_NOT_FOUND
BOOKING_ALREADY_CANCELLED

PAYMENT_FAILED
PAYMENT_ALREADY_PROCESSED
IDEMPOTENCY_CONFLICT

REFUND_FAILED
```

Never expose stack traces to clients.

------------------------------------------------------------------------

## 56. Database Design Principles

Use PostgreSQL as the source of truth.

Use:

-   UUID primary keys
-   foreign keys
-   unique constraints
-   CHECK constraints
-   NOT NULL wherever logically required
-   indexes based on real query patterns
-   TIMESTAMPTZ
-   JSONB only where schema flexibility is genuinely useful
-   PostGIS geography for geographic data

Do not add indexes blindly.

Validate important indexes using `EXPLAIN ANALYZE` against realistic
data.

------------------------------------------------------------------------

## 57. Important Database Indexes

At minimum, investigate:

``` text
users(email)
users(phone)

vehicles(owner_id)
vehicles(registration_number)

rides(driver_id)
rides(vehicle_id)
rides(departure_time, status)

GIST(rides.origin)
GIST(rides.destination)

bookings(ride_id)
bookings(passenger_id)

payments(booking_id)
payments(provider_payment_id)

transactions(booking_id)

notifications(user_id, created_at)

messages(conversation_id, created_at)

refresh_tokens(user_id)
```

Exact composite indexes should be finalized after query design.

------------------------------------------------------------------------

## 58. Concurrency

Identify all operations where concurrent requests matter.

Especially:

``` text
booking the last seat
payment confirmation
payment webhook retries
refund processing
ride cancellation
ride completion
refresh token rotation
idempotency
```

Use PostgreSQL transactions and appropriate locks.

Never assume requests happen sequentially.

------------------------------------------------------------------------

## 59. Cancellation Transaction

Driver cancellation should conceptually be:

``` text
BEGIN

lock ride

verify current ride state

mark ride CANCELLED

find confirmed bookings

mark bookings CANCELLED

create refund records / refund intents

COMMIT

enqueue:
    passenger refunds
    driver fee refund if eligible
    notifications
```

Do not call external payment APIs inside the transaction.

------------------------------------------------------------------------

## 60. Event / Job Design

Modules can communicate internally using application events.

Examples:

``` text
RideCreated
RideCancelled
RideStarted
RideCompleted

BookingCreated
BookingConfirmed
BookingCancelled

PaymentCompleted
PaymentFailed
RefundCompleted
```

Use BullMQ for durable asynchronous work.

Do not introduce Kafka just for this.

------------------------------------------------------------------------

## 61. Observability

"No audit logs" does not mean "no logs."

Implement structured application logs.

Every request gets a request ID:

``` text
req_abc123
```

Include in logs:

-   request ID
-   user ID where available
-   endpoint
-   method
-   status code
-   latency
-   error code
-   important external-provider reference IDs

Never log:

-   OTP
-   access tokens
-   refresh tokens
-   payment secrets
-   document contents
-   sensitive personal information

------------------------------------------------------------------------

## 62. Health Checks

Implement:

``` text
GET /health
GET /ready
```

Health:

``` text
application process is alive
```

Readiness:

``` text
required dependencies are available
```

Do not make health checks unnecessarily expensive.

------------------------------------------------------------------------

## 63. Configuration

Use environment variables.

Validate environment configuration at startup.

Example:

``` text
NODE_ENV

PORT

DATABASE_URL
REDIS_URL

JWT_ACCESS_SECRET
JWT_REFRESH_SECRET

RESEND_API_KEY
RESEND_FROM_EMAIL

CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

FCM_PROJECT_ID
FCM_CLIENT_EMAIL
FCM_PRIVATE_KEY

PAYMENT_PROVIDER_KEY
PAYMENT_PROVIDER_SECRET

MAP_PROVIDER_API_KEY

RIDE_ORIGIN_MATCH_RADIUS_METERS
RIDE_DESTINATION_MATCH_RADIUS_METERS

DRIVER_COMMISSION_PERCENT
PASSENGER_PREPAYMENT_PERCENT
FINAL_PAYMENT_PERCENT
PLATFORM_COMMISSION_PERCENT
DRIVER_EARLY_CANCEL_REFUND_PERCENT
DRIVER_CANCEL_THRESHOLD_HOURS
```

Never commit secrets.

Provide:

``` text
.env.example
```

with placeholders only.

------------------------------------------------------------------------

## 64. Docker Development

Development infrastructure should be reproducible.

Use Docker Compose for:

``` text
PostgreSQL + PostGIS
Redis
```

Example conceptual setup:

``` text
docker-compose.yml
|
+-- postgres/postgis
|
+-- redis
```

Application can run locally during development or inside Docker when
desired.

Production infrastructure should not depend on the development Compose
file.

------------------------------------------------------------------------

## 65. Production Deployment Target

For approximately 10K users:

``` text
Cloudflare / CDN
        |
AWS Load Balancer
        |
ECS Fargate
        |
Node.js containers
        |
+-------+------------------+
|                          |
RDS PostgreSQL          ElastiCache Redis
+ PostGIS
```

External:

``` text
Cloudinary
Resend
FCM
Map Provider
Payment Provider
```

Kubernetes is unnecessary at this scale.

------------------------------------------------------------------------

## 66. Scaling Strategy

Initially:

``` text
1 application image
multiple ECS tasks
```

The application must be stateless.

Do not store:

-   sessions
-   OTPs
-   important caches
-   uploaded files
-   WebSocket state

only in local process memory.

Use Redis/PostgreSQL/Cloudinary as appropriate.

This allows:

``` text
Node instance 1
Node instance 2
Node instance 3
```

to serve requests interchangeably.

------------------------------------------------------------------------

## 67. WebSocket Scaling Consideration

Chat uses Socket.IO.

When multiple backend instances are deployed, Socket.IO requires a
shared adapter/state strategy so that events can reach users connected
to different instances.

Redis can be used as the Socket.IO adapter/backplane.

Do not assume in-memory socket state works once multiple instances
exist.

------------------------------------------------------------------------

## 68. Security Requirements

Implement at minimum:

``` text
HTTPS in production
Helmet/security headers
strict CORS
request validation
rate limiting
authorization checks
secure token handling
refresh-token rotation
webhook signature verification
file validation
secret management
no sensitive logs
SQL injection protection
secure Cloudinary configuration
```

Never trust client-provided:

``` text
userId
role
fare
commission
paymentStatus
rideStatus
availableSeats
driverId
```

------------------------------------------------------------------------

## 69. Testing Strategy

Use multiple testing levels.

### Unit tests

For:

-   fare calculations
-   cancellation policies
-   state machines
-   commission calculations
-   sorting/cursor logic
-   authorization rules

### Integration tests

For:

-   PostgreSQL
-   PostGIS queries
-   booking concurrency
-   payment repository
-   Redis
-   BullMQ

### API tests

For:

-   authentication
-   ride creation
-   ride search
-   booking
-   cancellation
-   notifications

### Critical concurrency tests

Must test:

``` text
2 users booking the final seat
2 identical payment requests
duplicate payment webhook
duplicate refund job
refresh token reuse
driver cancellation while booking is being created
```

------------------------------------------------------------------------

## 70. Testing External Providers

Do not make unit tests depend on live:

-   Resend
-   FCM
-   Cloudinary
-   Map provider
-   payment provider

Create interfaces and mocks/fakes.

Integration tests can use sandbox/test environments where appropriate.

------------------------------------------------------------------------

## 71. Code Quality

Use:

``` text
TypeScript strict mode
ESLint
Prettier
Husky/lint-staged if useful
```

Do not disable TypeScript strictness just to make code compile.

Avoid:

``` typescript
any
```

unless there is a documented reason.

Prefer:

``` typescript
unknown
```

with proper narrowing.

------------------------------------------------------------------------

## 72. Naming

Use consistent naming.

Database:

``` text
snake_case
```

TypeScript:

``` text
camelCase
PascalCase for classes/types
```

Examples:

``` text
departure_time
departureTime
RideSearchService
```

Do not mix conventions.

------------------------------------------------------------------------

## 73. Folder Structure

Recommended:

``` text
src/
│
├── app/
│   ├── app.ts
│   ├── routes.ts
│   └── middleware/
│
├── config/
│   ├── env.ts
│   └── constants.ts
│
├── modules/
│   │
│   ├── auth/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── types/
│   │   └── routes.ts
│   │
│   ├── user/
│   ├── vehicle/
│   ├── ride/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── strategies/
│   │   ├── schemas/
│   │   ├── domain/
│   │   └── routes.ts
│   │
│   ├── booking/
│   ├── payment/
│   ├── notification/
│   └── admin/
│
├── infrastructure/
│   ├── database/
│   ├── redis/
│   ├── queue/
│   ├── cloudinary/
│   ├── resend/
│   ├── fcm/
│   ├── payments/
│   └── maps/
│
├── shared/
│   ├── errors/
│   ├── logger/
│   ├── types/
│   ├── utils/
│   └── constants/
│
└── server.ts
```

The exact folder names can evolve, but the module boundaries must
remain.

------------------------------------------------------------------------

## 74. Controllers

Controllers should be thin.

Example:

``` text
POST /rides

controller
  |
  +-- validate request
  +-- get authenticated user
  |
  +-- rideService.createRide(...)
  |
  +-- return response
```

No SQL.

No direct SDK calls.

No complex business logic.

------------------------------------------------------------------------

## 75. Services / Use Cases

Prefer explicit application operations.

Examples:

``` text
CreateRide
SearchRides
CancelRide
StartRide
CompleteRide

CreateBooking
ConfirmBooking
CancelBooking

RequestOtp
VerifyOtp
RefreshSession

CreatePayment
HandlePaymentWebhook
ProcessRefund
```

This makes the code easy to test and reason about.

------------------------------------------------------------------------

## 76. Repositories

Repositories encapsulate persistence.

Example:

``` text
RideRepository
    create()
    findById()
    search()
    updateStatus()
    lockForUpdate()
```

Do not put business rules inside repositories.

Repository answers:

``` text
How do I access data?
```

Service/domain answers:

``` text
What should happen?
```

------------------------------------------------------------------------

## 77. Prisma + PostGIS

Prisma is used for normal relational persistence.

PostGIS-specific queries may use carefully isolated raw SQL through the
repository layer.

Do not scatter raw SQL throughout the application.

All spatial SQL should live in the Ride repository/data-access layer.

------------------------------------------------------------------------

## 78. Transactions

Use Prisma transactions where appropriate.

Transactions should be:

-   short
-   deterministic
-   free of external network calls
-   protected from race conditions

Do not wrap an entire HTTP request in one giant transaction.

------------------------------------------------------------------------

## 79. Caching

Only cache data where staleness is acceptable.

Good candidates:

``` text
configuration
static metadata
short-lived non-critical search results
```

Be careful caching:

``` text
ride availability
seat counts
payment status
booking state
```

The source of truth remains PostgreSQL.

Do not cache mutable financial/booking state without a clear
invalidation strategy.

------------------------------------------------------------------------

## 80. API Documentation

Generate OpenAPI/Swagger documentation.

Every public API should document:

-   method
-   path
-   authentication
-   request schema
-   response schema
-   error responses
-   pagination
-   idempotency requirements where applicable

The OpenAPI specification should be generated/maintained alongside the
code.

------------------------------------------------------------------------

## 81. API Response Convention

Use a consistent convention.

Success:

``` json
{
  "success": true,
  "data": {}
}
```

List:

``` json
{
  "success": true,
  "data": {
    "items": [],
    "nextCursor": "..."
  }
}
```

Error:

``` json
{
  "success": false,
  "error": {
    "code": "SOME_ERROR",
    "message": "Human-readable message"
  },
  "requestId": "req_123"
}
```

------------------------------------------------------------------------

## 82. Idempotency Beyond Payments

Payments require idempotency, but consider it for other retry-sensitive
operations too.

Especially:

``` text
payment creation
refund
webhook processing
booking confirmation
notification jobs
```

Do not blindly add idempotency infrastructure to every GET request.

------------------------------------------------------------------------

## 83. Booking + Payment Race Conditions

The following must be safe:

``` text
Passenger A
    |
    +-- booking request
    |
Passenger B
    |
    +-- booking request
```

when only one seat remains.

Only one confirmed booking may receive that seat.

Likewise:

``` text
payment webhook
payment webhook retry
```

must result in one logical payment state transition.

------------------------------------------------------------------------

## 84. Financial Invariants

These must always hold:

``` text
confirmed booking cannot exceed available seats

payment cannot be confirmed twice

refund cannot exceed refundable amount

driver cancellation policy is deterministic

final payment cannot exceed remaining fare

application commission is calculated exactly once

historical fare does not change because current pricing configuration changed
```

These are domain invariants.

------------------------------------------------------------------------

## 85. Important Business Rules

Centralize these rules.

``` text
RIDE_ORIGIN_RADIUS = 10 km
RIDE_DESTINATION_RADIUS = 10 km

DRIVER_POSTING_COMMISSION = 5%
PASSENGER_INITIAL_PAYMENT = 10%
FINAL_PAYMENT = 90%
APPLICATION_FINAL_COMMISSION = 3%

DRIVER_EARLY_CANCEL_REFUND = 2 percentage points of posting fee
DRIVER_EARLY_CANCEL_THRESHOLD = 18 hours

PASSENGER_PREPAYMENT_REFUND:
    only when driver cancels
```

Use configuration/constants, not magic numbers.

------------------------------------------------------------------------

## 86. What "best practices" means for this project

Claude must prioritize:

1.  correctness
2.  security
3.  transactional consistency
4.  maintainability
5.  testability
6.  observability
7.  performance
8.  scalability
9.  simplicity

Do not optimize prematurely.

Do not create abstractions that have no current use.

But use interfaces where external providers or business strategies
genuinely need replacement:

``` text
MapProvider
PaymentProvider
FareStrategy
NotificationProvider
```

------------------------------------------------------------------------

## 87. Things Claude Must NOT Do

Do not:

-   create six microservices
-   create Kubernetes configuration
-   introduce Kafka
-   store OTPs in PostgreSQL
-   store documents in PostgreSQL
-   store images as blobs in PostgreSQL
-   call map APIs for every search result
-   trust frontend payment success
-   trust frontend fare
-   trust frontend seat availability
-   update booking status directly from controllers
-   perform external network calls inside DB transactions
-   put secrets in source code
-   use `any` everywhere
-   duplicate business rules
-   put all code into `server.ts`
-   create giant service classes
-   create generic `utils.ts` containing unrelated business logic
-   use Redis as the source of truth for bookings/payments
-   use offset pagination for the primary geo-search API
-   expose raw database errors to clients

------------------------------------------------------------------------

## 88. Implementation Order

Implement in controlled stages.

### Stage 1 --- Project foundation

Create:

``` text
TypeScript
Express
Prisma
PostgreSQL/PostGIS
Redis
Docker Compose
ESLint
Prettier
environment validation
logging
error handling
request IDs
health checks
```

Do not start with business logic before the foundation is stable.

### Stage 2 --- Database

Implement:

``` text
users
refresh_tokens
user_documents
vehicles
vehicle_documents
```

Run migrations.

Seed development data.

### Stage 3 --- Authentication

Implement:

``` text
request OTP
verify OTP
access token
refresh token
rotation
logout
authorization middleware
rate limiting
```

### Stage 4 --- Vehicle

Implement:

``` text
CRUD
ownership
document upload
eligibility
```

### Stage 4.5 --- Admin Verification

Implement (see §96):

``` text
ADMIN role
admin authorization middleware
list pending vehicles
verify / reject vehicle documents
```

### Stage 5 --- Ride

Implement:

``` text
MapProvider
ride creation
fare strategy
ride state machine
PostGIS
```

### Stage 6 --- Search

Implement:

``` text
date search
10 km origin
10 km destination
distance calculations
sorting
cursor pagination
```

This stage requires careful SQL and indexes.

### Stage 7 --- Booking

Implement:

``` text
booking
seat locking
temporary reservation
booking state machine
```

### Stage 8 --- Payment

Implement:

``` text
payment provider adapter
idempotency
driver posting commission
10% passenger payment
webhooks
refunds
final 90%
3% commission
```

### Stage 9 --- Notifications

Implement:

``` text
BullMQ
workers
FCM
notification persistence
retry
```

### Stage 10 --- Chat

Implement:

``` text
Socket.IO
authentication
authorization
conversation
messages
read status
```

### Stage 11 --- Hardening

Add:

``` text
tests
security checks
load/concurrency tests
OpenAPI
Docker production build
CI
observability
```

------------------------------------------------------------------------

## 89. Definition of Done

A feature is not complete merely because its endpoint works.

Each feature should include:

``` text
database schema/migration
validation
authorization
service/use case
repository
controller
route
error handling
tests
logging
documentation
```

For payment features additionally:

``` text
idempotency
webhook handling
retry behavior
refund behavior
financial consistency
```

For booking:

``` text
concurrency protection
seat consistency
payment timeout behavior
```

For ride search:

``` text
PostGIS query
spatial indexes
date handling
sorting
cursor pagination
EXPLAIN ANALYZE verification
```

------------------------------------------------------------------------

## 90. Claude Code Working Rules

Before modifying code:

1.  Read this architecture document.
2.  Inspect the existing repository.
3.  Identify the relevant module.
4.  Reuse existing abstractions.
5.  Do not duplicate infrastructure.
6.  Do not change domain decisions silently.

When implementing a feature:

``` text
Requirement
    |
Design
    |
Schema
    |
Migration
    |
Repository
    |
Service/use case
    |
Controller
    |
Route
    |
Tests
    |
Documentation
```

After implementation:

``` text
typecheck
lint
unit tests
integration tests where relevant
build
```

Do not declare a feature complete if the project does not compile or
tests fail.

------------------------------------------------------------------------

## 91. Change Management

If Claude identifies a conflict in this architecture:

1.  Stop before implementing the conflicting behavior.
2.  Explain the conflict.
3.  Identify which existing requirement is affected.
4.  Propose the smallest change.
5.  Do not silently redesign the architecture.

If a decision is intentionally changed, update this architecture
document so it remains the source of truth.

------------------------------------------------------------------------

## 92. Initial Non-Functional Requirements

The system should be designed for approximately:

``` text
10K users
```

with horizontal backend scaling.

Initial priorities:

``` text
correctness
security
availability
database consistency
reasonable latency
observability
maintainability
```

Do not design for millions of users unless the design naturally supports
it without unnecessary complexity.

------------------------------------------------------------------------

## 93. Performance Targets

Initial engineering targets should be treated as goals, not absolute
guarantees.

For normal APIs:

``` text
p95 < 300-500ms
```

excluding slow third-party operations where appropriate.

Ride search should be optimized for:

``` text
PostGIS index usage
reasonable candidate filtering
bounded result sizes
cursor pagination
```

Payment and map-provider latency should not unnecessarily block
unrelated operations.

Use metrics to identify actual bottlenecks before optimizing.

------------------------------------------------------------------------

## 94. Final System Picture

``` text
                          CLIENT
                            |
                     HTTPS / WebSocket
                            |
                    Load Balancer
                            |
                 +----------v----------+
                 | Node.js / Express   |
                 | Modular Monolith    |
                 +----------+----------+
                            |
      +----------+----------+----------+----------+----------+
      |          |          |          |          |          |
     Auth       User     Vehicle      Ride      Booking   Payment
      |          |          |          |          |          |
      |          |          |          |          |          |
      +----------+----------+----------+----------+----------+
                                      |
                              Notification Module
                                      |
                                    BullMQ
                                      |
                                    Redis
                                      |
                                     FCM

      +-------------------+-------------------+
      |                   |                   |
 PostgreSQL + PostGIS   Redis            External APIs
      |                   |                   |
      |                   |        +----------+---------+
      |                   |        |    |      |       |
      |                   |      Resend FCM Cloudinary Maps
      |                   |                         |
      |                   |                    Payment Provider
      |
      +-- users
      +-- vehicles
      +-- rides
      +-- bookings
      +-- payments
      +-- transactions
      +-- notifications
      +-- ratings
      +-- messages
      +-- refresh tokens
      +-- idempotency
```

------------------------------------------------------------------------

## 95. Final Instruction to the Implementing Agent

**Build Rydex as a production-quality modular monolith.**

The goal is not to generate the maximum amount of code.

The goal is to produce a codebase that is:

-   understandable
-   secure
-   testable
-   transactionally correct
-   horizontally scalable
-   provider-independent where appropriate
-   maintainable by another engineer
-   ready to evolve into separate services if scale eventually requires
    it

When in doubt, prefer:

``` text
simple + explicit + correct
```

over:

``` text
complex + clever + premature
```

Do not change the product requirements merely to make implementation
easier.

Do not silently invent business rules.

Keep the domain logic centralized.

Keep external integrations behind interfaces.

Keep PostgreSQL authoritative.

Keep asynchronous work idempotent.

Protect every money/seat/state transition against concurrency.

And keep this document updated whenever an architectural decision
changes.

------------------------------------------------------------------------

## 96. Admin Module

Added after initial architecture review (see §97 change log). Admins
have two review responsibilities: vehicle documents (RC, Insurance,
Pollution — §13) and driving-license applications that grant the
`DRIVER` role (§8). Both are real scope, not future placeholders. The
module's blast radius is still deliberately narrow — these two review
workflows only, nothing else.

### Responsibilities

Vehicle document verification:

-   list vehicles with `verification_status = PENDING`
-   view documents via signed/private Cloudinary URLs (§14)
-   approve (`verification_status -> VERIFIED`)
-   reject (`verification_status -> REJECTED`, with `rejection_reason`)

Driver license verification (§8):

-   list users with `driver_license_status = PENDING`
-   view the submitted license document via a signed/private
    Cloudinary URL (§14)
-   approve — atomically sets `role -> DRIVER` and
    `driver_license_status -> VERIFIED`
-   reject (`driver_license_status -> REJECTED`, with
    `rejection_reason`) — role stays `PASSENGER`; the user may resubmit

Nothing else — no general user management, no ride/booking overrides,
no financial actions.

### Role & authentication

`ADMIN` is a third value on the existing `role` enum (§8) — there is
still one `users` table. Admins:

-   are provisioned directly (seed script or manual DB insert), never
    via public self-registration
-   authenticate through the same OTP login flow as everyone else
    (§9-§11) — no separate admin auth system
-   are authorized the same way as any other role check (§54):
    `user.role === 'ADMIN'` middleware on admin routes

### Endpoints

``` text
GET  /api/v1/admin/vehicles?status=PENDING
GET  /api/v1/admin/vehicles/:id
POST /api/v1/admin/vehicles/:id/verify
POST /api/v1/admin/vehicles/:id/reject

GET  /api/v1/admin/driver-applications?status=PENDING
POST /api/v1/admin/driver-applications/:userId/verify
POST /api/v1/admin/driver-applications/:userId/reject
```

### Relationship to ride creation eligibility

**Superseded 2026-08-11 (§97):** vehicle eligibility for ride creation
now **requires** `verification_status == VERIFIED`, in addition to
ownership + `ACTIVE` status + seat capacity (§8). The check still lives
in one place — the same eligibility function referenced in §8 and
§18 — not scattered across controllers. (An earlier version of this
section said verification was a signal, not a gate; that has been
reversed, see §97.)

### Data model additions

`vehicles` gains (§12):

``` text
verified_by       FK users (admin), nullable
verified_at       nullable TIMESTAMPTZ
rejection_reason  nullable
```

`users` gains, for driver-license verification:

``` text
driver_license_status            NONE | PENDING | VERIFIED | REJECTED
driver_license_verified_by       FK users (admin), nullable
driver_license_verified_at       nullable TIMESTAMPTZ
driver_license_rejection_reason  nullable
```

The submitted license file itself is a normal `user_documents` row
(§13) with `document_type = DRIVING_LICENSE` — no new document-storage
table. The four fields above hold the *decision*, mirroring exactly how
`vehicles.verification_status`/`verified_by`/`verified_at`/
`rejection_reason` hold the decision for vehicles while the underlying
files live in `vehicle_documents`.

No new audit-log system is introduced (§6 keeps that out of scope) —
these fields are sufficient to know who decided what and when for this
MVP.

------------------------------------------------------------------------

## 97. Architecture Change Log

Record of intentional decisions made after the initial draft, per §91.

### 2026-08-10

-   **Search radius fixed to 10 km.** §1 said ~8 km while §20, §22,
    §85, and `steps.md` Phase 8 all said 10 km. 10 km was correct
    everywhere except §1; §1 has been corrected to match.
-   **Seat reservation clarified as Postgres-decrement-at-creation.**
    §35/§36 were ambiguous about whether `available_seats` decrements
    at booking creation or at payment confirmation. Resolved:
    decrement happens at booking creation (`PENDING_PAYMENT`, row
    locked), released by a TTL-based BullMQ expiry job if payment
    doesn't complete. Redis is not a second source of seat holds.
-   **Ride creation gets a `PENDING_PAYMENT` status.** §18 required
    "confirm required payment" before persisting the ride, but §40
    establishes payment confirmation as async/webhook-driven. Ride's
    state machine (§19) now has `PENDING_PAYMENT -> OPEN`, mirroring
    Booking's existing pattern.
-   **Vehicle eligibility for ride creation stays simple.** Ownership +
    `ACTIVE` status + seat capacity only — not gated on
    `verification_status`.
-   **Admin verification dashboard added to scope.** §13/§87
    originally excluded any admin verification workflow from the MVP.
    That is reversed: admins now manually verify vehicle documents via
    a dashboard (§96). This does not gate ride creation (previous
    bullet) — it's scope-additive, not a reversal of the "keep it
    simple" principle elsewhere in this document.

### 2026-08-11

-   **Driver upgrade path resolved.** steps.md flagged (Phase 3) that
    every signup lands as `PASSENGER` with no way to become `DRIVER`,
    blocking Phase 5 end-to-end. Resolved: a `PASSENGER` submits a
    driving-license document; an admin reviews and approves/rejects it
    through the Admin Module (§96); approval atomically sets
    `role -> DRIVER` and `driver_license_status -> VERIFIED`. See §8
    ("Becoming a DRIVER") and §96 for the full flow, endpoints, and
    data model.
-   **Vehicle verification now gates ride creation — this reverses the
    2026-08-10 decision above ("Vehicle eligibility for ride creation
    stays simple").** Explicit product decision, made when asked
    directly: a vehicle must have `verification_status = VERIFIED`
    (admin-approved, §96) before it can be selected to create a ride,
    on top of ownership + `ACTIVE` status + seat capacity. §8 and §96
    have been updated to match; §18's ride-creation flow and its
    eligibility function must include this check when Phase 7 is
    implemented.

### 2026-08-12

-   **Initial `MapProvider` implementation changed from Mapbox to
    Geoapify.** §17 named Mapbox as the initial implementation. In
    practice, Mapbox's account signup now requires a payment method
    before any free-tier usage is unlockable, which conflicts with an
    explicit product constraint: no payment method on file with any
    mapping/location vendor. Researched alternatives (Mapbox, Google
    Maps Platform, HERE, TomTom, MapTiler, OpenRouteService, LocationIQ,
    self-hosted OSRM+Nominatim) against that constraint plus free-tier
    limits, commercial-use terms, and fit for ~10k users (§92); Geoapify
    was selected as the initial `MapProvider` implementation (no card
    required, 3,000 credits/day, commercial use allowed with
    attribution, single API covering geocode/reverseGeocode/route/
    distance-matrix). OpenRouteService is a documented fallback if
    Geoapify's quota becomes constraining; self-hosting OSRM+Nominatim
    is the eventual no-limits option, deferred until traffic actually
    warrants the operational overhead. The `MapProvider` interface
    itself (§17) is unchanged — this is a Strategy-pattern provider
    swap, exactly what the interface exists to make cheap.
