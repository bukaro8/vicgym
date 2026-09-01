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

The command uses AscendAPI's filtered `GET /api/v1/exercises?name=...&limit=10` endpoint and then retrieves each candidate detail record. It prints the provider exercise ID, name, body parts, target muscles, equipment, images, and optional video reference. Use `--after <exerciseId>` to continue cursor pagination.

Import only after reviewing the displayed candidate:

```bash
npm run exercise-media:import -- goblet-squat exr_selected_id
```

The importer is intentionally restricted to the current eleven placeholder exercises. It refuses unknown, unavailable, and machine exercises, so verified VicGym machine photographs remain unchanged. It writes 640/1280 WebP and AVIF derivatives to `public/media/exercises/<vicgym-slug>/`, upserts the local image row by provider/external ID, and stores an optional provider-hosted video reference without downloading it.

The ExerciseMedia record retains provider, external ID, source URL, kind, and attribution. Re-running the same mapping updates the existing record rather than adding a duplicate.

ExerciseDB/AscendAPI licensing and the subscribed RapidAPI plan govern imported media. Basic-plan assets may be watermarked; VicGym does not remove or obscure watermarks. Provider videos remain references rather than locally rehosted copies. Review the applicable provider terms before importing or retaining media.
