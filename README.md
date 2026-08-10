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
| --------------------------------- | ----------------------------------------------- |
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

Logging and automated testing infrastructure are intentionally not set
up yet — deferred to a later pass.

## Project status

Building in controlled phases per `steps.md`. See that file's Phase
Completion Checklist (§22) for current progress.
