# VicGym

VicGym is a private, mobile-first progressive web application for running a single-owner workout programme, recording raw training data, reviewing completed history, and exchanging controlled programme updates with a dedicated ChatGPT coaching conversation.

The application does not generate training advice and does not call the OpenAI API. ChatGPT interaction is deliberately manual and reviewable:

```text
VicGym weekly report → paste into ChatGPT → receive VicGym JSON
→ paste into VicGym → validate → preview → explicitly confirm → apply
```

There is no manual programme editor. The exercise catalogue is authoritative, programme versions are immutable, and imported JSON can only reference active exercises that already exist in VicGym.

> The seeded four-day programme is demo fixture data for exercising the software workflow. It is labelled **“Demo programme — not training advice”**, remains inactive after a fresh seed, and is not a recommendation or the owner's actual programme. VicGym makes no assumptions about health, injuries, ability, experience, or programme suitability.

## Contents

- [Features](#features)
- [How VicGym works](#how-vicgym-works)
- [Using the app](#using-the-app)
- [Programme creation and Coach Changes](#programme-creation-and-coach-changes)
- [Load tracking](#load-tracking)
- [Exercise catalogue](#exercise-catalogue)
- [Exercise media](#exercise-media)
- [Offline and PWA behaviour](#offline-and-pwa-behaviour)
- [Architecture and data integrity](#architecture-and-data-integrity)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [Database and seed](#database-and-seed)
- [Testing and verification](#testing-and-verification)
- [Production deployment with Coolify](#production-deployment-with-coolify)
- [Troubleshooting](#troubleshooting)
- [Current limitations](#current-limitations)
- [Project structure](#project-structure)

## Features

### Programme management

- One authoritative active programme selected by `AppSettings.activeProgramId`.
- Initial programme creation from validated `schemaVersion: 2` JSON.
- Weekly patch updates through backwards-compatible `schemaVersion: 1` JSON.
- Paste, validate, preview, explicit-confirmation, and apply workflow.
- Server-assigned programme version numbers.
- Immutable `ProgramVersion` records and session snapshots.
- Strict validation of programme, day, and exercise slugs.
- No automatic exercise creation from programme JSON.
- No manual programme/workout-day editor.

### Workout experience

- Start a workout from an active programme version.
- Only one workout can be in progress at a time.
- Exercise order and planned values are snapshotted when the session starts.
- Record and edit actual reps and compatible load values per set.
- Previous-performance display and compatible-value prefilling.
- Incomplete-set warning before workout completion.
- Completion summary derived from saved raw records.
- No fabricated workout history.

### Rest timer

- Absolute `endsAt` timestamps instead of a stored decrementing counter.
- Automatic rest after set completion when `autoRest` is enabled.
- Global full-screen timer and collapsible timer dock.
- Pause, resume, skip, `+15`, and `-15` controls.
- Timer recovery across navigation, refreshes, backgrounding, and temporary connection loss.
- Optional foreground sound and vibration controls under **More → Rest-timer alerts**.
- Test-alert action and browser/device capability messaging.

### Catalogue and media

- Verified equipment catalogue based on supplied gym photographs.
- Real machine photographs as primary visuals for machine exercises.
- Exercise-specific movement images where an approved image exists.
- Clean placeholder UI when a real movement image is unavailable.
- ExerciseDB image provenance and optional provider-video references.
- **Watch movement** action when a video reference exists.
- Responsive WebP and AVIF derivatives served locally.

### Progress and review

- Completed-workout totals over 4, 8, 12 weeks or all time.
- Working sets, training minutes, and compatible kilogram-volume totals.
- Weekly activity charts.
- Direct primary-muscle sets separated from secondary-muscle involvement.
- Exercise history and recent compatible-session comparisons.
- Machine-level and kilogram series kept separate.
- Europe/London Monday-to-Sunday coaching report.
- Stable programme, workout-day, and exercise identifiers included in the report.

### Offline resilience

- Active workout snapshots stored in IndexedDB.
- Set and timer changes written locally before the UI confirms them.
- Ordered mutation outbox with client UUID idempotency keys.
- Synchronization on startup, reconnection, focus, manual retry, and supported Background Sync events.
- Offline workout, finish, and summary routes.
- Versioned page and media caches using Serwist.
- Network-only authenticated API responses.
- Local sync status and explicitly confirmed private-data reset.

### Security and deployment

- Single-owner database with no `User`, `Account`, or application-session tables.
- Authentication delegated to Coolify/Traefik HTTP Basic Authentication.
- HTTPS-only production deployment boundary.
- Same-origin JSON checks for mutation routes.
- Explicit `APP_ORIGIN` support for reverse proxies.
- Multi-stage standalone Next.js Docker image.
- Production migrations and idempotent catalogue seed before application startup.
- Readiness endpoint that distinguishes application availability from database failure.

## How VicGym works

### Source-of-truth model

The exercise catalogue defines which exercises are active, which verified equipment they use, their muscles, default target reps, media, rep mode, and load semantics. Programme imports reference catalogue exercises by exact slug and can never create new catalogue entries.

A `WorkoutProgram` is a stable programme identity. Its content lives in immutable `ProgramVersion` records. Each version contains its own workout days and configured exercises. Changing a programme creates the next version of the same `WorkoutProgram`; it does not mutate the previous version.

When a workout begins, VicGym snapshots the selected programme version, workout-day name, exercise order, targets, rest configuration, and load semantics into the session. Completed sessions therefore retain their original meaning even when the active programme later changes.

Raw `SetLog` and `RestPeriod` records are the source of truth. Progress, previous performance, summaries, weekly volume, and Coach Review output are derived from those records rather than stored as editable totals.

### Normal lifecycle

1. Run migrations and seed the verified catalogue.
2. Paste an initial `schemaVersion: 2` programme into **More → Coach review**.
3. Validate it and inspect the creation preview.
4. Explicitly confirm and apply it. The server creates programme version 1 and activates it atomically.
5. Start a workout from **Home** or **Workouts**.
6. Log sets, use the rest timer, and explicitly finish the workout.
7. Review factual history under **Progress**.
8. Copy a weekly report from **Coach review** into the existing coaching conversation.
9. If ChatGPT recommends changes, paste its `schemaVersion: 1` patch back into VicGym.
10. Validate, preview, and explicitly apply it. VicGym creates version 2, 3, and so on without altering completed sessions.

## Using the app

### Home

The home screen shows the active programme, current version, workout rotation, current week's completed-session count, last completed workout, and any in-progress session. The start action remains unavailable until a programme has been explicitly activated.

### Workouts

Open **Workouts**, choose a day from the active rotation, and select **Start workout**. VicGym creates a session pinned to the current immutable programme version. If a session is already active, the screen offers **Resume workout** instead of creating another.

During an exercise:

- enter actual reps;
- enter the load only when the exercise supports an external load;
- complete or reopen individual sets;
- navigate between exercises;
- use compatible previous-performance values as context;
- allow `autoRest` to open the rest timer after a newly completed set.

On the finish screen, VicGym reports incomplete planned sets and requires confirmation. The summary and history use only data actually saved for that session.

### Exercises

The exercise catalogue displays active exercises, equipment, target muscles, and the most useful available visual. Exercise details include primary and secondary muscles, equipment, default target reps, load-entry meaning, real media, references, and a **Watch movement** action when an approved video reference exists.

Machine exercises may use their verified machine photograph as the main visual. Dumbbell, bodyweight, and studio-accessory exercises do not reuse a generic equipment photo as if it demonstrated the movement; they use an exercise-specific image or an intentional placeholder.

### Programme

The Programme screen is read-only. It displays the currently active programme version, workout-day rotation, exercise order, planned sets/reps/load, and rest duration. All changes are made through Coach Changes JSON.

### Progress

Progress is computed from completed sessions, including sessions performed under older programme versions. Period filters cover 4, 8, 12 weeks and all time. Machine levels and kilograms are never placed into the same comparison series, and legacy records with incompatible semantics are preserved but excluded from direct comparisons.

### Coach review

**More → Coach review** provides:

- a week selector;
- an exact Markdown report preview;
- **Copy for ChatGPT** using the exact preview text;
- a Coach Changes JSON textarea;
- validation and an old-versus-new preview;
- explicit confirmation before applying changes.

The report is a compact weekly data handoff, not a full AI system prompt. It expects the dedicated coaching conversation to retain permanent coaching instructions.

### Timer alerts

Open **More → Rest-timer alerts** to enable sound and, where supported, vibration. Enabling sound from the toggle gives the browser the user gesture normally required to initialize audio. Use **Test alert** before a workout.

Web alerts remain best-effort. iPhone and iPad browsers do not expose web vibration, device silent/restricted modes may suppress effects, and a fully suspended PWA cannot be relied upon to alert.

## Programme creation and Coach Changes

VicGym has no programme-creation form. Initial creation and later changes both use the Coach Review safety flow.

### Initial creation: schema version 2

Use `schemaVersion: 2` only to create the first real programme. The server assigns version 1. Every exercise must already exist and be active in the VicGym catalogue.

```json
{
  "schemaVersion": 2,
  "operation": "create-programme",
  "program": {
    "slug": "small-gym",
    "name": "Small Gym Programme"
  },
  "days": [
    {
      "slug": "upper-a",
      "name": "Upper A",
      "rotationOrder": 1,
      "exercises": [
        {
          "exercise": "chest-press",
          "sets": 3,
          "targetReps": 12,
          "load": { "type": "machineLevel", "value": 8 },
          "restSeconds": 120,
          "autoRest": true,
          "position": 1
        },
        {
          "exercise": "one-arm-dumbbell-row",
          "sets": 3,
          "targetReps": 12,
          "load": { "type": "kg", "value": 10 },
          "restSeconds": 120,
          "autoRest": true,
          "position": 2
        }
      ]
    }
  ]
}
```

Creation is rejected when the programme slug already exists or a real programme has already been created. Day slugs, rotation positions, exercise positions, and exercises must be unique where required. At least one exercise is required.

### Weekly changes: schema version 1

Use `schemaVersion: 1` for ongoing patches to the active programme. Copy `program` and `baseVersion` exactly from the current weekly report. The patch changes only listed items, creates the next immutable version of the same programme, and activates the new version after explicit confirmation.

```json
{
  "schemaVersion": 1,
  "program": "small-gym",
  "baseVersion": 1,
  "changes": [
    {
      "action": "upsert",
      "day": "upper-a",
      "exercise": "chest-press",
      "load": { "type": "machineLevel", "value": 9 },
      "restSeconds": 120
    },
    {
      "action": "remove",
      "day": "upper-a",
      "exercise": "one-arm-dumbbell-row"
    }
  ]
}
```

An `upsert` can add an active catalogue exercise to an existing day or change its sets, target reps, load, rest, automatic-rest setting, or position. Omitted properties preserve their existing values. A `remove` contains only `action`, `day`, and `exercise`.

An actionable schema-version-1 import requires at least one change. The weekly report may show `"changes": []` to tell ChatGPT how to indicate that no changes are required; there is then nothing to apply.

The server rejects stale `baseVersion` values, inactive or unknown exercises, unknown days, duplicates, incompatible load types, invalid positions, and conflicting changes. Validation is repeated inside the apply transaction to protect against changes between preview and confirmation.

See [docs/programme-json-import.md](docs/programme-json-import.md) for the concise protocol reference.

## Load tracking

Load meaning belongs to the exercise catalogue and is snapshotted into programme versions, exercise sessions, and set logs.

| Tracking type | Meaning | JSON | Workout display |
|---|---|---|---|
| `KILOGRAM` | External load measured in kilograms | `{"type":"kg","value":10}` | `10 kg`, `10 kg per dumbbell`, or total-load wording according to entry mode |
| `MACHINE_LEVEL` | Number printed on a selectorized machine control | `{"type":"machineLevel","value":8}` | `L8` |
| `BODYWEIGHT` | No separately entered external load | `null` | `Bodyweight` |
| `REPS_ONLY` | Repetitions without a load value | `null` | reps only |

`LoadEntryMode` describes entry semantics separately from the unit:

- `STACK_TOTAL`: selectorized machine entry;
- `TOTAL_LOAD`: one total kilogram value;
- `PER_DUMBBELL`: kilogram value for each dumbbell;
- `BODYWEIGHT`: external-load field hidden;
- `NONE`: external-load field hidden.

For programme JSON:

```json
{ "load": { "type": "machineLevel", "value": 8 } }
```

means machine **Level 8**, never 8 kg, while:

```json
{ "load": { "type": "kg", "value": 10 } }
```

means 10 kilograms using the exercise's entry mode. `weightKg` remains accepted only as a backwards-compatible schema-version-1 field for kilogram exercises. Do not provide `load` and `weightKg` together.

Historical `weightKg` values are preserved unchanged. Old machine records are not silently reinterpreted as levels and are excluded from incompatible prefilling and comparisons. Only compatible kilogram records contribute to kg-rep volume.

## Exercise catalogue

The seed currently defines 25 active exercises. The exact slugs below are the identifiers accepted by programme imports.

### Small-gym machines

All selectorized machine exercises use `MACHINE_LEVEL` with `STACK_TOTAL` entry semantics.

| Slug | Display name | Primary muscle | Secondary muscles |
|---|---|---|---|
| `triceps-press` | Triceps Press | Triceps | — |
| `chest-press` | Chest Press | Chest | Triceps, anterior deltoids |
| `shoulder-press` | Shoulder Press | Anterior deltoids | Lateral deltoids, triceps |
| `machine-squat` | Machine Squat | Quadriceps | Glutes, hamstrings |
| `leg-extension` | Leg Extension | Quadriceps | — |
| `lat-pulldown` | Lat Pulldown | Lats | Biceps, upper back |
| `biceps-curl` | Biceps Curl | Biceps | Forearms |
| `machine-abdominal-crunch` | Machine Abdominal Crunch | Abdominals | Obliques |
| `seated-leg-curl` | Seated Leg Curl | Hamstrings | Calves |

### Dumbbell exercises

These use kilograms. `PER_DUMBBELL` means the entered number is the weight of each dumbbell; Goblet Squat uses one total-load value.

| Slug | Display name | Entry mode | Primary muscle | Secondary muscles |
|---|---|---|---|---|
| `dumbbell-chest-press` | Dumbbell Chest Press | Per dumbbell | Chest | Triceps, anterior deltoids |
| `goblet-squat` | Goblet Squat | Total load | Quadriceps | Glutes, hamstrings |
| `dumbbell-romanian-deadlift` | Dumbbell Romanian Deadlift | Per dumbbell | Hamstrings | Glutes, lower back, forearms |
| `one-arm-dumbbell-row` | One-arm Dumbbell Row | Per dumbbell; reps per side | Lats | Upper back, biceps, forearms |
| `standing-dumbbell-shoulder-press` | Standing Dumbbell Shoulder Press | Per dumbbell | Anterior deltoids | Lateral deltoids, triceps |
| `dumbbell-biceps-curl` | Dumbbell Biceps Curl | Per dumbbell | Biceps | Forearms |
| `dumbbell-lateral-raise` | Dumbbell Lateral Raise | Per dumbbell | Lateral deltoids | Anterior deltoids |
| `hip-raises` | Hip Raises | Total load | Glutes | Hamstrings, lower back |
| `calf-raises` | Calf Raises | Total load | Calves | — |

### Bodyweight and studio exercises

| Slug | Display name | Tracking | Primary muscle | Secondary muscles |
|---|---|---|---|---|
| `push-up` | Push-up | Bodyweight | Chest | Triceps, anterior deltoids |
| `bodyweight-squat` | Bodyweight Squat | Bodyweight | Quadriceps | Glutes, hamstrings |
| `reverse-lunge` | Reverse Lunge | Bodyweight; reps per side | Quadriceps | Glutes, hamstrings |
| `glute-bridge` | Glute Bridge | Bodyweight | Glutes | Hamstrings |
| `step-up` | Step-up | Reps only; reps per side | Quadriceps | Glutes, hamstrings |
| `plank` | Plank | Bodyweight | Abdominals | Obliques |
| `lying-leg-raises` | Lying Leg Raises | Bodyweight | Abdominals | Hip flexors |

Every seeded exercise defaults to 12 target reps. Programme JSON may explicitly configure a different target within the validator's accepted range.

### Verified equipment boundary

The equipment seed contains only supplied-photo-verified records:

- Triceps Press;
- Chest Press;
- Shoulder Press;
- Squat machine;
- Leg Extension;
- Lat Pulldown;
- Biceps Curl;
- Abdominal machine;
- Seated Leg Curl;
- dumbbells/dumbbell rack;
- treadmill;
- exercise bikes;
- ellipticals/cross-trainers;
- studio/bodyweight accessories.

No separate equipment record is inferred from incidental background objects. The studio photograph verifies steps, bars, and plates as accessories, not a dedicated step-up machine or barbell station.

See [docs/equipment-photo-map.md](docs/equipment-photo-map.md) for the source-photo mapping.

## Exercise media

Original supplied photographs remain untouched under `gym-pictures/`. The deterministic processor applies EXIF orientation and produces 640 px and 1280 px WebP/AVIF derivatives under `public/media/equipment/`.

Approved exercise-specific media is stored under `public/media/exercises/<exercise-slug>/`. The standard seed recreates its database metadata idempotently, including provider provenance and video references, without needing a production RapidAPI request.

Current approved ExerciseDB movement-image mappings cover:

- Bodyweight Squat;
- Calf Raises;
- Dumbbell Lateral Raise;
- Dumbbell Romanian Deadlift;
- Goblet Squat;
- Hip Raises;
- Lying Leg Raises;
- One-arm Dumbbell Row;
- Plank;
- Push-up;
- Reverse Lunge.

Exercises without an approved movement image use a stable placeholder. In particular, a dumbbell-rack photo is not shown as if it demonstrates a dumbbell movement, and the studio-accessories photograph is not used as a Step-up movement image.

ExerciseDB is a development-time import source. Runtime pages do not call RapidAPI. Provider videos are kept as external references and are not locally rehosted. Provider licensing and the subscribed RapidAPI plan govern retained media.

See [docs/exercisedb-media-import.md](docs/exercisedb-media-import.md) for the search/import commands and provenance rules.

## Offline and PWA behaviour

VicGym includes a web app manifest, mobile icons, installable standalone presentation, a Serwist service worker, IndexedDB workout state, and an offline fallback.

To install it on a phone:

- **iPhone/iPad:** open the HTTPS site in Safari, use **Share**, then **Add to Home Screen**.
- **Android/Chrome:** open the HTTPS site and choose **Install app** or **Add to Home screen**.

Before relying on offline mode, open the workout while connected so VicGym can prepare the required routes and media. Active-workout actions are saved locally first and queued for synchronization. The interface reports whether changes are synchronized, saved locally, syncing, offline, or need attention.

API responses are not runtime-cached. Prepared workout pages, framework assets, and same-origin optimized media may be cached privately in the browser. **More → Offline & synchronization** provides manual retry and an explicitly confirmed local reset. Resetting private offline data clears IndexedDB, the local outbox, active local workout/timer state, and private runtime caches; it does not delete synchronized PostgreSQL history.

## Architecture and data integrity

### Technology

- Next.js App Router 16;
- React 19 and TypeScript;
- Tailwind CSS 4 and shadcn-compatible UI primitives;
- Prisma 7 with PostgreSQL;
- Zod validation;
- Serwist service worker and IndexedDB local state;
- Vitest and Testing Library;
- Sharp for deterministic image processing;
- standalone multi-stage Docker deployment.

Server components handle normal dashboard, catalogue, programme, history, and reporting reads. Client components handle active-workout interaction, set editing, timer state, offline status, alert controls, and Coach Changes previews.

### Core relational model

- `AppSettings`: singleton timezone, active-programme pointer, units, alerts, and onboarding state.
- `Equipment`, `Exercise`, `Muscle`, `ExerciseMuscle`, `ExerciseMedia`: authoritative verified catalogue.
- `WorkoutProgram`: stable programme identity.
- `ProgramVersion`: immutable version container.
- `WorkoutDay`, `WorkoutExercise`: a version's ordered programme configuration.
- `WorkoutSession`, `ExerciseSession`, `SetLog`, `RestPeriod`: raw workout facts and immutable semantic snapshots.
- `ClientMutation`: idempotent offline replay ledger.

Database constraints enforce unique programme-version numbers, unique day slugs/rotation positions per version, unique exercise positions per day, one active workout, and one active rest period. Apply operations use transactions, and historical session foreign keys use restrictive deletion semantics.

### Authentication and request security

VicGym is intentionally single-owner. It does not install Better Auth or maintain user/account/session records. Coolify's Traefik HTTP Basic Authentication protects the entire domain and API surface before requests reach the application.

Production requirements:

- HTTPS with HTTP redirected to HTTPS;
- a long unique Basic Auth password stored in a password manager;
- no directly published container port bypassing Traefik;
- private PostgreSQL connectivity;
- exact `APP_ORIGIN` configuration;
- no permissive CORS headers;
- tested database backups.

Mutation routes accept same-origin JSON only. Browser-cached offline data is protected by the phone/browser profile, not by an additional in-app lock. Browser-native Basic Authentication has an awkward logout flow; clear site credentials and reset private offline data before handing an unlocked browser profile to another person.

## Application routes

| Route | Purpose |
|---|---|
| `/` | Home, active programme, rotation, current session, and recent summary |
| `/workouts` | Choose, start, or resume a workout |
| `/workouts/[sessionId]` | Active-session redirect/navigation |
| `/workouts/[sessionId]/exercises/[exerciseSessionId]` | Set logging and exercise navigation |
| `/workouts/[sessionId]/finish` | Incomplete-set review and completion confirmation |
| `/workouts/[sessionId]/summary` | Saved workout summary |
| `/exercises` | Active verified catalogue |
| `/exercises/[slug]` | Exercise details and media |
| `/programme` | Read-only active programme/version |
| `/progress` | Completed-history overview |
| `/progress/exercises/[slug]` | Compatible exercise progression/history |
| `/more` | Coach, offline, and timer-alert controls |
| `/more/review` | Weekly report and Coach Changes workflow |
| `/more/offline` | Sync status, retry, and private local reset |
| `/offline` | Offline workout recovery |
| `/api/health` | Application/database readiness |

Mutation APIs exist for workout start, set logging, timer actions, workout finish, offline synchronization, programme activation, Coach Changes preview/apply, and timer-alert settings. They are application-internal endpoints rather than a public third-party API.

## Local development

### Requirements

- Node.js `>=22.22.2` (the production Docker image uses Node.js 24);
- npm;
- Docker and Docker Compose for the provided local PostgreSQL service.

### Setup

```bash
cp .env.example .env
docker compose -f compose.dev.yml up -d
npm install
npm run phase2:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The local database URL supplied by `compose.dev.yml` is:

```dotenv
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym
```

`phase2:setup` processes supplied gym photographs, generates the Prisma client, applies migrations, and runs the idempotent seed. If processed assets already exist, the individual database commands are sufficient:

```bash
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `APP_ORIGIN` | Production | Exact public origin used for same-origin mutation validation, such as `https://gym.example.com`; no path or trailing slash |
| `APP_TIMEZONE` | No | Application/reporting timezone; defaults to `Europe/London` |
| `RAPIDAPI_KEY` | Developer media import only | Server-only ExerciseDB credential; never expose as `NEXT_PUBLIC_*` |
| `RAPIDAPI_HOST` | Developer media import only | ExerciseDB provider host; a default is supplied |
| `NODE_ENV` | Runtime-managed | `development`, `test`, or `production` |

Do not commit `.env` files or print/log RapidAPI credentials. `APP_ORIGIN` is not needed for ordinary local development when request and browser origins match directly.

## Database and seed

Apply migrations with:

```bash
npm run db:migrate:deploy
```

Seed the verified catalogue with this exact command:

```bash
npm run db:seed
```

The seed is idempotent. It creates or updates:

- singleton application settings without selecting a real programme;
- 14 verified equipment records and supplied-photo metadata;
- 16 muscles;
- 25 active exercises and muscle relationships;
- approved exercise-specific image/video metadata;
- the inactive demo programme/version used as software fixture data.

It does not fabricate workout history, activate the demo automatically, replace historical programme versions, or call ExerciseDB at runtime.

Useful Prisma commands:

```bash
npm run db:validate
npm run db:format
npm run db:migrate:dev
npm run db:migrate:deploy
npm run db:seed
```

## Testing and verification

Run the standard checks:

```bash
npm run check
npm run build
npm run db:validate
```

`npm run check` runs ESLint, TypeScript, and the Vitest suite.

Feature verifiers:

```bash
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym npm run verify:phase2
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym_phase3_test npm run verify:phase3
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym_phase4_test npm run verify:phase4
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym_phase6_test npm run verify:phase6
DATABASE_URL=postgresql://vicgym:vicgym-local-only@localhost:5432/vicgym_lifecycle_test npm run verify:programme-lifecycle
```

The Phase 3, Phase 4, Phase 6, and programme-lifecycle verifiers must use isolated databases whose names end in `_test`. They create controlled fixture records and clean up their workout/mutation data. Do not point them at a production database.

Image-processing and development import commands:

```bash
npm run photos:process
npm run exercise-media:search -- "goblet squat"
npm run exercise-media:import -- goblet-squat exr_selected_id
```

Always inspect ExerciseDB candidates before importing and follow the provider/provenance restrictions documented in [docs/exercisedb-media-import.md](docs/exercisedb-media-import.md).

## Production deployment with Coolify

1. Create a standard Coolify application from this repository using the included `Dockerfile`; leave Coolify's custom start command empty.
2. Create PostgreSQL on Coolify's internal network; do not expose its port publicly.
3. Set `DATABASE_URL`, `APP_ORIGIN`, and `APP_TIMEZONE` in the application environment.
4. Route the public HTTPS domain through Coolify/Traefik to container port `3000`.
5. Redirect HTTP to HTTPS.
6. Enable Traefik HTTP Basic Authentication with a long unique password.
7. Do not publish container port `3000` directly on the host.
8. Set the health-check path to `/api/health`.
9. Configure and test scheduled PostgreSQL backups.
10. Deploy and confirm the startup logs show both migration and seed completion.

The multi-stage image builds a standalone Next.js server. On container start, `docker-entrypoint.sh` runs:

```text
prisma migrate deploy
idempotent verified catalogue seed
standalone Next.js server
```

The server command is `node .next/standalone/server.js` (also exposed as `npm start`). A post-build packaging step places `public` and `.next/static` inside the standalone bundle so the minimal server can serve PWA icons, exercise media, styles, and client JavaScript. Do not set Coolify's start command to `next start`. If Coolify requires a custom Docker start command, use `./docker-entrypoint.sh` to retain migration and catalogue-seed startup behavior.

If migration or seeding fails, the server does not start. `/api/health` returns `200` only when the application can reach the database; database failure returns `503`.

See [docs/coolify-deployment.md](docs/coolify-deployment.md) for the focused deployment reference.

## Troubleshooting

### No exercises appear after deployment

Check the deployment startup logs. Migrations create tables but do not create catalogue rows. Run the seed separately in the Coolify application terminal if necessary:

```bash
npm run db:seed
```

Do not combine that command with another command and do not type the shell prompt marker (`#`). A successful seed reports the equipment, exercise, and muscle counts.

### ExerciseDB images or Watch movement are missing

Confirm the deployed source includes the files under `public/media/exercises/` and that the latest idempotent seed has run. The seed creates `ExerciseMedia` image rows and provider-video reference rows that connect those files/references to catalogue exercises. Redeploy first, then run:

```bash
npm run db:seed
```

A movement button only appears when that exercise has a video-reference media record.

### “A matching Origin header is required”

Programme JSON must not contain an `Origin` property. The browser supplies the HTTP `Origin` header. Set the exact public HTTPS origin in Coolify:

```dotenv
APP_ORIGIN=https://your-exact-vicgym-domain.example
```

Do not include a path or trailing slash. Redeploy after changing the variable. This lets VicGym validate the public browser origin even if the reverse proxy reports an internal service host.

### Changes are deployed but the installed PWA looks old

Open the application while online and perform a hard refresh. If a private runtime cache remains stale, use **More → Offline & synchronization → Reset private offline data**, then reload. This also removes unsynchronized local workout state, so synchronize or finish important local changes first.

### Synchronization shows “Needs attention”

Open **More → Offline & synchronization** to see the first blocked mutation type, its queue sequence, retry count, and server error. Ordered replay intentionally preserves later changes behind the first failure. Use **Retry synchronization** after correcting the displayed cause; acknowledged and duplicate mutations are removed automatically, while unacknowledged local workout data remains on the device.

### Timer has no sound or vibration

Open **More → Rest-timer alerts**, enable the supported alerts, and use **Test alert** from a direct tap. Keep VicGym open during the timer. iPhone/iPad browsers do not support web vibration; silent mode, browser restrictions, operating-system power controls, or full PWA suspension may prevent an alert.

### Coach Changes rejects an exercise

Use the exact active catalogue slug listed in [Exercise catalogue](#exercise-catalogue). Programme JSON cannot add exercises to the catalogue. Also verify that the selected load type matches the catalogue: machine selectors use `machineLevel`, dumbbells use `kg`, and bodyweight/reps-only exercises use `null`.

### Coach Changes rejects the base version

Generate a new weekly report and copy its exact `program` and `baseVersion`. A patch based on an older active version is rejected to prevent overwriting newer programme changes.

## Current limitations

- VicGym is a private single-owner application, not a multi-user service.
- There is no in-app programme/workout-day editor by design.
- VicGym does not call ChatGPT or ExerciseDB automatically at runtime.
- Programme JSON can only reference existing active catalogue exercises.
- The active programme's day names and rotation are established during initial creation; schema-version-1 weekly patches currently operate on exercises within existing days.
- Offline support is focused on an already prepared active workout, not arbitrary offline catalogue or programme administration.
- Sound and vibration are best-effort while the app is open; there is no guaranteed alarm from a suspended PWA.
- Web vibration is unavailable on iPhone and iPad browsers.
- Provider videos remain externally hosted references and depend on provider availability and terms.
- Basic Authentication has no polished in-app logout and offline browser data has no additional in-app encryption lock.
- The application records factual workout data; it does not determine whether a programme or exercise is appropriate for a person.

## Project structure

```text
src/app/                 Next.js pages, route handlers, manifest, and service worker
src/components/          Mobile UI, workout controls, timer, charts, and review workflow
src/data/                Verified catalogue, demo fixture, and approved media mappings
src/lib/                 Validation, load semantics, offline storage/sync, and shared utilities
src/server/              Active programme, workouts, reports, progress, timers, and imports
prisma/                  Schema, migrations, generated seed entry point
scripts/                 Media processing/import and lifecycle verification scripts
gym-pictures/            Untouched supplied source photographs
public/media/equipment/  Generated responsive equipment images
public/media/exercises/  Generated responsive movement images
docs/                    Focused deployment, JSON, equipment, and ExerciseDB references
```

## Design principles

- Mobile-first and installable.
- Raw history over mutable aggregates.
- Explicit confirmation before consequential programme changes.
- Stable identifiers and strict validation instead of fuzzy imports.
- Real verified media instead of misleading generic imagery.
- Separate machine levels from kilograms everywhere.
- Local-first active-workout writes with visible synchronization state.
- No fabricated workout history, health assumptions, or automatic coaching claims.
