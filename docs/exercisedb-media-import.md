# ExerciseDB movement-media import

ExerciseDB is a development import source only. VicGym pages never call RapidAPI; imported images are served from local `/media/exercises/...` paths and are covered by the existing same-origin workout-media cache.

Configure these server-only values in the deployment or local `.env` (never use a `NEXT_PUBLIC_` name):

```dotenv
RAPIDAPI_KEY=...
RAPIDAPI_HOST=edb-with-videos-and-images-by-ascendapi.p.rapidapi.com
```

Search candidates explicitly before selecting one:

```bash
npm run exercise-media:search -- "goblet squat"
```

The command uses AscendAPI's fuzzy `GET /api/v1/exercises/search?search=...&limit=10` endpoint and then retrieves each candidate detail record. It prints the provider exercise ID, name, body parts, target muscles, equipment, images, and optional video reference. Use `--after <exerciseId>` to continue cursor pagination.

Import only after reviewing the displayed candidate:

```bash
npm run exercise-media:import -- goblet-squat exr_selected_id
```

The importer derives its allowlist from VicGym's non-machine catalogue entries. It refuses unknown slugs and machine exercises, including in assets-only mode, so verified VicGym machine photographs remain unchanged. It writes 640/1280 WebP and AVIF derivatives to `public/media/exercises/<vicgym-slug>/`, upserts the local image row by provider/external ID, and stores an optional provider-hosted video reference without downloading it. Pass `--assets-only` when preparing bundled derivatives for catalogue-seed metadata without changing the current database.

The existing public ExerciseDB fallback is used for IDs without the `exr_` prefix. It supplies GIF images through `oss.exercisedb.dev`; imports use a static image frame with the same local derivatives. Review detail records and actual images as well as search names. See [the poster review](dumbbell-poster-catalogue.md) for approved mappings and unmatched movements. An API outage alone does not justify a placeholder.

The ExerciseMedia record retains provider, external ID, source URL, kind, and attribution. Re-running the same mapping updates the existing record rather than adding a duplicate.

ExerciseDB/AscendAPI licensing and the subscribed RapidAPI plan govern imported media. Basic-plan assets may be watermarked; VicGym does not remove or obscure watermarks. Provider videos remain references rather than locally rehosted copies. Review the applicable provider terms before importing or retaining media.
