# Situation Monitor

Situation Monitor is a map-first news intelligence dashboard that ingests recent GDELT events, stores them in Postgres via Prisma, and streams updates to the browser over Server-Sent Events (SSE).

## Architecture summary
1. **Next.js App Router (TypeScript)** serves UI + API routes.
2. **Prisma + Postgres (Neon/Supabase)** stores query profiles, clusters, articles, and ingest run history.
3. **Ingestion endpoint (`POST /api/refresh`)** fetches GDELT DOC + GEO feeds for each profile.
4. **Deduplication** is enforced with a unique `Article.url` constraint.
5. **Cluster persistence** uses `(locationKey, queryProfileId)` unique index.
6. **SSE stream (`GET /api/stream`)** broadcasts heartbeats and ingest updates.
7. **Client auto-refresh timer** triggers `POST /api/refresh` every 3 minutes (more reliable for serverless than long-lived server intervals).
8. **Leaflet + Marker clustering** renders interactive map blips.
9. **OSM tiles** are used with proper attribution.
10. **Side panel** provides query selection, filter controls, feed health, and manual refresh.
11. **Ingest runs** are tracked as `running/success/failed` with timestamps + error text.
12. **Short in-memory cache** reduces repeated GDELT calls.
13. **Retry/backoff** handles transient GDELT failures.
14. **Accessible UI basics** include focus rings, ARIA live feed health, keyboard-friendly controls.

---

## File tree

```text
.
├── .env.example
├── .eslintrc.json
├── .gitignore
├── README.md
├── app
│   ├── api
│   │   ├── map-data
│   │   │   └── route.ts
│   │   ├── query-profiles
│   │   │   └── route.ts
│   │   ├── refresh
│   │   │   └── route.ts
│   │   └── stream
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── MapCanvas.tsx
│   └── SituationMonitorApp.tsx
├── lib
│   ├── gdelt.ts
│   ├── ingest.ts
│   ├── prisma.ts
│   ├── sse.ts
│   └── types.ts
├── next-env.d.ts
├── next.config.mjs
├── package.json
├── prisma
│   ├── schema.prisma
│   └── seed.ts
└── tsconfig.json
```

---

## Quick start (no local install required)

> You only need browser access to StackBlitz/Replit + a Neon/Supabase DB.

### 1) Create managed Postgres

#### Neon
1. Go to https://neon.tech and create a free project.
2. Create database + branch (defaults are fine).
3. Copy connection string (must include SSL).

#### Supabase
1. Go to https://supabase.com and create a project.
2. Open **Project Settings → Database**.
3. Copy the pooled `postgresql://...` connection string.

### 2) Option A — StackBlitz
1. Open StackBlitz and import this GitHub repo.
2. Click **Project → Settings → Environment Variables**.
3. Add `DATABASE_URL` using Neon/Supabase string.
4. Add optional `NEXT_PUBLIC_APP_URL`.
5. Open StackBlitz terminal and run:
   ```bash
   npm install
   npm run db:setup
   npm run dev
   ```
6. Click **Run** (or auto-preview) and open the app.
7. Click **Refresh now** in the left panel to ingest latest data.

### 3) Option B — Replit
1. Create a new Repl from this GitHub repo.
2. Open **Secrets**.
3. Add `DATABASE_URL` (and optional `NEXT_PUBLIC_APP_URL`).
4. In shell run:
   ```bash
   npm install
   npm run db:setup
   npm run dev
   ```
5. Press **Run** and open the webview.
6. Click **Refresh now** to populate the map.

### 4) Deploy to Vercel
1. Push repo to GitHub.
2. Import project in Vercel.
3. Set `DATABASE_URL` and `NEXT_PUBLIC_APP_URL` env vars.
4. Deploy.
5. After first deploy, run DB setup once (from StackBlitz/Replit terminal or any cloud shell):
   ```bash
   npm run db:setup
   ```

---

## Verification checklist

- [ ] App opens with dark side panel + fullscreen map.
- [ ] OSM attribution visible on map.
- [ ] Query profile selector shows: World Breaking, Elections, Cyber.
- [ ] Clicking **Refresh now** updates feed health and map markers.
- [ ] Clicking a marker shows related article links (open in new tab).
- [ ] SSE stream stays connected and receives heartbeat/update events.
- [ ] Filters (language, source country, top N) change visible results.
- [ ] Prisma tables contain `QueryProfile`, `GeoCluster`, `Article`, `IngestRun` records.

---

## Design decision: serverless-safe polling strategy

Instead of relying on long-lived server `setInterval` workers (often unreliable in serverless idle environments), this app uses:
- a **client timer** (3 minutes) calling `POST /api/refresh`, and
- a **manual Refresh button**,
- plus **SSE push updates** once ingestion completes.

This works reliably on Vercel/StackBlitz/Replit without background workers while still delivering near-live behavior.

---

## Default seeded query profiles

- **World Breaking**: `(war OR earthquake OR shooting OR flood OR protest)` — `24h`
- **Elections**: `election OR vote OR campaign` — `24h`
- **Cyber**: `(ransomware OR data breach OR malware)` — `7d`
