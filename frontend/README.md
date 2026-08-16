# Rydex frontend

React + TypeScript client for the [Rydex backend](../backend/README.md).
Laptop-first, responsive down to 375 px.

## Setup

```bash
cp .env.example .env.local     # then fill in the values
npm install
npm run dev                    # http://localhost:5173
```

The backend must be running. From `../backend`:

```bash
docker compose up -d           # Postgres + PostGIS, Redis
npx prisma migrate deploy
npm run dev                    # http://localhost:4000
```

`NODE_ENV` must be `development` there — a production boot rejects any
`CORS_ORIGIN` containing localhost. The dev server proxies `/api` and
`/socket.io` to the backend, so requests are same-origin and CORS never
applies either way.

**Payments need a webhook tunnel.** The backend treats the Razorpay webhook as
the only authority on payment state, and Razorpay cannot reach `localhost`. Run
`ngrok http 4000` and point the test webhook at it, subscribed to exactly
`payment.captured` and `payment.failed`. Without this, nothing ever moves out of
`PENDING_PAYMENT`.

## Dependencies

Kept deliberately small — UI components are hand-written rather than pulled from
a component library.

| Package | Why it is not hand-written |
|---|---|
| `react-router-dom` | Routing, nested layouts, URL params |
| `socket.io-client` | The backend runs a Socket.IO server; its handshake, packet framing and acks are a protocol a raw WebSocket cannot speak |
| `leaflet` / `react-leaflet` | Tile rendering and GeoJSON route display |
| `lucide-react` | SVG icon paths only — no behaviour or markup |
| `tailwind-merge` | Needs a real model of Tailwind's class groups to resolve conflicts |
| `zod` | Client-side form validation (the backend validates authoritatively regardless) |

Data fetching, caching, dialogs, tabs, toasts and form state are all local code:
see `src/api/hooks.ts` and `src/components/ui/`.

## Layout

```
src/
├── api/          client.ts (envelope + auth + refresh), hooks.ts (query/mutation/pagination),
│                 store.ts (cache + invalidation), types.ts (backend DTO mirrors)
├── auth/         token storage
├── components/
│   ├── ui/       Button, Input, Card, Dialog, Tabs, Toast, Skeleton
│   └── domain/   StatusPill, Fare, Countdown, StarRating, empty/error states
├── lib/          money, kolkataDate, statusMaps, errorCopy, cn
└── routes/       pages
```

`/_kitchen-sink` renders every primitive in every state — the fastest way to
check a design-system change without clicking through the product.

## Things the API forces on the UI

- **Search needs auth.** `GET /rides/search` is authenticated, so an anonymous
  visitor cannot search. The landing form stashes the query, routes to login and
  runs it afterwards.
- **Search is single-date, Asia/Kolkata, hard-coded.** No date flexibility, no
  time window, no price or seat filter. The date picker must not imply otherwise.
- **Search results carry no addresses** — only distance from the points you
  asked about. Rows read "2.3 km from your pickup", never a place name.
- **Payment is confirmed by webhook, never by the client.** After Razorpay
  Checkout closes, the UI polls until the status actually changes. Success is
  never assumed.
- **Ownership failures return 404, not 403**, so not-found copy doubles as
  permission-denied copy.
- **`routeGeometry` is large** — measured at 53 KB of GeoJSON for a 302 km
  Delhi→Jaipur route. Detail views only, never lists.
- **No review history exists.** `GET /bookings/:id/ratings` returns only ratings
  you gave or received, so ratings show as aggregates (`4.8 ★ (23)`) only.
