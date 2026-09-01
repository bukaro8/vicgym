# VicGym

VicGym is a private, mobile-first workout log. This repository currently contains **Phases 1–6**: the secure application foundation, verified photo/equipment catalogue, active workouts, the manual ChatGPT coach review/import loop, completed-workout progress/history views, and offline-resilient active workouts.

The four-day routine is software fixture data only and is always labelled **“Demo programme — not training advice.”** It is inactive after a fresh seed. Once explicitly confirmed, an owner can start one workout at a time, log and edit raw sets, reuse weights from the most recent completed exercise session, run a timestamp-based rest timer, and finish to a database-derived summary.

Phase 4 adds `/more/review`: a Europe/London Monday–Sunday report made only from saved records, a deterministic Markdown export for ChatGPT, and a JSON preview/approval workflow that creates a new immutable programme version. It does not use the OpenAI API or make automatic coaching decisions.

Phase 6 stores active workout snapshots, raw sets, the timestamp rest timer, and an ordered mutation outbox in IndexedDB before updating the UI. Serwist supplies the service worker, offline fallback, and versioned page/media caches; authenticated API responses are network-only. Progress remains server-derived from completed raw data. Timer sound and vibration are optional best-effort browser capabilities; there is no promise of an alert while the PWA is suspended.

## Local development

Requirements: Node.js 24+, npm, Docker, and Docker Compose.

```bash
cp .env.example .env
docker compose -f compose.dev.yml up -d
npm install
npm run phase2:setup
npm run db:migrate:deploy
npm run dev
```

Open `http://localhost:3000`. The readiness endpoint is `GET /api/health`.

## Checks

```bash
npm run check
npm run build
npm run db:validate
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym npm run verify:phase2
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym_phase3_test npm run verify:phase3
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym_phase4_test npm run verify:phase4
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym_phase6_test npm run verify:phase6
```

Programme creation and weekly Coach Changes JSON are documented in [docs/programme-json-import.md](docs/programme-json-import.md).

The Phase 3, 4, and 6 verifiers intentionally refuse to run unless the database name ends in `_test`. They use isolated fixtures and clean up their workout/mutation records.

## Phase 3 routes

- `/workouts` selects or resumes the single active workout.
- `/workouts/[sessionId]/exercises/[exerciseSessionId]` logs sets and navigates the saved exercise snapshots.
- `/workouts/[sessionId]/finish` warns about incomplete planned sets and requires confirmation.
- `/workouts/[sessionId]/summary` reports only saved session data.

All mutation route handlers require same-origin JSON. Database partial unique indexes enforce one in-progress workout and one running/paused rest period even under duplicate requests.

## Phase 4 review and import

`/more/review` exports Markdown/plain text with the active programme/version, Monday–Sunday range, stable day and available exercise slugs, completed raw sets, primary/secondary muscle set totals, simple prior-session comparisons, and concise rest information. It gives the coaching conversation a short response/import reminder rather than repeating its permanent coaching instructions. When no programme is active, the report omits fabricated patch identifiers and explains that initial `schemaVersion: 2` creation JSON can still be validated.

Weekly Coach JSON uses backwards-compatible `schemaVersion: 1`, the current `program` slug and `baseVersion`, plus `upsert` or `remove` changes. Initial programme creation uses `schemaVersion: 2` once. The preview rejects invalid JSON, unknown/inactive catalogue exercises, unknown days, duplicates, invalid numeric values/positions, and stale versions. Applying an approved preview validates again in a serializable transaction and atomically creates and activates the server-numbered version. Old versions and workout sessions remain unchanged.

## Phase 6 offline workouts

Active workout set, timer, navigation, and finish actions are local-first. `/api/sync` replays batches in order with client UUID idempotency keys and stops at the first failed dependency. The global workout status distinguishes synchronized, locally saved, syncing, offline, and attention-required states. Retry triggers include startup, reconnection, focus, manual retry, and supported Background Sync.

`/offline` resumes a locally saved active workout after an offline launch. Prepared workout routes and their required optimized AVIF/WebP images remain usable without the server. `/more/offline` shows the local queue and provides retry plus an explicitly confirmed private-data reset. The reset clears IndexedDB, the outbox, active workout/timer state, and VicGym's private runtime caches; synchronized PostgreSQL history is not deleted.

Database records are single-owner and deliberately have no `userId`. Authentication is supplied at the deployment proxy, not by application account or session tables. See [Coolify deployment](docs/coolify-deployment.md).

Photo originals remain in `gym-pictures/`. The deterministic processor writes orientation-corrected 640/1280 WebP and AVIF assets to `public/media/equipment/`; the exact source mapping is documented in [the equipment photo map](docs/equipment-photo-map.md).
