# PHRANK

A Next.js, TypeScript, PostgreSQL, and Prisma prototype for the Philippine National Basketball Ranking System.

## Stack

- Frontend: Next.js App Router with TypeScript
- Public SEO pages: server-rendered rankings and player profile pages
- Organizer portal: same Next.js codebase under `/organizer`
- Backend/API: Next.js route handlers in TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Frontend hosting target: Vercel
- PostgreSQL hosting target: Supabase or Railway

## What Is Included

- `/` public landing page
- `/rankings` server-rendered public rankings page
- `/players` public player registry page
- `/players/[slug]` SEO-friendly player profile pages
- `/methodology` public rating, verification, league quality, and integrity explanation
- `/organizer` organizer registry and sample stat-entry workflow
- `/api/players` player JSON API
- `/api/rankings` rankings JSON API
- Prisma schema for users, players, teams, leagues, seasons, rosters, games, raw stats, performance scores, ratings, audit logs, and ranking snapshots
- Requirements extract from `PHRANK_Summary.docx` in `docs/PHRANK_requirements.md`
- Prisma seed file with demo data

## Run In Visual Studio

1. Open this folder in Visual Studio.
2. Make sure Node.js is installed on your machine.
3. Copy `.env.example` to `.env`.
4. Set `DATABASE_URL` to your PostgreSQL connection string.
5. Open the Visual Studio terminal in this project folder.
6. Run:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Then open `http://localhost:3000`.

## Build

```bash
npm run build
npm start
```

## Deploy

For Vercel:

1. Push the project to GitHub.
2. Import the repo in Vercel.
3. Add `DATABASE_URL` in Vercel environment variables.
4. Use Supabase or Railway for PostgreSQL.
5. Run Prisma migrations against the production database before launch.

## Project Structure

```text
prisma/
  schema.prisma   PostgreSQL schema
  seed.ts         Demo seed data
docs/
  PHRANK_requirements.md
src/
  app/            Next.js routes, pages, and APIs
  components/     Reusable UI components
  lib/            Shared data, types, formatting, and Prisma helper
  styles/         Global CSS
```

The UI currently reads demo data from `src/lib/demo-data.ts` so the site can render before the database is connected. The Prisma schema is ready for the real PostgreSQL-backed implementation.
