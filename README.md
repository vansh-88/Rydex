# Rydex

India-focused carpooling platform. A driver publishes a trip they are already
taking; passengers travelling the same corridor on the same day book individual
seats.

## Repository layout

```
rydex/
├── backend/     Node.js/TypeScript API — implemented, see backend/README.md
└── frontend/    planned
```

**[`backend/`](backend/README.md)** is a production-oriented modular monolith
built around geospatial ride matching (PostgreSQL + PostGIS), transaction-safe
seat allocation under concurrency, and idempotent webhook-driven payments. It is
the only implemented component today — start there for architecture,
setup instructions, and engineering documentation.

`frontend/` will be added as a sibling directory when work on it begins; nothing
here depends on its presence.

## Documentation

All detailed documentation lives under `backend/`, since it is currently the
only component:

| File | Purpose |
|---|---|
| [`backend/README.md`](backend/README.md) | Backend overview, tech stack, setup |
| [`backend/docs/architecture.md`](backend/docs/architecture.md) | How the backend is designed, and why |
| [`backend/docs/steps.md`](backend/docs/steps.md) | How it was built — history, decision log, roadmap |
| [`backend/docs/claude.md`](backend/docs/claude.md) | Engineering context for anyone (including an AI assistant) changing the backend |
