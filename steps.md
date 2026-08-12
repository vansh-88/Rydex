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
[x] Phase 4 — User
[x] Phase 4.5 — Driver Upgrade (License Verification)
[x] Phase 5 — Vehicle + Documents
[x] Phase 5.5 — Admin Verification Dashboard
[x] Phase 6 — Map + Fare
[x] Phase 7 — Ride Creation
[x] Phase 8 — Ride Search
[x] Phase 9 — Booking
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
