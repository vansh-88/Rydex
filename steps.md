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
Phase 4.5 → Driver upgrade (license verification)
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
Phase 13.5 → AI Support Chatbot
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

## Known gap: driver upgrade path --- resolved (see Phase 4.5)

Per an explicit product decision, every new signup is created as
`PASSENGER` (`userRepository.createPassenger`) — there was, at the time
this note was written, **no way for a user to become a `DRIVER`**.
Vehicle creation (Phase 5) and ride creation (Phase 7) both require
`user.role == DRIVER` (claude.md §8), so this had to be resolved before
Phase 5 could be usable end-to-end.

Resolved via an explicit product decision (asked directly, not
invented): a `PASSENGER` submits a driving-license document; an admin
reviews and approves/rejects it; approval flips `role -> DRIVER`. See
Phase 4.5 below and claude.md §8/§96/§97 (2026-08-11).

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

## Status: complete

Implemented `GET /api/v1/users/me` and `PATCH /api/v1/users/me`, both
behind the existing `authenticate` middleware (no separate authorization
rule needed — every user may only ever read/write their own profile, since
the id comes from the access token, never the request body/params).

`PATCH` accepts `name`, `phone`, `email`, `profileImageUrl` only; the zod
schema silently strips any other key (`role`, `status`, `ratingAverage`,
`ratingCount`, ...), and `.refine()` rejects an empty body. A dedicated
"profile image abstraction" was not built — Cloudinary integration is
Phase 5's job; for now `profileImageUrl` just accepts a URL string
directly, matching what the current schema can actually store.

## Real bug found and fixed during manual verification

Manually exercising the duplicate-email/duplicate-phone path (no
automated test infra yet, per the Phase 3 note) surfaced a bug that
predates this phase: `authService.isUniquePhoneViolation` — and the
equivalent check written for this phase's `userService.updateProfile`
— assumed Prisma's older `err.meta.target: string[]` shape for P2002
unique-constraint errors. Prisma 7's pg driver adapter reports the
violated column(s) at `err.meta.driverAdapterError.cause.constraint.fields`
instead; `target` is no longer set. Both checks silently failed closed,
so duplicate phone/email fell through as raw `INTERNAL_ERROR` 500s
instead of `PHONE_ALREADY_IN_USE` / `EMAIL_ALREADY_IN_USE` 409s.

Fixed once, centrally, in `src/infrastructure/database/prismaErrors.ts`
(`getUniqueConstraintFields`), which checks both shapes so it keeps
working across driver-adapter versions. Both `authService.ts` and the
new `userService.ts` now call it instead of duplicating driver-specific
error parsing. Verified against the real Postgres container: duplicate
email on `PATCH /users/me` → 409 `EMAIL_ALREADY_IN_USE`; duplicate phone
on `PATCH /users/me` → 409 `PHONE_ALREADY_IN_USE`; duplicate phone on
signup (`POST /auth/verify-otp`) → 409 `PHONE_ALREADY_IN_USE` (previously
500). Also verified: `GET /users/me` without a token → 401; role/rating
fields silently stripped from `PATCH` body; empty `PATCH` body → 400.

------------------------------------------------------------------------

# 8a. Phase 4.5 --- Driver Upgrade (License Verification)

## Goal

Resolve the driver-upgrade gap flagged above: give a `PASSENGER` a way
to become a `DRIVER`, per the explicit product decision in claude.md
§8/§96/§97 (2026-08-11) — submit a driving-license document, get
reviewed by an admin, get approved or rejected.

This phase is inserted between Phase 4 (User) and Phase 5 (Vehicle)
because Phase 5's vehicle-creation endpoint is gated on
`user.role == DRIVER`, and until this phase exists nobody can ever
reach that role. It also stands up the first slice of the Admin Module
(claude.md §96) — the vehicle-verification half of that module still
belongs to Phase 5.5.

## Tasks

-   Prisma: `UserDocumentType` enum (`DRIVING_LICENSE`); `User` gains
    `driverLicenseStatus` (`NONE | PENDING | VERIFIED | REJECTED`,
    default `NONE`), `driverLicenseVerifiedBy` (FK → `users`,
    nullable), `driverLicenseVerifiedAt`, `driverLicenseRejectionReason`
-   Cloudinary provider abstraction + signed/private URL generation
    (claude.md §14, §17-style strategy interface) — shared by this
    phase and Phase 5's vehicle documents
-   Upload middleware: file-type allowlist checked by magic bytes (not
    just the client-sent MIME type), size limit
-   `POST /api/v1/users/me/driver-application` — passenger submits a
    license file; rejects if already `DRIVER` or already `PENDING`
-   Admin authorization middleware (`role === 'ADMIN'`) — reused as-is
    from the generic `authorize(...)` already built in Phase 3
-   `GET /api/v1/admin/driver-applications?status=PENDING`
-   `POST /api/v1/admin/driver-applications/:userId/verify` — atomic:
    `driverLicenseStatus -> VERIFIED` **and** `role -> DRIVER`
-   `POST /api/v1/admin/driver-applications/:userId/reject` — requires
    `rejectionReason`; role stays `PASSENGER`, resubmission allowed

## Rules

-   No self-serve role upgrade — only admin approval sets `role`
-   A previously-issued access token keeps the old role until the next
    `POST /auth/refresh` (tokenService already re-reads role from the
    DB on every rotation — claude.md §8)
-   This does not widen the Admin Module beyond what claude.md §96 now
    documents: vehicle documents + driver licenses, nothing else

## Status: complete

Implemented as described above: `UserDocumentType`/`DriverLicenseStatus`
enums and the four `driverLicense*` fields on `User` (migration
`20260811082340_driver_license_verification`); a `CloudinaryDocumentProvider`
behind a `DocumentProvider` interface (`src/infrastructure/cloudinary/`),
uploading with Cloudinary's `authenticated` delivery type and generating
short-lived signed URLs on read rather than storing a permanently-usable
link; a multer + magic-byte upload middleware
(`src/app/middleware/uploadDocument.ts`) shared with Phase 5's vehicle
documents; `POST /api/v1/users/me/driver-application`; and the first slice
of the Admin Module (`src/modules/admin/`) with `GET|POST
/api/v1/admin/driver-applications...`.

Verified end-to-end against the real Postgres/Cloudinary containers/account
(no automated test infra yet, per the Phase 3 note): submit → 200 PENDING;
resubmit while PENDING → 409 `DRIVER_APPLICATION_PENDING`; non-admin hitting
`/admin/driver-applications` → 403; admin list returns a working signed
Cloudinary URL that was fetched and confirmed to be the real uploaded file;
verify → role flips `PASSENGER → DRIVER` and `driverLicenseStatus →
VERIFIED`; verifying an already-decided application → 409
`DRIVER_APPLICATION_NOT_PENDING`; verifying a nonexistent user → 404
`USER_NOT_FOUND`; the pre-existing access token issued before approval
still decoded to `role: PASSENGER`, and `POST /auth/refresh` correctly
issued a new token with `role: DRIVER` (confirms claude.md §8's claim about
`tokenService` re-reading role on rotation, without needing new code);
reject without `rejectionReason` → 400; reject with a reason → 200, and
`GET /users/me` reflected `REJECTED` + the reason; resubmitting after
rejection succeeded and cleared the stale rejection reason back to `null`;
an invalid `?status=` query on the admin list endpoint → 400. A fake `.png`
that was actually plain text was correctly rejected by the magic-byte check
(client-sent MIME type alone would have let it through).

One real bug found during this verification, unrelated to the code above:
`.env`'s `CLOUDINARY_CLOUD_NAME` was set to the dashboard display name
("Rydex") rather than the actual lowercase cloud slug, which Cloudinary's
SDK rejects outright. Not a code defect — flagged to the user, who
corrected `.env`.

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
vehicle verification_status = VERIFIED
+
vehicle seat_capacity >= requested seats
```

**Updated 2026-08-11 (claude.md §97):** verification now *does* gate ride
creation — this reverses what this section originally said. A vehicle
reaches `VERIFIED` only through Phase 5.5's admin endpoints; until then it
can be created, listed, and managed by its owner, but Phase 7 (not yet
built) will reject it for ride creation.

Do not rely only on frontend checks.

## Status: complete

Implemented `POST /vehicles`, `GET /vehicles`, `GET /vehicles/:id`, `PATCH
/vehicles/:id`, and `POST /vehicles/:id/documents`
(`src/modules/vehicle/`). Creation is gated to `DRIVER` via
`authorize('DRIVER')`; read/update/document-upload are scoped by ownership
in the service layer (every vehicle owner is already a `DRIVER` by
construction, so no extra role check is needed there). Registration
numbers are normalized (uppercased, whitespace/hyphens stripped) before
the uniqueness check, so `"KA 01 AB 1234"` and `"ka01ab1234"` collide as
expected. Document uploads reuse Phase 4.5's Cloudinary provider and
upload middleware — no duplicated upload/signing logic.

Verified end-to-end against the real Postgres/Cloudinary containers:
`PASSENGER` blocked from `POST /vehicles` → 403; created a vehicle as a
freshly-approved `DRIVER`; duplicate (normalized) registration number →
409 `REGISTRATION_NUMBER_ALREADY_IN_USE`; `GET`/`PATCH` round-tripped
correctly, including a client attempt to set the server-controlled
`verificationStatus` being silently stripped rather than erroring;
uploaded an RC document and confirmed it appears in the vehicle's
`documents` array with a working signed URL; a second driver got 404
(not 403) on another driver's vehicle by id, by PATCH, and saw an empty
list from `GET /vehicles` — ownership boundaries hold and existence isn't
leaked across drivers.

Not built in this phase (intentionally out of scope, tracked separately):
Phase 5.5's admin vehicle-verification endpoints, and Phase 7's ride
creation eligibility check that will consume `verification_status`.

------------------------------------------------------------------------

# 9a. Phase 5.5 --- Admin Verification Dashboard

## Goal

Allow admins to manually review and approve/reject vehicle documents
uploaded in Phase 5. See `claude.md` §96 for the full module spec.

This phase is inserted between Phase 5 (Vehicle) and Phase 6 (Map +
Fare) because it operates directly on data Phase 5 creates.

**Updated 2026-08-11 (claude.md §97):** ride creation eligibility
(Phase 7) *does* now depend on verification status — this reverses
what this section originally said. A vehicle must reach
`verification_status = VERIFIED` through this phase's endpoints before
it is ride-eligible. The `ADMIN` role, its authorization middleware,
and admin provisioning already exist by this point (built in Phase
4.5) — this phase only adds the vehicle-specific review endpoints and
the `vehicles.verified_by`/`verified_at`/`rejection_reason` columns.

## Tasks

-   add `verified_by`, `verified_at`, `rejection_reason` to `vehicles`
    (migration)
-   reuse the `authorize('ADMIN')` middleware and admin routing already
    set up in Phase 4.5 — no new admin plumbing needed

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
PENDING/REJECTED vehicle is not ride-eligible; VERIFIED is (once Phase 7 exists)
```

## Status: complete

No migration was needed — `vehicles.verified_by`/`verified_at`/
`rejection_reason` already existed from the Phase 2 init migration. This
phase was pure application layer: `GET /admin/vehicles?status=PENDING`,
`GET /admin/vehicles/:id`, `POST /admin/vehicles/:id/verify`, `POST
/admin/vehicles/:id/reject` (`src/modules/admin/`), reusing the
`authorize('ADMIN')` middleware and admin routing already set up in Phase
4.5 exactly as planned — no new admin plumbing.

The verify/reject repository functions use the same conditional-update
pattern as Phase 4.5's driver-license decision (`UPDATE ... WHERE id = ?
AND verification_status = 'PENDING'`), so two concurrent admin decisions
on the same vehicle can't both apply (claude.md §58).

While building this, the document-signing snippet
(`documentProvider.getSignedUrl` + `extractFormatFromSecureUrl`) had
already been written twice — once for driver licenses, once for vehicle
documents — so it was pulled into a shared `toSignedDocumentUrl` helper in
`src/infrastructure/cloudinary/index.ts` and both existing call sites were
switched over. The admin vehicle service also reuses Phase 5's exported
`toVehicleDto`/`toDocumentDto` mappers rather than re-deriving the vehicle
DTO shape a third time.

Verified end-to-end against the real Postgres/Cloudinary containers/account
(no automated test infra yet, per the Phase 3 note): a `DRIVER` (not
`ADMIN`) hitting `/admin/vehicles` → 403; admin lists two pending vehicles
(one with an uploaded RC document, whose signed URL round-tripped
correctly) alongside owner contact details; `GET /admin/vehicles/:id`
returns the same shape for a single vehicle; verify → `VERIFIED` with
`verified_by` correctly set to the admin's own id (confirmed directly in
Postgres) and reflected on the owner's own `GET /vehicles`; verifying an
already-decided vehicle → 409 `VEHICLE_NOT_PENDING`; reject without a
`rejectionReason` → 400; reject with a reason → `REJECTED` with the reason
stored and visible to the owner; verify/reject on a nonexistent vehicle →
404 `VEHICLE_NOT_FOUND`; an invalid `?status=` query → 400.

Not built in this phase (out of scope, tracked separately): Phase 7's ride
creation eligibility check that will actually read `verification_status`
to decide ride-creation eligibility — there is no ride module yet for it
to gate.

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

## Status: complete

Implemented `MapProvider` (`src/infrastructure/maps/mapProvider.ts`) —
`geocode`/`reverseGeocode`/`getRoute`/`getDistanceMatrix`, exactly as
specified in claude.md §17 — with `GeoapifyMapProvider` as the concrete
implementation (`src/infrastructure/maps/geoapifyMapProvider.ts`), wired
up via a factory (`src/infrastructure/maps/index.ts`) that switches on a
new `MAP_PROVIDER` env var, mirroring the existing Resend/Cloudinary
factory pattern. **Geoapify replaces the originally-planned Mapbox** —
see claude.md §17/§97 (2026-08-12) for the full reasoning: Mapbox's
signup now requires a card, which conflicts with an explicit
no-payment-method constraint; Geoapify was chosen after comparing it
against OpenRouteService, LocationIQ, MapTiler, and self-hosted
OSRM+Nominatim.

Also implemented the Fare engine under a new `ride` module (only its
`strategies/`/`services/` slice — controllers/routes/repositories are
Phase 7's job): `FareStrategy` interface + `HeuristicFareStrategy`
(`src/modules/ride/strategies/`) implementing claude.md §29's formula
(`baseFare + distanceKm * pricePerKm`, then bounded vehicle/traffic/
rating multipliers — rating multiplier is linearly interpolated between
configured min/max bounds across the 1-5 rating range, per §29's
"driver-rating influence must be bounded"), and `calculateFare()`
(`src/modules/ride/services/fareService.ts`) as the single call site the
future Ride module will use, taking an injectable `FareStrategy` for
testability. All fare inputs (base fare, price/km, per-`VehicleType`
multipliers, traffic/rating multiplier bounds) are new `FARE_*` env vars
— nothing hard-coded, per §29/§85.

No automated test infra exists yet (per the Phase 3 note), so this was
verified manually with a temporary script exercising the real Geoapify
API and the real fare formula end-to-end (deleted after verification,
not committed): geocode/reverseGeocode/getRoute/getDistanceMatrix all
returned correctly-shaped real results for Bangalore addresses
(Koramangala, Whitefield, Jayanagar); a nonexistent address correctly
threw `GEOCODE_NOT_FOUND` instead of silently returning nothing; fare
calculations were checked by hand against the formula for a ~22km
sedan/hatchback ride (multiplier ratio matched exactly), a 5-star SUV
ride with high traffic input (rating and traffic multipliers both
applied and matched hand-calculated values), a 1-star sedan ride
(multiplier correctly pulled fare down, not up), an intentionally
out-of-range traffic multiplier (999) to confirm clamping actually
clamps to the configured max rather than exploding the fare, and a
zero-distance ride (fare correctly reduces to exactly the base fare).
`npm run typecheck`, `npm run lint`, and `npm run build` all pass.

Not built in this phase (intentionally, per steps.md §10's own scope and
claude.md §87): no ride HTTP endpoints, no ride persistence, no map
matching (claude.md §17 interface still has no `mapMatch` method — no
current requirement drives adding one), no map-tile/rendering concern
(that's a frontend SDK choice, outside `MapProvider` entirely). Phase 7
consumes both `mapProvider` and `calculateFare()` when ride creation is
built.

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

## Status: complete

Implemented all five endpoints (`src/modules/ride/`). Notable
architectural gap found and closed along the way: Phase 6 was supposed to
stand up `PaymentProvider` (steps.md Phase 6 goal explicitly lists it
alongside MapProvider/FareStrategy) but only built the latter two. Ride
creation's flow (step 12: "create payment order for posting commission")
needs a real call site, so this phase added the interface +
`StubPaymentProvider` (`src/infrastructure/payments/`) that Phase 6
should have included — see claude.md §37 (2026-08-12). It generates a
locally-referenced order id, not a real charge; Phase 10 swaps in
`RazorpayProvider` behind the same interface.

New `Ride` Prisma model (migration `20260812123854_ride_creation`):
`origin`/`destination` are `Unsupported("geography(Point,4326)")` since
Prisma Client has no native geography type, so the ride repository
(`src/modules/ride/repositories/rideRepository.ts`) reads/writes them via
raw SQL (`Prisma.sql`/`Prisma.raw`, claude.md §77) using
`ST_MakePoint`/`ST_X`/`ST_Y` — every other column (including the
`PENDING_PAYMENT`/`OPEN`/`FULL`/`STARTED`/`COMPLETED`/`CANCELLED` status
transitions) goes through the normal Prisma Client API. GiST indexes on
`origin`/`destination` were hand-added to the generated migration SQL
(claude.md §16) since Prisma can't declare `@@index` on an `Unsupported`
field.

Vehicle eligibility for ride creation (ownership + `ACTIVE` +
`VERIFIED` + seat capacity, claude.md §8/§97) lives in one function,
`assertVehicleEligibleForRide`
(`src/modules/ride/services/vehicleEligibilityService.ts`), reused as
claude.md §96 says it should be. Commission calculation
(`src/modules/ride/services/commissionService.ts`) centralizes the 5%
posting-fee formula (§30) in one place. Every external call
(`MapProvider.getRoute`, `PaymentProvider.createOrder`) happens before
the single ride INSERT — no external call sits inside a DB transaction
(§5.5).

Not built in this phase, intentionally deferred: cancellation
refunds/booking-cascade (Phase 11 — no Booking/Payment/Transaction
tables exist yet), the actual `PENDING_PAYMENT -> OPEN` webhook
transition (Phase 10 — no way to reach `OPEN` in this phase except a
direct DB update for testing), ride search (Phase 8).

Verified end-to-end against the real Postgres/Geoapify/Cloudinary stack
(no automated test infra yet, per the Phase 3 note; dev server run with
`RESEND_API_KEY`/`RESEND_FROM_EMAIL` temporarily blanked so OTPs logged
to console instead of emailing, since a real Resend key is configured in
this environment's `.env`): took a `PASSENGER` through the full
driver-license approval flow to `DRIVER`, confirmed the refreshed access
token carries the new role (mirrors the Phase 4.5 verification of the
same claim), created and admin-verified a vehicle, then created a real
ride — Geoapify returned a real 19.7 km / ~18.5 min route between
Koramangala and Whitefield, fare computed to ₹188/seat (hatchback), and
posting commission to ₹28 (188 × 3 seats × 5%, rounded), matching hand
calculation exactly; geography columns round-tripped correctly
(confirmed via `ST_X`/`ST_Y` directly in Postgres). Verified: a
`PASSENGER` creating a ride → 403 `FORBIDDEN`; a past `departureTime` →
400 `VALIDATION_ERROR`; seats exceeding vehicle capacity → 409
`VEHICLE_NOT_ELIGIBLE`; a nonexistent vehicle → 404 `VEHICLE_NOT_FOUND`;
an unverified (`PENDING`) vehicle → 409 `VEHICLE_NOT_ELIGIBLE`; `GET
/rides/:id` by a non-owner passenger succeeds (rides are readable by
anyone, unlike vehicles); a non-owner calling `/cancel` gets 404 (not
403 — ownership existence isn't leaked, same pattern as vehicles);
`start` on a `PENDING_PAYMENT` ride → 409 `INVALID_RIDE_STATE`;
`complete` before `start` → 409; a full happy-path lifecycle
(`PENDING_PAYMENT` →manual DB flip→ `OPEN` → `start` → `STARTED` →
`complete` → `COMPLETED`) succeeded, with a second `start` call on the
now-`STARTED` ride correctly rejected; cancelling an already-`CANCELLED`
or `COMPLETED` ride both correctly rejected with 409. `npm run
typecheck`, `npm run lint`, and `npm run build` all pass.

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

## Status: complete

Implemented `GET /api/v1/rides/search` (`src/modules/ride/`), registered
before `GET /:id` in the router since Express would otherwise match
`search` as the `:id` param. Query params: `date`, `pickupLat/Lng`,
`destinationLat/Lng`, `sort` (default `DEPARTURE_TIME`), `cursor`,
`limit` — validated by a new `validateQuery` middleware
(`app/middleware/validate.ts`) that stores the coerced result on
`req.validatedQuery` rather than reassigning `req.query`, since Express 5
makes `req.query` a getter-only property (confirmed directly in
`express/lib/request.js` before writing this — reassigning it throws).

`rideSearchRepository.search()` is one hand-written raw-SQL query
(claude.md §77) joining `rides`/`vehicles`/`users`, using
`ST_DWithin`/`ST_Distance` for the 10km radius match and distance
sorting (never JS distance math, never a per-result MapProvider call —
§23). The date filter converts the requested Asia/Kolkata calendar date
into a UTC `[start, end)` range (`utils/kolkataDate.ts`) — a hardcoded
`+05:30` offset is correct here specifically because India has used a
single fixed offset with no DST since 1945, not a general timezone
shortcut. Sort options map through a fixed internal switch
(`sortExpression`) to one of five whitelisted SQL fragments — the client
only ever sends the enum value, never SQL (§25). Cursor pagination
(§26) is keyset-based: `(sortExpr, id) > (cursorValue, cursorId)`,
base64url-encoded JSON, rejected with `INVALID_CURSOR` if malformed or
minted for a different sort order than the current request. `available_seats
> 0 AND status IN ('OPEN','FULL')` remains the authoritative "bookable"
condition (§22 — `FULL` alone isn't sufficient). `DRIVER_RATING` sorts
via `COALESCE(u.rating_average, 6)` so an unrated driver sorts last
without breaking the keyset comparison (a `NULL` in a row-comparison
tuple isn't a total order).

Verified against the real Postgres/PostGIS container with 17 seeded
rides at precisely controlled distances (computed via an equirectangular
offset from a fixed reference point — accurate to well under 1km at this
scale, more than enough margin for 10km-boundary tests) and precisely
controlled dates/status/seats/fares (created through the real
`POST /rides` endpoint, then adjusted via direct SQL for the scenarios
the HTTP API can't produce yet — `OPEN` status, since Phase 10's webhook
doesn't exist; specific fares/times/seat counts for deterministic sort
tests): origin exactly inside (9900m) vs exactly outside (10100m) the
10km radius; same for destination; both-inside, one-outside (both
directions), and both-outside combinations; a ride on the wrong date
correctly excluded; zero-seats and `CANCELLED` rides correctly excluded;
all 9 genuinely-matching rides returned. All five sort orders verified
correct against hand-computed expected orderings, including three- and
seven-way ties resolved by ascending `id` exactly as predicted (`DEPARTURE_TIME`
and `PICKUP_DISTANCE` ties; a `DRIVER_RATING` sort where every ride
shared the same driver, so the entire result fell back to pure
id-ascending order — a stronger tie-break test than a partial tie).
Cursor pagination walked all 5 pages at `limit=2` sorted by `FARE`,
correctly splitting a tied pair (150, 150) across a page boundary with
no duplicate or missing rows across 9 total items. Verified error paths:
malformed cursor and a cursor minted under a different sort → 400
`INVALID_CURSOR`; invalid date format and missing required query params →
400 `VALIDATION_ERROR`; `limit=1000` silently clamped to
`RIDE_SEARCH_MAX_LIMIT` rather than erroring; missing auth → 401.
`EXPLAIN ANALYZE` against the real search query confirmed `Bitmap Index
Scan` on both `rides_origin_gist` and `rides_destination_gist` (combined
via `BitmapAnd` with the `departure_time`/`status` btree index) — the
spatial GiST indexes are actually used, not sequentially scanned. `npm
run typecheck`, `npm run lint`, and `npm run build` all pass.

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

## Status: complete

Implemented all three endpoints (`src/modules/booking/`): `POST
/rides/:id/bookings` is registered on `rideRouter`
(`src/modules/ride/routes.ts`) per claude.md §51's nesting, but its
controller/service/repository all live in the booking module — routing
is the only thing that crosses the module boundary, same pattern
`admin/routes.ts` already established. `GET /bookings/:id` and `POST
/bookings/:id/cancel` are a new `bookingRouter` mounted at
`/api/v1/bookings`.

Two real architectural gaps found and closed along the way, both
documented in claude.md §97 (2026-08-13):

-   §32 listed `booking_status` and `payment_status` as two separate
    columns, but §33's actual state list describes one lifecycle, not
    two — resolved to a single `status` column, matching the precedent
    Ride already set (§19). Schema/architecture doc updated to match.
-   Phase 9's seat-hold expiry requires a BullMQ delayed job, but no
    BullMQ infrastructure exists yet (it was sequenced for Phase 12).
    Added `bullmq` + `src/infrastructure/queue/` now — a dedicated
    ioredis connection (`maxRetriesPerRequest: null`, required by
    BullMQ, kept separate from `infrastructure/redis`'s rate-limiting
    connection) and one `booking-expiry` queue. The Worker runs inside
    the same process as the API server for now (§66: this doesn't
    break statelessness — Redis holds all job state, any instance can
    pick up any job) and is started/closed alongside the HTTP server in
    `server.ts`. Phase 12 reuses this same queue infrastructure.

Seat reservation (claude.md §36) is one atomic conditional `UPDATE`
(`rideRepository.reserveSeats`) — `available_seats = available_seats -
N WHERE status IN ('OPEN','FULL') AND available_seats >= N`, in the same
statement flipping `OPEN -> FULL` when a booking exhausts the last seat.
This is the "SELECT ride FOR UPDATE + check + decrement" sequence from
the spec collapsed into one statement — a real Postgres row lock is
still held for the statement's duration, just expressed as a guarded
UPDATE rather than a separate SELECT FOR UPDATE, the same idiom already
used for `rideRepository.cancel/start/complete` (§58). This UPDATE and
the booking `INSERT` run inside one `prisma.$transaction`; the
`PaymentProvider.createOrder()` call for the 10% prepayment (reusing the
same `StubPaymentProvider` from Phase 7, per §37) happens *after* that
transaction commits, then a follow-up single-row update attaches the
order id — external calls never sit inside the seat-reservation
transaction (§5.5), and if `createOrder()` were to fail, the booking
still exists as `PENDING_PAYMENT` and self-heals via the same TTL expiry
path as an abandoned payment.

Cancellation (`bookingRepository.cancel`, passenger-initiated, valid
from `PENDING_PAYMENT` or `CONFIRMED`) and expiry
(`bookingRepository.expireIfPending`, TTL-job-initiated, valid only from
`PENDING_PAYMENT`) are two distinct conditional updates rather than one
shared function — a `CONFIRMED` booking must never be touched by the
expiry job, only by an explicit passenger cancel. Both release seats via
`rideRepository.releaseSeats` inside the same transaction as the
booking-status conditional update, so a booking that's already
terminal by the time either runs is a no-op (idempotent, satisfies
"must not release seats for a booking that was confirmed in the
meantime").

Verified end-to-end against the real Postgres/Redis/BullMQ stack (no
automated test infra yet, per the Phase 3 note; `BOOKING_PAYMENT_TTL_SECONDS`
temporarily set to 5s for fast expiry testing). **The mandatory
concurrency test**: two passengers firing simultaneous `POST
/bookings` requests at a ride with exactly 1 seat left (real parallel
threads, not sequential) — exactly one received 201, the other 409
`NO_SEATS_AVAILABLE`; the ride's `available_seats` ended at exactly 0
(never negative) and `status` correctly flipped to `FULL`; exactly one
booking row existed afterward. Also verified: a driver booking their own
ride → 409 `CANNOT_BOOK_OWN_RIDE`; a nonexistent ride → 404
`RIDE_NOT_FOUND`; requesting more seats than the ride has → 409
`NO_SEATS_AVAILABLE`; booking a still-`PENDING_PAYMENT` (not yet `OPEN`)
ride → 409 `RIDE_NOT_BOOKABLE`; a booking with a custom pickup
coordinate correctly stored it while drop correctly defaulted to the
ride's own destination; fare/prepayment math matched hand calculation
exactly (₹188 fare × 1 seat × 10% → ₹19); `GET /bookings/:id` correctly
visible to both the owning passenger and the ride's driver, and 404 (not
403) for an unrelated passenger — existence not leaked; an unrelated
passenger's cancel attempt → 404; a fresh booking's immediate manual
cancel correctly released the seat and restored ride status to `OPEN`;
cancelling an already-`CANCELLED` booking → 409
`BOOKING_ALREADY_CANCELLED`; and — cleanly isolated from the manual-cancel
test — a booking left completely untouched past the 5s TTL was
automatically transitioned to `CANCELLED` by the BullMQ worker and its
seats released, flipping the ride from `FULL` back to `OPEN` with the
correct count, with no manual intervention. `npm run typecheck`, `npm
run lint`, and `npm run build` all pass.

Not built in this phase, intentionally deferred: actual payment
confirmation (`PENDING_PAYMENT -> CONFIRMED`, `PAYMENT_FAILED`
transitions) — both are Phase 10's webhook; forfeiture of the prepaid
amount and any refund logic on cancellation — Phase 11 (§34).

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

## Status: complete

Implemented `RazorpayProvider` (`src/infrastructure/payments/razorpayProvider.ts`,
real `razorpay` SDK + real HMAC-SHA256 signature verification), `Payment`/
`Transaction`/`IdempotencyKey` Prisma models (migration
`20260812144013_payment_system`), the full payment module
(`src/modules/payment/`: repositories, `paymentRecordService`,
`webhookService`, `POST /api/v1/webhooks/payment`), and
`Idempotency-Key` middleware (`src/app/middleware/idempotency.ts`) wired
onto `POST /rides` and `POST /rides/:id/bookings` — the two
payment-producing endpoints from Phases 7/9.

`PaymentProvider` gained a fourth method, `verifyWebhookSignature`, since
webhook signing is vendor-specific raw crypto that belongs behind the
interface, not hardcoded in the webhook module (claude.md §37/§40).
`StubPaymentProvider` implements it for real (HMAC against
`PAYMENT_PROVIDER_WEBHOOK_SECRET`) so local testing without a Razorpay
account still exercises genuine signature verification. The factory
(`infrastructure/payments/index.ts`) now branches Stub vs. Razorpay on
configured `PAYMENT_PROVIDER_KEY`/`SECRET`, exactly mirroring Resend's
real-vs-console-fallback pattern.

Webhook processing (`webhookService.processPaymentWebhook`) runs the
full claude.md §40 flow in one DB transaction: verify signature →
identify the `Payment` row by `provider_order_id` → idempotency check
(conditional `CREATED -> SUCCESS/FAILED`, so a duplicate delivery is a
no-op) → resolve the matching `Transaction` → apply the ride/booking
state transition (`PENDING_PAYMENT -> OPEN`/`CANCELLED` for the driver's
posting fee, `PENDING_PAYMENT -> CONFIRMED`/`PAYMENT_FAILED` for a
booking's prepayment, releasing seats on failure). Notification
enqueueing (the last step in claude.md §40's flow) is explicitly not
built — Phase 12 doesn't exist yet.

Payment and Transaction rows are created together by one function
(`paymentRecordService.recordOrder`), called from inside the same DB
transaction as the ride/booking INSERT for ride creation, and from a
small follow-up transaction (after the external `createOrder()` call,
per §5.5) for booking creation — see claude.md §97 (2026-08-13) for why
both records are created together rather than Transaction-only-on-success.

One real bug found and fixed during testing, documented in claude.md §97
(2026-08-13): a payment webhook arriving *after* a booking's seat-hold
TTL already expired left the Payment/Transaction correctly `SUCCESS` but
the booking silently stuck `CANCELLED` with no signal anything was
wrong. Fixed by checking the conditional state-transition's return value
and logging an explicit error for manual review — a full fix (automatic
refund) needs Phase 11's refund policy, which doesn't exist yet, so it's
deferred rather than invented.

Verified end-to-end against the real stack (no automated test infra
yet, per the Phase 3 note; `.env` has real Razorpay **test-mode**
credentials, confirmed via genuine `order_...` ids returned from
Razorpay's actual API — not the stub):

-   **Idempotency**: missing `Idempotency-Key` → 400
    `IDEMPOTENCY_KEY_REQUIRED` on both endpoints; a replayed
    identical request returned the exact cached response (same ride/
    booking id, byte-identical JSON) without creating a second resource
    or a second Razorpay order; the same key with a different body → 409
    `IDEMPOTENCY_CONFLICT`.
-   **Webhooks**: a real signed `payment.captured` for a ride's posting
    fee correctly flipped `PENDING_PAYMENT -> OPEN` and resolved
    Payment/Transaction to `SUCCESS`; the identical webhook re-delivered
    → 200, idempotent no-op (verified no re-processing); a wrong
    signature → 401 `INVALID_WEBHOOK_SIGNATURE`; an unrecognized event
    type (e.g. `order.paid`) → 200, no-op; a webhook for an unknown
    `order_id` → 404 `PAYMENT_NOT_FOUND` (deliberately retry-worthy, not
    200 — see claude.md §97 for why); `payment.failed` for a ride's
    posting fee → `PENDING_PAYMENT -> CANCELLED`; `payment.failed` for a
    booking holding the ride's last 2 seats → booking ->
    `PAYMENT_FAILED` and the ride's seats correctly released
    (`0/FULL -> 2/OPEN`); a `payment.captured` for a booking sent
    immediately (well before its TTL) → `CONFIRMED`, and confirmed
    still `CONFIRMED` 10 seconds past the TTL window — proving
    `cancelScheduledBookingExpiry` actually removed the pending BullMQ
    job rather than relying solely on the (already idempotent) no-op
    path.

`npm run typecheck`, `npm run lint`, and `npm run build` all pass.

Not built in this phase, intentionally deferred to Phase 11
(Cancellation, Refunds, Settlement): `RazorpayProvider.refund()` (still
throws), the driver-cancellation refund-percentage policy (§31), final
90% payment collection and 97/3 driver/platform settlement split (§41),
and automatic refund handling for the late-payment-after-expiry edge
case found above.

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

## Status: complete

Implemented all three money/state-transition flows in `src/modules/ride/`,
`src/modules/booking/`, and `src/modules/payment/`.

**Driver cancellation cascade** (`rideService.cancelRide`, rewritten):
computes the refund policy (`cancellationPolicyService.
calculateDriverCancellationRefund`, new — the sole place §31's formula is
computed: `refundAmount = round(postingCommissionAmount *
(DRIVER_EARLY_CANCEL_REFUND_PERCENT / DRIVER_COMMISSION_PERCENT))`, i.e.
2/5 of the captured commission when `departureTime - now >=
DRIVER_CANCEL_THRESHOLD_HOURS`, else 0; `retainedAmount` is the complement
so the two always sum to exactly the commission, satisfying §84 "refund
cannot exceed refundable amount" by construction) *before* opening a
transaction, then in one `prisma.$transaction`: conditionally cancels the
ride (`rideRepository.cancel`, now `(db, id)` — its only call site, always
inside this cascade), finds every still-active booking on it
(`bookingRepository.findActiveByRideId`, new: `PENDING_PAYMENT`|
`CONFIRMED`), and for each one gates strictly on `bookingRepository.
cancel(tx, id)`'s own return value (not the find's snapshot) before
releasing its seat or creating a refund — so a booking a passenger
self-cancelled microseconds earlier in a separate committed tx is skipped
entirely, never double-refunded. A booking that *was* `CONFIRMED` gets a
`PENDING` `REFUND` transaction for its full prepaid amount (§34: driver
cancellation is the one case the 10% *is* refunded); one that was still
`PENDING_PAYMENT` gets no refund (nothing was captured) but its scheduled
BullMQ expiry job is now pointless and is removed after commit. If the
driver's own commission was actually captured (`paymentRepository.
findSuccessfulByRideId`) and the policy says `refundAmount > 0`, one more
`PENDING` `REFUND` transaction is created for the driver. Per §59 ("do not
call external payment APIs inside the transaction"), the actual
`PaymentProvider.refund()` calls are deferred to a new BullMQ `refund`
queue/worker (`src/infrastructure/queue/queues.ts`+`refundWorker.ts`,
mirroring `booking-expiry` exactly), scheduled after the cascade commits.

**Refund processing** (`src/modules/payment/services/refundService.ts`,
new): `processRefund` loads the `REFUND` transaction and short-circuits if
it's not `PENDING` *before* ever calling the provider — closes a
crash-then-retry window where the process could die after
`PaymentProvider.refund()` succeeds at the gateway but before the DB
commit, which would otherwise cause a BullMQ retry to refund the same
payment twice. Dispatches on whether `bookingId`/`rideId` is set to find
the original captured `Payment` (`paymentRepository.
findSuccessfulByBookingId`/`findSuccessfulByRideId`, new) for its
`providerPaymentId`, calls `PaymentProvider.refund()`, then resolves the
transaction `PENDING -> SUCCESS` (`transactionRepository.resolveById`,
new — same conditional-update idempotency pattern as everywhere else in
this codebase) with the real/stub refund id. `RazorpayProvider.refund()`
and `StubPaymentProvider.refund()` (both previously threw, per Phase 10's
notes) are now implemented for real — Razorpay via `client.payments.
refund(paymentId, { amount })`, Stub via a locally-generated reference id,
same real-vs-fallback split as every other provider in this codebase.

**Passenger cancellation**: already correct by omission (no refund code
existed anywhere, so the 10% was already effectively "retained," §34) —
this phase adds one guard: `bookingService.cancelBooking` now checks
(inside its existing transaction, to avoid a TOCTOU gap against a
concurrently-starting ride) whether the ride has reached `STARTED`/
`COMPLETED` via a new `rideRepository.findStatusById`, and rejects with a
new `409 BOOKING_NOT_CANCELLABLE` if so. Without this, a passenger could
self-cancel a `CONFIRMED` booking after the ride starts and dodge the
final-payment collection this same phase adds — closing that gap was
judged in-scope here rather than deferred, since it's a direct financial-
invariant hole created by this phase's own final-payment work.

**Final payment + settlement**: `rideService.completeRide` now calls
`finalPaymentService.createFinalPaymentOrdersForRide(rideId)` (new,
`src/modules/booking/services/`) after `rideRepository.complete()`
succeeds — synchronous with the same request, mirroring how ride/booking
creation already auto-create their payment orders as part of the same
request rather than requiring a separate passenger-initiated endpoint.
For every `CONFIRMED` booking on the ride, computes the remaining amount
(`settlementService.calculateRemainingFare`, new: `round(totalFare -
prepaidAmount)`, using the fare *locked* on the booking, never
recalculated) and creates a `FINAL_PAYMENT` order via the existing
external-call-then-follow-up-tx pattern (`booking.finalPaymentOrderId`,
new nullable column, migration `20260812171513_settlement_and_refunds`).
Guards against re-creating an order if one already exists (idempotent
against a manual re-invocation after a partial failure, since
`completeRide` itself can't be retried once the ride is `COMPLETED`) and
wraps each booking in try/catch (`Promise.allSettled`) so one failure
doesn't block others or block ride completion. `webhookService` gained a
`FINAL_PAYMENT` branch: on success, `bookingRepository.completeBooking`
(new, conditional `CONFIRMED -> COMPLETED`) and then
`settlementService.calculateSettlement` (new: `platformCommission =
round(totalFare * PLATFORM_COMMISSION_PERCENT/100)`, `driverShare =
totalFare - platformCommission` — the one place §84's "application
commission is calculated exactly once" is computed) is logged in a
structured, greppable line; there is no wallet/payout table in scope
(§6) and `TransactionType` is a closed enum, so the split isn't persisted
as a new row — it's ready for a future payout module to consume. On
failure, logged for manual follow-up (no seat to release, ride already
happened).

**Closed a gap Phase 10 explicitly flagged and deferred to this phase**:
a payment webhook resolving `SUCCESS` *after* the ride/booking it belongs
to already left `PENDING_PAYMENT` via the cancellation cascade (a genuine
race — driver cancels at the same moment a delayed webhook resolves) used
to just `console.error` "needs manual refund review." Both `applied ===
false` branches in `webhookService` (`DRIVER_RIDE_FEE` and
`BOOKING_PREPAYMENT`) now instead create a `PENDING` `REFUND` transaction
in the same tx (reusing the exact same driver-cancellation-policy
calculation for the commission case) and schedule it after commit — the
same machinery the cascade itself uses, so whichever of the two
transactions (cascade vs. webhook) commits second is the one that
actually creates the refund; verified neither double-refunds nor leaves a
captured payment with no refund path.

**Real bug found and fixed before any of the above**: the migration this
phase generated (`prisma migrate dev` diffing the new
`finalPaymentOrderId` column) also silently emitted `DROP INDEX
"rides_origin_gist"`/`"rides_destination_gist"` — because `Ride.origin`/
`destination` are `Unsupported(...)` columns (§16/§77), Prisma's schema-
diff engine has no record that those hand-written GiST indexes
(`20260812123854_ride_creation`) are supposed to exist, and reconciled
them away as "unknown" the moment any other Ride-adjacent migration ran.
Confirmed via `\di rides_*gist` that both indexes were actually gone from
the dev DB. Fixed by editing the migration file to drop the `DROP INDEX`
statements and re-add the original `CREATE INDEX ... USING GIST` ones
verbatim, and re-running them directly against the already-migrated dev
DB. `EXPLAIN ANALYZE` re-confirmed `BitmapAnd` over both GiST indexes plus
the `departure_time`/`status` btree index, matching Phase 8's original
verification. This is a standing risk for any *future* migration too —
worth remembering that any schema change touching `rides` needs its
generated SQL diffed against expectations before applying, not just
trusted, as long as `origin`/`destination` stay `Unsupported`.

Verified end-to-end against the real Postgres/Redis/BullMQ stack (no
automated test infra yet, per the Phase 3 note; `PAYMENT_PROVIDER_KEY`/
`SECRET` and `RESEND_API_KEY` temporarily blanked so `StubPaymentProvider`
handled `refund()` deterministically without needing a real
browser-driven Razorpay checkout to produce a genuine captured payment to
refund against, and OTPs logged to console — both restored afterward)
with a scripted end-to-end run covering: early (>=18h) driver cancellation
— 2/5 driver refund + full passenger refund, both resolved `SUCCESS` by
the worker with a real stub refund id; late (<18h) driver cancellation —
passenger refund only, no driver refund transaction at all; cascade over
a still-unpaid (`PENDING_PAYMENT`) booking — cancelled, seat released, no
refund transaction (nothing was ever captured); the mandatory concurrency
test — two passengers racing for a ride's last seat, exactly one `201`
and one `409`, seats never negative; full final-payment lifecycle —
`FINAL_PAYMENT` order/Payment/Transaction created for exactly the locked
remaining 90%, webhook confirmation flips booking to `COMPLETED`, and the
settlement log line appears with the correct 97/3 split; passenger
self-cancel blocked with `409 BOOKING_NOT_CANCELLABLE` once the ride has
`STARTED`, while the identical cancel *before* start still succeeds and
correctly creates no refund transaction (10% retained); and both webhook-
race scenarios from Phase 10's flagged gap — a driver posting-fee payment
and a booking prepayment each resolving `SUCCESS` after their ride/
booking was already cancelled — correctly created and resolved a refund
transaction rather than silently leaving captured money with no refund
path. `npm run typecheck`, `npm run lint`, and `npm run build` all pass.

Not built in this phase, intentionally out of scope: any real driver
payout/settlement disbursement (§6 — no wallet/payout system exists;
`calculateSettlement`'s result is logged, not paid out anywhere), refund-
webhook handling for Razorpay's own async `refund.processed` event (this
phase's refunds are resolved synchronously from `PaymentProvider.
refund()`'s own response, not a webhook), and notification enqueueing for
any of the new events (`RefundProcessed`, etc. — Phase 12).

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

## Status: complete

Implemented the full notification module (`src/modules/notification/`),
an FCM `PushProvider` abstraction (`src/infrastructure/fcm/`), and a new
`notification` BullMQ queue/worker — new migration
`20260812182449_notifications` (`UserDevice`, `Notification`,
`DevicePlatform`, `NotificationType`).

`PushProvider` (claude.md §17/§37-style strategy interface): `send(tokens,
payload): Promise<PushSendResult[]>`, resolving per-token success/
invalid-token outcomes rather than throwing per token (real FCM behavior —
stale tokens are routine), only throwing for a genuine gateway-level
failure. `FirebasePushProvider` uses the real `firebase-admin` SDK
(`sendEachForMulticast`, deliberately using the deprecated `tokens` field
over the newer FID-based API since our domain model is registration
tokens, matching claude.md §45's `user_devices.device_token`).
`ConsolePushProvider` is the local-dev fallback (logs instead of sending,
always reports success), selected the same way Resend/Razorpay's
factories already do (`infrastructure/fcm/index.ts`).

**Real bug found and fixed during manual verification**: unlike Resend/
Razorpay's constructors (which just store the key and fail lazily on
first real call), firebase-admin's `cert()` synchronously parses the
private key and throws immediately on anything that isn't valid PEM —
confirmed by actually crashing the entire process at import time with
this environment's `.env` `FCM_PRIVATE_KEY` (not a real PEM key). A
misconfigured push credential must degrade push delivery, not take down
auth/rides/payments/everything else, so `createPushProvider()` now wraps
`FirebasePushProvider` construction in try/catch and falls back to
`ConsolePushProvider` on failure, logging the error — same graceful-
degradation contract as the "not configured" case. Re-verified after the
fix: server boots cleanly and serves traffic normally with the invalid
key still in `.env`.

**Notification delivery pipeline** (`notificationService.ts`): every
`notify*` function (one per `NotificationType`, each owning its own
title/body copy rather than a shared template registry with a single
call site apiece, claude.md §86) enqueues a `deliver-notification` BullMQ
job with a deterministic `id` generated at enqueue time. The worker
(`processNotificationJob`) does two independent steps, per claude.md §46
("FCM delivery and notification persistence are separate concerns"): (1)
`notificationRepository.upsert` — idempotent by that same `id`, so a
BullMQ retry's persistence step is a no-op rather than a duplicate row;
(2) fetch the user's device tokens and call `pushProvider.send()`,
left to throw on a genuine gateway failure so BullMQ's retry/backoff
(`attempts: 5`, exponential) retries the *whole* job — safe because step
(1) is already idempotent. Tokens FCM reports invalid are removed
(`userDeviceRepository.removeTokens`, claude.md §45 — deletion, since
`user_devices` has no status field in the given schema).

**Event wiring** — one `notify*` call added at each transition, into
existing Phase 7-11 code:
- `bookingService.createBooking` → `RIDE_BOOKED` (driver)
- webhook `BOOKING_PREPAYMENT`/`FINAL_PAYMENT` success → `BOOKING_CONFIRMED` /
  implicit via `RIDE_COMPLETED` already covering the ride side
- `bookingService.cancelBooking` (self-cancel) and
  `bookingExpiryService.processBookingExpiry` (TTL expiry) → `BOOKING_CANCELLED`
- `rideService.cancelRide` cascade → `RIDE_CANCELLED` per affected passenger
- `rideService.startRide` / `completeRide` → `RIDE_STARTING` / `RIDE_COMPLETED`
  per `CONFIRMED` booking's passenger (reusing Phase 11's
  `bookingRepository.findConfirmedByRideId`)
- `webhookService` (every resolved payment, all three transaction types) →
  `PAYMENT_SUCCESS`/`PAYMENT_FAILED` for the paying user — `paymentRecordService.
  resolvePaymentByOrderId`'s `ResolvePaymentResult` gained `userId`/`amount`
  fields (already in scope from the `payment` row it reads) so the webhook
  doesn't need an extra lookup
- `refundService.processRefund` (after a refund actually resolves to
  `SUCCESS`) → `REFUND_PROCESSED`

New endpoints: `POST /api/v1/users/me/devices` (register/upsert a device
token — routed on `userRouter`, delegating to the notification module's
`deviceController`, same cross-module routing pattern as booking-on-ride),
`GET /api/v1/notifications` (cursor-paginated, newest-first — a simpler
single-fixed-order cursor than ride search's, `notificationCursor.ts`),
`PATCH /api/v1/notifications/:id/read` (idempotent — re-marking an
already-read notification returns the existing `readAt` rather than
erroring; scoped to the caller's own notifications, 404 on anyone else's
or nonexistent).

**Second, unrelated bug found before any of the above (fixed first,
blocking)**: the very first `prisma migrate dev` run for this phase's
schema change failed the shadow-database replay with `relation
"rides_origin_gist" already exists` — root cause was Phase 11's own fix to
this exact problem (`20260812171513_settlement_and_refunds`, claude.md
§97 2026-08-14) had re-added a plain `CREATE INDEX` for the two hand-
written `rides` GiST indexes, which collides on a *fresh* database replay
since the original migration (`20260812123854_ride_creation`) already
creates them earlier in the same replay — Phase 11's fix only worked
against the one already-migrated dev DB it was written against, not
against a from-scratch environment. Fixed by making that CREATE INDEX
`IF NOT EXISTS`. Then, once migrate dev proceeded, Prisma's diff
generated the *same class* of erroneous `DROP INDEX` for both indexes
*again* in this phase's own new migration — confirming this isn't a
one-off, it's structural for as long as `rides.origin`/`destination` stay
`Unsupported` (invisible to Prisma's schema diff). Stripped from this
migration's SQL the same way. Both fixes applied without a destructive
`prisma migrate reset` — the already-applied migrations' stored
checksums were updated directly (`UPDATE _prisma_migrations SET
checksum = ...`, computed via `shasum -a 256` of the corrected file) to
match the corrected SQL, preserving all existing dev data. Added a
standing process rule (steps.md §28) so this doesn't need rediscovering
in Phase 13+: always `prisma migrate dev --create-only`, inspect for
these two `DROP INDEX` statements, strip them before applying.

Verified end-to-end against the real Postgres/Redis/BullMQ stack (no
automated test infra yet, per the Phase 3 note) with two passes:
`RESEND_API_KEY`/`PAYMENT_PROVIDER_KEY`/`FCM_*` all blanked (deterministic
console-fallback run — 24 scripted assertions, all passing): device
registration and re-registration upserting the same token rather than
duplicating; all nine notification types fired with correct recipient
and content (`RIDE_BOOKED` to the driver on booking creation;
`BOOKING_CONFIRMED`+`PAYMENT_SUCCESS` on prepayment webhook;
`RIDE_STARTING`/`RIDE_COMPLETED` to the confirmed passenger;
`PAYMENT_SUCCESS` again for the locked final-90%-payment amount;
`PAYMENT_FAILED` on a failed webhook; `BOOKING_CANCELLED` on passenger
self-cancel; `RIDE_CANCELLED`+`REFUND_PROCESSED` on a driver cascade
cancellation with a confirmed booking); `GET /notifications` returning
the expected items; mark-read setting `readAt`, idempotent on a second
call (same `readAt`, not an error), and 404 for a nonexistent/foreign
notification id. Second pass with real (but invalid) `FCM_*` credentials
restored — confirmed the graceful-fallback fix above, then re-ran the
identical 24-assertion suite against that server instance to confirm the
full pipeline is unaffected by which push-provider branch is active.
`npm run typecheck`, `npm run lint`, and `npm run build` all pass.

Flagged to the user, not a code defect: this environment's `.env`
`FCM_PRIVATE_KEY` is not a valid PEM key (confirmed by the crash this
phase's graceful-fallback fix now catches) — real push delivery needs a
genuine Firebase service-account key before it'll actually send anything;
until then `ConsolePushProvider` handles it transparently.

Not built in this phase, intentionally out of scope: the `PaymentSuccessful`/
`PaymentFailed`/`RefundProcessed` naming in steps.md's own event list above
was reconciled against claude.md §44's authoritative `NotificationType`
enum (`PAYMENT_SUCCESS`/`PAYMENT_FAILED`/`REFUND_PROCESSED`, plus
`RIDE_BOOKED` which steps.md's list omits but claude.md §44 includes) —
claude.md is the architectural source of truth per §1, so its 9-value
enum was implemented as-is. No notification-preferences/opt-out system
(not specified), no digest/batching (each event is its own immediate
notification, matching "do not block... waiting for FCM" §42's
real-time framing).

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

## Status: complete

Implemented `Conversation`/`Message` Prisma models (migration
`20260813053512_chat_conversations_messages`) and the full chat module
(`src/modules/chat/`), plus a Socket.IO gateway
(`src/infrastructure/socket/socketServer.ts`,
`src/modules/chat/socket/chatGateway.ts`) wired into `server.ts`, which now
creates an explicit `http.Server` (so both HTTP and WebSocket traffic share
one port) instead of relying on `app.listen()`'s internal one.

**One conversation per (ride, passenger) pair**, not one shared room per
ride — `claude.md` §47's conceptual schema (`ride_id`, `driver_id`,
`passenger_id` on one `conversations` row) already implies this: the driver
talks to each passenger separately. Enforced by a `@@unique([rideId,
passengerId])` constraint. `driverId` is denormalized from `ride.driverId`
at creation time (a ride's driver never changes post-creation, so this
never goes stale) so authorization checks never need to join through `Ride`.

**Conversations are created lazily**, not via a dedicated REST endpoint —
`bookingService.createBooking` calls
`conversationService.getOrCreateConversationForRide` right after a booking
is created (mirroring where `notifyRideBooked` already fires), the first
time a given passenger has a reason to talk to the ride's driver. Idempotent
via the unique constraint, so a second booking by the same passenger on the
same ride reuses the existing conversation. Not gated on booking/payment
status — either party may reasonably want to talk before payment confirms.

**REST endpoints beyond what claude.md §47/§51 explicitly lists** — `GET
/api/v1/conversations` (list the caller's conversations, newest-first,
cursor-paginated, each with a `counterpart` {id, name} and `lastMessage`
preview) and `GET /api/v1/conversations/:id/messages` (cursor-paginated
history). §47 only specifies the WebSocket flow and entities, not a REST
surface, but a chat client has no way to discover conversation IDs or load
history without one — engineering necessity, not a business-policy
invention (claude.md §90/§26: same cursor-pagination shape as
notifications/ride-search, `{items, nextCursor}`, opaque base64url cursor).
Message *sending* stays WebSocket-only, matching §47's diagram exactly — no
REST POST-message endpoint exists.

**WebSocket flow implemented exactly as specified**: `io.use()` middleware
authenticates via the same `verifyAccessToken()` HTTP's `authenticate`
middleware uses (token read from `socket.handshake.auth.token`, falling
back to an `Authorization: Bearer` header), storing `{id, role}` on
`socket.data`. `join_conversation` and `send_message` both independently
call `conversationService.authorizeParticipant` — join does not grant
send any special trust, since "do not trust conversation IDs from the
client" (§47) means a client could emit `send_message` without ever
joining. A non-participant gets `CONVERSATION_NOT_FOUND` from both events
(404-equivalent — existence isn't leaked, same pattern as
`bookingService.getBooking`/vehicle ownership checks elsewhere in this
codebase) rather than a distinguishable "forbidden." Messages are persisted
then emitted only to the `conversation:{id}` room (Socket.IO room, joined
only by authorized sockets) — never broadcast wider.

**Multi-instance readiness** (§67): `createSocketServer` attaches
`@socket.io/redis-adapter` using two `redis.duplicate()` connections
(pub/sub mode needs dedicated connections, can't share the general-purpose
`infrastructure/redis` client that also serves OTP/rate-limiting). Not
independently load-tested against a second running instance in this phase
(no second instance was stood up) — the adapter wiring itself was verified
correct (server boots cleanly, no adapter connection errors in logs) and is
the same pattern claude.md documents (§67) and BullMQ already uses
elsewhere in this codebase (`infrastructure/queue/connection.ts`) for the
same "needs its own Redis connection" reason.

No migration drift beyond the third recurrence of the standing `rides`
GiST-index issue (steps.md §28) — stripped the same two spurious `DROP
INDEX` statements from this migration's generated SQL before applying, per
the existing process rule. No other schema drift.

Verified end-to-end against the real Postgres/Redis stack (no automated
test infra yet, per the Phase 3 note; `RESEND_API_KEY` temporarily blanked
for console-logged OTPs, restored afterward) using an existing
driver/passenger/ride from earlier phase testing: booking a ride correctly
auto-created exactly one `conversations` row (confirmed directly in
Postgres); `GET /conversations` returned the correct `counterpart` from
each side (driver sees the passenger's name and vice versa); `GET
/conversations/:id/messages` correctly scoped — a third user (the seeded
admin, a genuine non-participant) got 404 `CONVERSATION_NOT_FOUND` from
both a real conversation id and a random UUID, indistinguishably. Over a
real WebSocket connection (`socket.io-client`): connecting without a token
or with a garbage token was rejected at the `connect_error` stage before
ever reaching `connection`; the non-participant admin's `join_conversation`
and `send_message` both got `CONVERSATION_NOT_FOUND` acks and never
received the `message` broadcast; the driver and passenger both joined
successfully; a message sent by the driver was persisted (visible
immediately via the REST message-history endpoint), broadcast to the
passenger (received the `message` event), and correctly *not* broadcast to
the admin socket (never joined the room); an empty message and a
non-UUID `conversationId` both correctly got `VALIDATION_ERROR` acks
without persisting anything. Cursor pagination over 4 messages at
`limit=2` walked two full pages with no duplicates/gaps, then correctly
returned an empty final page with `nextCursor: null`; a malformed cursor on
the REST endpoint → 400 `INVALID_CURSOR`. `npm run typecheck`, `npm run
lint`, and `npm run build` all pass.

Not built in this phase, intentionally out of scope: read receipts beyond
the `readAt` column already existing on `Message` (no endpoint sets it —
claude.md §47 doesn't specify a mark-read flow for chat, unlike
notifications' explicit `PATCH .../read`, so none was invented); typing
indicators/presence (not specified); push notifications for new chat
messages (claude.md §44's `NotificationType` enum has no chat-message
value — out of scope per the same "don't invent business requirements"
reasoning as Phase 12's notes).

------------------------------------------------------------------------

# 17.5. Phase 13.5 --- AI Support Chatbot

## Goal

Implement an AI-assisted support chatbot for general Rydex help and
basic account-context support, kept fully independent of the
passenger-driver chat built in Phase 13. See `claude.md` §96.5 for the
full architectural design — this phase implements it.

This is a SUPPORT / USER-HELP chatbot, not the passenger-driver chat.
It shares no module, no data model, and no routes with `src/modules/
chat/`. `SupportConversation`/`SupportMessage` are separate entities
from `Conversation`/`Message`.

## Module and infrastructure layout

``` text
src/modules/support/
    controllers/
    services/
    repositories/
    schemas/
    prompts/
    routes.ts

src/infrastructure/ai/
    aiProvider.ts
    geminiAiProvider.ts
    consoleAiProvider.ts
    index.ts
```

## Database

``` text
support_conversations
support_messages
```

One migration, following the existing one-migration-per-feature
convention. Watch for the standing `rides` GiST-index migration-drift
issue (§28) even though this migration doesn't touch `rides` —
confirmed to recur on unrelated schema changes, so always
`prisma migrate dev --create-only` and inspect the generated SQL
before applying.

## AIProvider abstraction

``` text
AIProvider
   |
   +-- GeminiProvider (initial, official @google/genai SDK)
```

Selected via `AI_PROVIDER` env var, wired through
`infrastructure/ai/index.ts` exactly like `infrastructure/maps/
index.ts` and `infrastructure/payments/index.ts`. `ChatbotService`
imports only the interface-typed singleton, never `GeminiProvider`
directly. Uses the official SDK rather than raw `fetch` — the
tool-calling protocol is intricate enough (function-call/
function-response turns, JSON-schema tool definitions) that the vendor
SDK is worth the dependency, same trade-off `RazorpayProvider` made for
signature verification (steps.md §14 / claude.md §37). When
`GEMINI_API_KEY` is unset, fall back to a `ConsoleAIProvider` (logs
instead of calling out), same configured-vs-console pattern as
`infrastructure/resend/index.ts` and `infrastructure/fcm/index.ts` —
no real key required for local dev.

Originally speced with Grok/xAI as the initial provider (see
`claude.md` §97, corrected before implementation) — a Gemini API key is
what's actually available, so `GeminiProvider` ships first. `AIProvider`
makes this a pure infrastructure swap; nothing else in this phase's
plan changes.

## Tool / context layer

``` text
ChatbotService
   |
AIProvider.complete() with tool definitions
   |
model requests a tool call
   |
backend executes ONLY a whitelisted, ownership-checked function
   |
tool result fed back to the model (bounded to
SUPPORT_CHAT_MAX_TOOL_ROUNDS rounds)
   |
final text response
```

Initial tool registry (all take the authenticated user's ID from
server-side session state, injected by the tool executor — never a
parameter the model can set):

``` text
getMyRecentBookings(userId)
getBookingStatus(userId, bookingId)
getMyRecentRidesAsDriver(userId)
getRideStatus(rideId)
```

`getMyRecentBookings`/`getMyRecentRidesAsDriver` are new read-only
service methods (`bookingService`/`rideService` currently only have
single-record lookups, not "list mine"). `getBookingStatus`/
`getRideStatus` reuse the existing `bookingService.getBooking`/
`rideService.getRide`. Payment/refund status tools follow the same
pattern, reusing `paymentService`/cancellation-settlement code from
Phases 10/11 (already implemented by this point in the build order).

## Knowledge / FAQ

Build the system prompt's Rydex-specific facts (commission %,
prepayment %, cancellation policy, search radius) from the same
config/business-rule constants used elsewhere (§85) — do not duplicate
magic numbers in a separate FAQ file. No vector DB / RAG at this
stage.

## API

``` text
POST /api/v1/support/conversations
GET  /api/v1/support/conversations
GET  /api/v1/support/conversations/:id
POST /api/v1/support/conversations/:id/messages
```

Synchronous HTTP request/response — no BullMQ queue for the chat turn
itself. Authenticated; ownership-checked the same way `GET /bookings/
:id` and `GET /conversations/:id/messages` already are — a
non-participant gets `SUPPORT_CONVERSATION_NOT_FOUND`, not a
distinguishable "forbidden" (existence isn't leaked).

## Safety

``` text
tool layer enforces ownership regardless of what the model asks for
system prompt defines the assistant's identity and scope
model never invents fares, refunds, booking/payment status
```

## Cost control

``` text
per-user + per-IP rate limiting (reuse infrastructure/redis/
    rateLimit.ts, same factory auth/routes.ts already uses)
max message length
max conversation history sent to the provider
provider timeout
bounded tool-call rounds
optional daily per-user message cap
```

## Out of scope for this phase

``` text
human support escalation UI/queue (schema leaves room via
    SupportConversation.status = ESCALATED, nothing more)
RAG / vector search
automated tests
dedicated logging/observability infrastructure
    (no logger exists anywhere in the repo yet; this phase does not
    introduce one either — errors flow through the existing
    errorHandler middleware like every other module)
```

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
AI support chat
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
[x] Phase 4 — User
[x] Phase 4.5 — Driver Upgrade (License Verification)
[x] Phase 5 — Vehicle + Documents
[x] Phase 5.5 — Admin Verification Dashboard
[x] Phase 6 — Map + Fare
[x] Phase 7 — Ride Creation
[x] Phase 8 — Ride Search
[x] Phase 9 — Booking
[x] Phase 10 — Payment
[x] Phase 11 — Cancellation + Settlement
[x] Phase 12 — Notifications
[x] Phase 13 — Chat
[ ] Phase 13.5 — AI Support Chatbot
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

## Standing rule: `rides` GiST indexes (added 2026-08-14, Phase 12)

`rides.origin`/`destination` are `Unsupported("geography(Point,4326)")` in
`schema.prisma` (claude.md §16/§77 — Prisma has no native geography type).
Their hand-written GiST indexes (`rides_origin_gist`,
`rides_destination_gist`, added by hand in migration
`20260812123854_ride_creation`) are therefore invisible to Prisma's
schema-diff engine. **Every** `prisma migrate dev`/`migrate diff` run,
regardless of what the actual schema change is about, will propose
`DROP INDEX "rides_origin_gist"`/`"rides_destination_gist"` as part of
reconciling that "unknown" state — this has now happened twice
(migrations `20260812171513_settlement_and_refunds` and
`20260812182449_notifications`), for schema changes with nothing to do
with `rides`.

Until `origin`/`destination` stop being `Unsupported` (i.e. Prisma gains
native geography support, or this project moves spatial indexing to
raw-SQL-managed migrations entirely), every future migration must be
generated with `prisma migrate dev --create-only`, hand-inspected for
those two `DROP INDEX` statements, and have them stripped before
applying. Do not run a plain `prisma migrate dev` on this project without
this check — it will silently regress ride search's spatial index usage
(claude.md §16/§20), which has no test coverage that would otherwise catch
it (no automated test infra yet, per the Phase 3 note).

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
