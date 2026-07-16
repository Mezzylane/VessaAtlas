# Vessa Atlas

Unofficial, anonymous Aalto University campus restroom ratings — a zoomable
map of real Otaniemi building footprints with clickable pins for public
restrooms. Anyone can rate (1–10) and leave a short review; only the site
admin can add new restrooms.

Stack: Next.js (App Router) + TypeScript, Drizzle ORM, Neon Postgres,
deployed on Vercel.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — a Neon Postgres pooled connection string
   - `ADMIN_PASSWORD_HASH` — run `npm run hash-password -- "your password"` and paste the (already-escaped) output
   - `SESSION_SECRET`, `IP_HASH_SECRET`, `CRON_SECRET` — each `openssl rand -base64 32`
3. `npm run db:generate && npm run db:migrate` — creates the schema on your Neon database
4. `npm run seed` — optional, inserts sample Otaniemi restrooms + reviews
5. `npm run dev`

## Scripts

- `npm run dev` / `build` / `start` — standard Next.js
- `npm run db:generate` / `db:migrate` / `db:studio` — Drizzle migrations
- `npm run seed` — seed sample data
- `npm run hash-password -- "password"` — generate an admin password hash
- `npx tsx scripts/geojson-to-svg.ts` — regenerate `public/map/campus.svg` from `scripts/raw-overpass.json` (an OpenStreetMap Overpass API export of the Otaniemi campus bounding box)

## Deployment

Connect the repo to Vercel with the Neon integration (auto-injects
`DATABASE_URL`), set the remaining env vars from `.env.example` as Vercel
project env vars, then run migrations against the production database.
`vercel.json` configures the daily cron that purges old rate-limit rows.
