# Rydex

India-focused carpooling / ride-sharing backend, built as a modular
monolith (Node.js, TypeScript, Express, Prisma, PostgreSQL + PostGIS,
Redis, BullMQ).

## Source of truth

Before making any architectural or product decision, read:

- [`claude.md`](./claude.md) — architecture and engineering
  specification. This is the source of truth for how the system is
  designed.
- [`steps.md`](./steps.md) — phased implementation execution plan.
  This is the source of truth for build order.

Both documents are living project documentation and are kept in sync
with real decisions (see `claude.md` §97 for the change log).

## Getting started

```bash
cp .env.example .env
npm install
docker compose up -d      # PostgreSQL + PostGIS, Redis
npm run db:migrate        # apply migrations
npm run db:seed           # seed an ADMIN user
npm run dev
```

## Scripts

| Script                            | Purpose                                        |
| --------------------------------- | ---------------------------------------------- |
| `npm run dev`                     | Run the app with hot reload (`tsx watch`)      |
| `npm run build`                   | Compile TypeScript to `dist/`                  |
| `npm start`                       | Run the compiled build                         |
| `npm run lint` / `lint:fix`       | ESLint                                         |
| `npm run format` / `format:check` | Prettier                                       |
| `npm run typecheck`               | Type-check without emitting                    |
| `npm run db:migrate`              | Apply Prisma migrations (dev)                  |
| `npm run db:migrate:deploy`       | Apply migrations (production, non-interactive) |
| `npm run db:generate`             | Regenerate the Prisma Client                   |
| `npm run db:seed`                 | Run `prisma/seed.ts`                           |
| `npm run db:studio`               | Open Prisma Studio                             |

## Project status

Building in controlled phases per `steps.md`. See that file's Phase
Completion Checklist (§22) for current progress.

```text
Phases 0–15   complete    backend implemented and verified
Phase 16      next        deployment
Phase 17      blocked     final end-to-end verification of the deployment
```

Phase 15 (Verification + Hardening) was completed by driving the running
application against the real stack — functional flows, authorization and
IDOR boundaries, security controls, concurrency and idempotency scenarios,
and failure paths — across two passes, fixing every bug found and
re-verifying it. It was completed **without** adding automated test
infrastructure: there are intentionally no test files, no test framework and
no `test` script. Automated testing, structured logging and OpenAPI remain
future engineering work rather than things this repository already has.

## Deployment

Current target — a portfolio/demo deployment on free tiers:

```text
Backend                 →  Render Web Service
PostgreSQL + PostGIS    →  Supabase
Redis                   →  Upstash
```

Future production target — AWS ECS Fargate, RDS PostgreSQL + PostGIS,
ElastiCache Redis, behind a load balancer. Every external dependency already
sits behind an interface or a connection string, so moving between the two is
configuration and containerization rather than a rewrite. The two stacks are
not equivalent, and the free-tier one is not presented as production.

See `steps.md` §20 for the deployment plan, including the free-tier
constraints that have to be resolved first.
