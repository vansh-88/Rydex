# Rydex --- Phased Implementation Plan for Claude Code

## Purpose

This document tells Claude Code **how to build Rydex from an empty
folder to a production-quality application in controlled phases**.

The architecture is defined in:

``` text
RYDEX_ARCHITECTURE.md
```

That document is the architectural source of truth.

This document is the **implementation execution plan**.

------------------------------------------------------------------------

# 1. How Claude Code Must Use These Documents

Before writing code:

1.  Read `claude.md`.
2.  Read this file completely.
3.  Inspect the current repository.
4.  Determine which phases are already complete.
5.  Do not recreate existing work.
6.  Continue from the first incomplete phase.
7.  Preserve existing architectural decisions.
8.  Do not silently change requirements.

The project may initially be an empty directory.

Claude Code must build the project incrementally while maintaining a
working codebase.

------------------------------------------------------------------------

# 2. Fundamental Rule

Do not implement everything as one giant code-generation operation.

Build in **phases**.

After each phase:

``` text
Implement
   ↓
Run typecheck
   ↓
Run lint
   ↓
Run tests
   ↓
Run build
   ↓
Verify database migrations
   ↓
Verify Docker services
   ↓
Fix failures
   ↓
Update implementation checklist
   ↓
Proceed to next phase
```

The goal is that every completed phase leaves the project in a usable,
compilable state.

------------------------------------------------------------------------

# 3. Phase Overview

``` text
Phase 0  → Project planning / repository initialization
Phase 1  → Backend foundation
Phase 2  → Database foundation
Phase 3  → Authentication
Phase 4  → User + profile
Phase 5   → Vehicle + documents
Phase 5.5 → Admin verification dashboard
Phase 6   → Map provider + fare engine
Phase 7  → Ride creation + lifecycle
Phase 8  → Ride search + PostGIS
Phase 9  → Booking + seat concurrency
Phase 10 → Payment system
Phase 11 → Cancellation + refunds + settlement
Phase 12 → Notification system
Phase 13 → Chat
Phase 14 → Security + rate limiting
Phase 15 → Testing + hardening
Phase 16 → Production Docker + AWS deployment preparation
Phase 17 → Final integration + documentation
```

Do not skip directly to the final phase.

------------------------------------------------------------------------

# 4. Phase 0 --- Repository Initialization

## Goal

Turn an empty folder into a clearly structured Rydex repository.

Create:

``` text
RYDEX/
├── RYDEX_ARCHITECTURE.md
├── RYDEX_PHASES.md
├── README.md
├── .gitignore
├── .env.example
├── package.json
├── tsconfig.json
├── eslint.config.*
├── prettier.config.*
└── docker-compose.yml
```

At this point do not implement business features.

## Tasks

-   initialize Git
-   initialize Node.js project
-   configure TypeScript
-   enable strict mode
-   configure ESLint
-   configure Prettier
-   configure scripts
-   create `.env.example`
-   create Docker Compose
-   create README
-   create initial source tree

Expected scripts:

``` text
dev
build
start
lint
format
typecheck
test
test:watch
test:integration
```

## Verification

``` text
npm install
npm run typecheck
npm run lint
npm run build
```

Everything must pass.

------------------------------------------------------------------------

# 5. Phase 1 --- Backend Foundation

## Goal

Create the application skeleton.

Recommended structure:

``` text
src/
├── app/
├── config/
├── modules/
├── infrastructure/
├── shared/
└── server.ts
```

Implement:

-   Express application
-   environment validation
-   centralized error handling
-   request ID middleware
-   logging
-   CORS
-   security headers
-   JSON parsing
-   route registration
-   health endpoint
-   readiness endpoint

Endpoints:

``` text
GET /health
GET /ready
```

## Rules

Controllers must be thin.

Do not implement business logic yet.

------------------------------------------------------------------------

# 6. Phase 2 --- Database Foundation

## Goal

Connect PostgreSQL + PostGIS and establish migration infrastructure.

Docker:

``` text
PostgreSQL + PostGIS
Redis
```

Implement:

-   Prisma
-   PostgreSQL connection
-   PostGIS extension
-   migration system
-   seed system
-   database health check

At this stage create the initial schema foundation.

Do not prematurely create every future table if its design has not yet
been implemented.

------------------------------------------------------------------------

# 7. Phase 3 --- Authentication

## Goal

Implement secure OTP authentication.

### Features

``` text
POST /api/v1/auth/request-otp
POST /api/v1/auth/verify-otp
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

Implement:

-   OTP generation
-   OTP hashing
-   Redis storage
-   OTP expiry
-   resend cooldown
-   OTP attempt limit
-   Resend integration
-   access tokens
-   refresh tokens
-   refresh-token rotation
-   revocation
-   authentication middleware
-   role authorization

### Access token

Short-lived.

Recommended:

``` text
15 minutes
```

### Refresh token

Recommended:

``` text
30 days
```

Store only the refresh token hash.

## Tests

At minimum:

``` text
valid OTP
invalid OTP
expired OTP
too many attempts
resend cooldown
valid access token
expired access token
valid refresh token
refresh token rotation
revoked refresh token
logout
unauthorized request
role authorization
```

Automated test infrastructure is intentionally not set up in this
project yet (deferred by explicit request — see git history). The
above was instead verified manually against the real Postgres/Redis
containers: OTP request/verify (valid, invalid, expired-key,
too-many-attempts), resend cooldown, per-IP rate limiting on both
endpoints, refresh rotation, revoked-token reuse detection, idempotent
logout, and `authenticate`/`authorize` middleware (no protected route
exists yet to exercise them over real HTTP — exercised directly
instead). Two real bugs were caught and fixed in the process:
`verifyOtp` was consuming the one-time code before validating that
signup had all required fields, and reuse-detection's revocation
write was being rolled back because it happened inside the same
Prisma transaction as the thrown error.

## Known gap: driver upgrade path

Per an explicit product decision, every new signup is created as
`PASSENGER` (`userRepository.createPassenger`) — there is currently
**no way for a user to become a `DRIVER`**. Vehicle creation (Phase 5)
and ride creation (Phase 7) both require `user.role == DRIVER`
(claude.md §8), so this needs to be resolved — most likely a small
addition to the User module (Phase 4) — before Phase 5 is usable
end-to-end. Do not silently invent this; it's a product decision.

------------------------------------------------------------------------

# 8. Phase 4 --- User Module

## Goal

Build the user/profile domain.

Implement:

``` text
GET /users/me
PATCH /users/me
```

Potential profile data:

``` text
name
phone
email
profile image
role
rating summary
```

Implement:

-   user repository
-   user service
-   validation
-   authorization
-   profile image abstraction
-   user status

Do not allow users to modify server-controlled fields such as:

``` text
rating_average
rating_count
verification status
payment status
```

------------------------------------------------------------------------

# 9. Phase 5 --- Vehicle + Documents

## Goal

Allow drivers to register vehicles and upload documents.

Implement:

``` text
POST /vehicles
GET /vehicles
GET /vehicles/:id
PATCH /vehicles/:id
POST /vehicles/:id/documents
```

Vehicle fields include:

``` text
registration number
make
model
variant
color
vehicle type
seat capacity
AC
AC working status
```

Implement Cloudinary integration behind an abstraction.

Documents:

``` text
RC
INSURANCE
POLLUTION
```

Store metadata in PostgreSQL.

Store actual files in Cloudinary.

## Driver eligibility

Creating a ride must verify:

``` text
driver role
+
vehicle ownership
+
vehicle status = ACTIVE
+
vehicle seat_capacity >= requested seats
```

Document verification (`verification_status`) is tracked (Phase 5.5)
but does **not** gate ride creation in this MVP — see `claude.md`
§8/§96.

Do not rely only on frontend checks.

------------------------------------------------------------------------

# 9a. Phase 5.5 --- Admin Verification Dashboard

## Goal

Allow admins to manually review and approve/reject vehicle documents
uploaded in Phase 5. See `claude.md` §96 for the full module spec.

This phase is inserted between Phase 5 (Vehicle) and Phase 6 (Map +
Fare) because it operates directly on data Phase 5 creates, but it
does not block any later phase — ride creation eligibility (Phase 7)
does not depend on verification status.

## Tasks

-   add `ADMIN` to the user role enum
-   provision admin users via seed script (no public signup)
-   admin authorization middleware (`role === 'ADMIN'`)
-   add `verified_by`, `verified_at`, `rejection_reason` to `vehicles`
    (migration)

## Endpoints

``` text
GET  /api/v1/admin/vehicles?status=PENDING
GET  /api/v1/admin/vehicles/:id
POST /api/v1/admin/vehicles/:id/verify
POST /api/v1/admin/vehicles/:id/reject
```

## Rules

-   admin routes must never be reachable by `DRIVER`/`PASSENGER` roles
-   documents are viewed via signed/private Cloudinary URLs, never raw
    public URLs (`claude.md` §14)
-   rejection requires a `rejection_reason`
-   this module does not touch users, rides, bookings, or payments —
    keep its scope to vehicle document verification only

## Tests

``` text
non-admin cannot access admin routes
list pending vehicles
verify vehicle -> status VERIFIED, verified_by/verified_at set
reject vehicle -> status REJECTED, rejection_reason required
verification status does not block ride creation
```

------------------------------------------------------------------------

# 10. Phase 6 --- Map Provider + Fare Engine

## Goal

Create provider-independent infrastructure.

Implement:

``` text
MapProvider
PaymentProvider
FareStrategy
```

Do not implement payment behavior fully yet.

## MapProvider

Methods:

``` text
geocode
reverseGeocode
getRoute
getDistanceMatrix
```

Initial provider:

``` text
Mapbox
```

The Ride module must not import Mapbox directly.

## Fare

Create:

``` text
FareService
HeuristicFareStrategy
```

Inputs:

``` text
base price
distance
fuel price
vehicle type
traffic multiplier
driver rating
```

Store calculated fare on the ride.

Do not recalculate historical ride fare from current pricing
configuration.

## Tests

Test deterministic fare calculations thoroughly.

------------------------------------------------------------------------

# 11. Phase 7 --- Ride Creation + Lifecycle

## Goal

Allow verified drivers to create and manage rides.

Endpoints:

``` text
POST /api/v1/rides
GET /api/v1/rides/:id
POST /api/v1/rides/:id/cancel
POST /api/v1/rides/:id/start
POST /api/v1/rides/:id/complete
```

Creation flow:

``` text
Authenticate driver
      ↓
Validate vehicle (ownership + ACTIVE + seat capacity)
      ↓
Validate route input
      ↓
MapProvider.getRoute()
      ↓
Calculate distance
      ↓
Calculate fare
      ↓
Calculate 5% driver posting fee
      ↓
Persist ride in PENDING_PAYMENT
      ↓
Create payment order for posting commission
      ↓
Return ride + payment order to client
```

Ride does not become `OPEN` in this request. A payment webhook
(Phase 10) confirms the posting commission and transitions
`PENDING_PAYMENT -> OPEN`. See `claude.md` §18/§19/§97.

Implement state machine:

``` text
PENDING_PAYMENT
OPEN
FULL
STARTED
COMPLETED
CANCELLED
```

Do not allow arbitrary status mutation.

------------------------------------------------------------------------

# 12. Phase 8 --- Ride Search + PostGIS

## Goal

Build one of the most important features of Rydex.

Passenger searches by:

``` text
date
pickup
destination
```

There is no time-range filter.

## Matching

A ride matches when:

``` text
departure date = requested date

AND

origin <= 10 km from requested pickup

AND

destination <= 10 km from requested destination

AND

ride is bookable

AND

available seats > 0
```

Use configuration:

``` text
RIDE_ORIGIN_MATCH_RADIUS_METERS=10000
RIDE_DESTINATION_MATCH_RADIUS_METERS=10000
```

## Query requirements

Use:

``` text
PostGIS
ST_DWithin
ST_Distance
GiST indexes
```

Do not call the map provider for every result.

## Sorting

Support:

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

## Pagination

Use cursor pagination.

Default:

``` text
20 results
```

Maximum should be configurable.

Cursor must be opaque.

## Critical testing

Create realistic test data and verify:

``` text
origin exactly inside radius
origin exactly outside radius

destination inside radius
destination outside radius

both inside
one outside

different dates

no seats

cancelled ride

sorting

pagination

ties
```

Use `EXPLAIN ANALYZE` to verify spatial indexes are actually being used.

------------------------------------------------------------------------

# 13. Phase 9 --- Booking + Seat Concurrency

## Goal

Allow passengers to book rides safely.

Endpoints:

``` text
POST /api/v1/rides/:rideId/bookings
GET /api/v1/bookings/:id
POST /api/v1/bookings/:id/cancel
```

Booking state:

``` text
PENDING_PAYMENT
CONFIRMED
PAYMENT_FAILED
CANCELLED
COMPLETED
```

## Critical requirement

Prevent overselling.

When two passengers attempt to book the last seat simultaneously:

``` text
only one can succeed
```

Use PostgreSQL transaction + row locking.

Conceptually:

``` text
BEGIN

SELECT ride FOR UPDATE

check seats

create booking (PENDING_PAYMENT)

reserve/decrement seats

COMMIT
```

`available_seats` is decremented at booking creation, not at payment
confirmation (`claude.md` §35/§36) — this is what makes the hold real.

## Reservation expiry

Schedule a BullMQ delayed job when a `PENDING_PAYMENT` booking is
created. If payment hasn't completed by the time it fires:

``` text
BEGIN

SELECT ride FOR UPDATE

if booking still PENDING_PAYMENT:
    booking -> CANCELLED (or PAYMENT_FAILED)
    increment available_seats

COMMIT
```

This job must be idempotent and must not release seats for a booking
that was confirmed in the meantime (the row lock + status check
handles this).

Do not trust Redis alone for final seat consistency.

------------------------------------------------------------------------

# 14. Phase 10 --- Payment System

## Goal

Implement payment provider integration safely.

Initial provider:

``` text
Razorpay
```

behind:

``` text
PaymentProvider
```

Implement:

``` text
create order
verify payment
payment status
webhook
```

## Driver posting fee

Driver pays:

``` text
5%
```

when creating/publishing a ride. The webhook that confirms this
payment must also transition the ride `PENDING_PAYMENT -> OPEN`
(`claude.md` §19). If the commission payment fails, transition the
ride to `CANCELLED` instead of leaving it stuck in `PENDING_PAYMENT`.

## Passenger payment

Passenger pays:

``` text
10% upfront
```

This is non-refundable unless the driver cancels.

## Idempotency

Implement:

``` text
Idempotency-Key
```

for payment-producing APIs.

Create:

``` text
idempotency_keys
```

with request hash and stored response.

Same key + same request:

``` text
return original result
```

Same key + different request:

``` text
reject
```

## Webhooks

Webhook must:

``` text
verify signature
identify payment
be idempotent
update payment
update booking
enqueue notification
```

Never trust frontend payment success as final confirmation.

------------------------------------------------------------------------

# 15. Phase 11 --- Cancellation, Refunds, Settlement

## Goal

Implement all money/state transitions.

### Passenger cancellation

``` text
booking -> CANCELLED
seat -> released
10% prepaid -> retained
```

unless future policy changes.

### Driver cancellation

``` text
ride -> CANCELLED
all confirmed bookings -> CANCELLED
passenger prepayments -> refunded
driver posting fee -> refund based on cancellation time
```

Driver posting fee rule:

``` text
>= 18 hours before departure:
    2% of the posting fee refunded
    remaining 3% retained

< 18 hours:
    full 5% posting fee retained
```

Use centralized policy logic.

## Final payment

After ride completion:

``` text
10% already prepaid
90% remaining
```

Application commission:

``` text
3%
```

Driver share:

``` text
97%
```

Example:

``` text
Fare = ₹500
Platform = ₹15
Driver = ₹485
```

The final settlement must use the fare locked to the booking/ride.

------------------------------------------------------------------------

# 16. Phase 12 --- Notification System

## Goal

Build asynchronous notifications.

Infrastructure:

``` text
Redis
BullMQ
FCM
```

Create:

``` text
NotificationService
NotificationRepository
NotificationWorker
```

Store notification history in PostgreSQL.

Create:

``` text
user_devices
notifications
```

## Events/jobs

Initial events:

``` text
BookingConfirmed
BookingCancelled
RideCancelled
RideStarting
RideCompleted
PaymentSuccessful
PaymentFailed
RefundProcessed
```

Flow:

``` text
Business operation
      ↓
Event / job
      ↓
BullMQ
      ↓
Worker
      ↓
FCM
```

Do not block API requests waiting for FCM.

## Reliability

Implement:

``` text
retry
backoff
bounded attempts
idempotent jobs
invalid token cleanup
structured logging
```

------------------------------------------------------------------------

# 17. Phase 13 --- Chat

## Goal

Implement passenger-driver chat.

Use:

``` text
Socket.IO
```

Entities:

``` text
Conversation
Message
```

A conversation is associated with a ride.

Only authorized driver/passenger participants may join.

## WebSocket flow

``` text
connect
  ↓
authenticate
  ↓
authorize
  ↓
join conversation
  ↓
send message
  ↓
persist
  ↓
emit
```

Do not allow a user to join arbitrary conversation IDs.

## Multi-instance readiness

When running multiple backend instances, use Redis-backed Socket.IO
adapter/backplane.

------------------------------------------------------------------------

# 18. Phase 14 --- Security + Rate Limiting

## Goal

Harden the application.

Implement/verify:

``` text
Helmet
CORS
input validation
rate limiting
throttling
authorization
secure cookies/headers where applicable
token security
webhook signature validation
Cloudinary upload validation
secret management
```

## Rate-limit categories

At minimum consider:

``` text
OTP request
OTP verification
ride search
ride creation
booking
payment creation
login/auth endpoints
WebSocket connection
```

Use Redis so limits work across multiple backend instances.

Test HTTP 429 behavior.

------------------------------------------------------------------------

# 19. Phase 15 --- Testing + Hardening

## Goal

Reach production-quality confidence.

### Unit tests

Test:

``` text
fare
commission
cancellation policy
refund policy
state transitions
authorization
cursor encoding/decoding
```

### Integration tests

Test:

``` text
PostgreSQL
PostGIS
Redis
BullMQ
repositories
```

### API tests

Test all important endpoints.

### Concurrency tests

These are mandatory:

``` text
two users book last seat
duplicate payment request
duplicate payment webhook
duplicate refund job
refresh token reuse
driver cancellation during booking
```

### Failure tests

Simulate:

``` text
Redis unavailable
Postgres unavailable
FCM failure
payment provider failure
map provider failure
Resend failure
Cloudinary failure
```

Verify that failures do not corrupt domain state.

------------------------------------------------------------------------

# 20. Phase 16 --- Production Docker + Deployment Preparation

## Goal

Prepare the application for production deployment.

Create:

``` text
Dockerfile
.dockerignore
production environment configuration
```

Container requirements:

-   non-root user
-   minimal image
-   deterministic install
-   production dependencies only
-   health check
-   graceful shutdown

Target:

``` text
AWS ECS Fargate
RDS PostgreSQL + PostGIS
ElastiCache Redis
Load Balancer
```

Do not introduce Kubernetes.

------------------------------------------------------------------------

# 21. Phase 17 --- Final Integration

## Goal

Verify the complete product end-to-end.

Test this complete journey.

### Driver

``` text
Register
  ↓
Verify OTP
  ↓
Create profile
  ↓
Add vehicle
  ↓
Upload documents (verification pending, does not block)
  ↓
Create ride (eligibility = ownership + ACTIVE + seat capacity)
  ↓
Pay 5% posting fee
  ↓
Ride becomes OPEN
```

### Passenger

``` text
Register
  ↓
Verify OTP
  ↓
Search date + pickup + destination
  ↓
Receive rides within 10km on both ends
  ↓
Sort results
  ↓
Select ride
  ↓
Pay 10%
  ↓
Booking confirmed
```

### Ride

``` text
Driver starts ride
  ↓
Passenger travels
  ↓
Driver completes ride
  ↓
Passenger pays remaining 90%
  ↓
3% platform commission
  ↓
Driver settlement
  ↓
Rating
```

### Cancellation

Test:

``` text
passenger cancellation
driver early cancellation
driver late cancellation
refund
notification
seat release
payment state
```

------------------------------------------------------------------------

# 22. Phase Completion Checklist

Claude must maintain this checklist.

``` text
[x] Phase 0 — Repository Initialization
[x] Phase 1 — Backend Foundation
[x] Phase 2 — Database Foundation
[x] Phase 3 — Authentication
[ ] Phase 4 — User
[ ] Phase 5 — Vehicle + Documents
[ ] Phase 5.5 — Admin Verification Dashboard
[ ] Phase 6 — Map + Fare
[ ] Phase 7 — Ride Creation
[ ] Phase 8 — Ride Search
[ ] Phase 9 — Booking
[ ] Phase 10 — Payment
[ ] Phase 11 — Cancellation + Settlement
[ ] Phase 12 — Notifications
[ ] Phase 13 — Chat
[ ] Phase 14 — Security
[ ] Phase 15 — Testing + Hardening
[ ] Phase 16 — Production Deployment Preparation
[ ] Phase 17 — Final Integration
```

Update this checklist only after the phase actually passes its
verification criteria.

------------------------------------------------------------------------

# 23. Definition of Done for Every Phase

A phase is complete only when:

``` text
[ ] implementation complete
[ ] migrations complete
[ ] validation implemented
[ ] authorization implemented
[ ] error handling implemented
[ ] tests added
[ ] typecheck passes
[ ] lint passes
[ ] build passes
[ ] relevant integration tests pass
[ ] documentation updated
[ ] no known architectural violations
```

------------------------------------------------------------------------

# 24. Claude Code Operating Instructions

When starting a session:

``` text
1. Read RYDEX_ARCHITECTURE.md
2. Read RYDEX_PHASES.md
3. Inspect repository
4. Find first incomplete phase
5. Implement only that phase
6. Run verification
7. Fix failures
8. Mark phase complete
9. Continue to next phase only when current phase is stable
```

Claude may implement several phases in one session if the user
explicitly asks for it, but it must still preserve the phase boundaries
and verify each phase individually.

------------------------------------------------------------------------

# 25. Do Not Ask for Unnecessary Confirmation

If the architecture and requirements already answer a question, proceed.

Do not repeatedly ask:

``` text
Should I create the service?
Should I create the database?
Should I implement authentication?
```

Instead, follow the phase plan.

Ask the user only when:

-   two requirements conflict
-   an important business rule is genuinely undefined
-   a destructive operation is required
-   an external credential is required
-   a decision materially changes the architecture

------------------------------------------------------------------------

# 26. Do Not Invent Business Requirements

If a behavior is not defined:

``` text
do not silently invent a business rule
```

For implementation details, use engineering best practices.

For business policy, flag the ambiguity.

Examples of business policy:

``` text
refund percentage
fare formula
cancellation rules
booking timeout
seat limits
verification requirements
```

------------------------------------------------------------------------

# 27. Maintain an Architecture Decision Record

When a meaningful architectural decision changes, create/update:

``` text
docs/architecture-decisions/
```

Example:

``` text
ADR-001-modular-monolith.md
ADR-002-postgis.md
ADR-003-refresh-token-rotation.md
```

Do not create an ADR for trivial code changes.

------------------------------------------------------------------------

# 28. Database Migration Rules

Never modify production schema manually without a migration.

Every schema change:

``` text
Prisma schema
      ↓
migration
      ↓
test
```

Migrations must be reviewed for:

-   destructive changes
-   locking implications
-   indexes
-   foreign keys
-   nullability
-   data migration requirements

Never casually delete production columns/tables.

------------------------------------------------------------------------

# 29. Git Strategy

Use small logical commits.

Examples:

``` text
feat(auth): implement OTP verification
feat(ride): add PostGIS ride search
feat(booking): add transactional seat reservation
feat(payment): add idempotent payment creation
fix(booking): prevent duplicate seat allocation
test(ride): add spatial search tests
```

Do not create one enormous commit containing the entire application.

------------------------------------------------------------------------

# 30. Final Instruction

The project must evolve like this:

``` text
EMPTY FOLDER
     |
     v
FOUNDATION
     |
     v
DATABASE
     |
     v
AUTH
     |
     v
USER
     |
     v
VEHICLE
     |
     v
MAP + FARE
     |
     v
RIDE
     |
     v
SEARCH
     |
     v
BOOKING
     |
     v
PAYMENT
     |
     v
CANCELLATION + SETTLEMENT
     |
     v
NOTIFICATION
     |
     v
CHAT
     |
     v
SECURITY
     |
     v
TESTING
     |
     v
DEPLOYMENT
     |
     v
PRODUCTION-READY RYDEX
```

The implementation should remain **production-oriented without becoming
prematurely distributed**.

The architecture document defines **what the system is**.

This document defines **how Claude Code should build it**.

Both files must be treated as living project documentation.
