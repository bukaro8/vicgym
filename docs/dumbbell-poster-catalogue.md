# Dumbbell poster catalogue review

Reviewed 23 September 2026. The 40 poster labels resolve to 11 existing exercises, 15 retained additions, and 7 deferred entries. Seven previously reviewed catalogue additions were removed after follow-up review. Total seeded catalogue: 42 exercises, 18 muscles, 14 equipment records. Default target reps remain 12. Existing exercise definitions, programmes and completed session snapshots are unchanged.

## Existing identifiers reused

| Poster label | Existing slug |
|---|---|
| Grip Curl | `dumbbell-biceps-curl` |
| Side Raise | `dumbbell-lateral-raise` |
| Shoulder Press | `standing-dumbbell-shoulder-press` |
| Bench Press | `dumbbell-chest-press` |
| Single Arm Row | `one-arm-dumbbell-row` |
| Goblet Squat | `goblet-squat` |
| Romanian Deadlift | `dumbbell-romanian-deadlift` |
| Glute Bridge | `glute-bridge` |
| Reverse Lunge | `reverse-lunge` |
| Step-Up | `step-up` |
| Calf Raise | `calf-raises` |

Grip Curl is interpreted as the illustrated standard supinated dumbbell curl; its name alone does not justify another exercise. Existing Reverse Lunge remains bodyweight and Step-up remains reps-only; their poster drawings do not silently change existing load semantics.

## New exercises and verified media

All weighted additions use the existing `dumbbells` equipment record and `KILOGRAM` tracking. V-Up uses no equipment and `BODYWEIGHT` tracking. `TOTAL_LOAD` records the single implement's total mass; `PER_DUMBBELL` records each dumbbell's mass. PER_SIDE reps are entered for one side. No load is preselected.

| Slug | Display name | Tracking | Entry mode | Reps | Primary / secondary muscles | API match |
|---|---|---|---|---|---|---|
| `hammer-curl` | Hammer Curl | KILOGRAM | PER_DUMBBELL | TOTAL | biceps / forearms | `slDvUAU` — dumbbell hammer curl |
| `concentration-curl` | Standing Dumbbell Concentration Curl | KILOGRAM | PER_DUMBBELL | PER_SIDE | biceps / forearms | `7inpWch` — dumbbell standing concentration curl |
| `dumbbell-triceps-kickback` | Dumbbell Triceps Kickback | KILOGRAM | PER_DUMBBELL | TOTAL | triceps / posterior-deltoids | `UmpPAAe` — dumbbell standing kickback |
| `dumbbell-front-raise` | Dumbbell Front Raise | KILOGRAM | PER_DUMBBELL | TOTAL | anterior-deltoids / lateral-deltoids, chest | `exr_41n2howQHvcrcrW6` — Front Raise |
| `dumbbell-shrug` | Dumbbell Shrug | KILOGRAM | PER_DUMBBELL | TOTAL | upper-back / forearms | `NJzBsGJ` — dumbbell shrug |
| `dumbbell-reverse-fly` | Dumbbell Reverse Fly | KILOGRAM | PER_DUMBBELL | TOTAL | posterior-deltoids / upper-back, lateral-deltoids | `exr_41n2hyNf5GebszTf` — Dumbbell Rear Delt Fly |
| `dumbbell-side-bend` | Dumbbell Side Bend | KILOGRAM | TOTAL_LOAD | PER_SIDE | obliques / — | `exr_41n2hTCBiQVsEfZ7` — Dumbbell Side Bend |
| `jump-squat` | Dumbbell Jump Squat | KILOGRAM | PER_DUMBBELL | TOTAL | quadriceps / glutes, hamstrings, calves | `exr_41n2huf7mAC2rhfC` — Dumbbell Jumping Squat |
| `v-up` | V-Up | BODYWEIGHT | BODYWEIGHT | TOTAL | abdominals / hip-flexors, obliques | `exr_41n2huc12BsuDNYQ` — V-up |
| `dumbbell-triceps-extension` | Dumbbell Triceps Extension | KILOGRAM | TOTAL_LOAD | TOTAL | triceps / — | `PdmaD0N` — dumbbell standing triceps extension |
| `russian-twist` | Russian Twist | KILOGRAM | TOTAL_LOAD | PER_SIDE | obliques / abdominals, hip-flexors | `WU9BLIs` — weighted russian twist (legs up) |
| `dumbbell-squat` | Dumbbell Squat | KILOGRAM | PER_DUMBBELL | TOTAL | quadriceps / glutes, hamstrings, calves | `HsvHqgf` — dumbbell squat |
| `floor-t-raise` | Dumbbell Floor T Raise | KILOGRAM | PER_DUMBBELL | TOTAL | posterior-deltoids / upper-back | `Ion0XWz` — dumbbell lying on floor rear delt raise |
| `renegade-row` | Dumbbell Renegade Row | KILOGRAM | PER_DUMBBELL | PER_SIDE | lats / upper-back, biceps, abdominals, obliques | Generated local illustration |
| `dumbbell-thruster` | Dumbbell Thruster | KILOGRAM | PER_DUMBBELL | TOTAL | quadriceps / glutes, anterior-deltoids, triceps | Generated local illustration |

Media selection notes:

- Concentration Curl uses the verified **standing** variant, which needs no bench. Its explicit display name and image communicate this difference from the poster's seated variant.
- Front Raise uses a bilateral front raise image, rather than mislabelling a lateral raise as alternating front raise. Reps default to TOTAL.
- V-Up is the unweighted bodyweight variant; no external-load field is implied by its image.
- Dumbbell Squat is a distinct loaded movement with two dumbbells at the sides. It is not an alias for Bodyweight Squat or the single-load Goblet Squat. Existing slugs and load semantics are retained.
- Russian Twist uses the unanchored legs-up weighted variant. An anchored-feet image was rejected during visual inspection and its generated trial derivatives removed.
- Floor T Raise uses the prone floor rear-delt raise, verified against its instructions (arms raised out to the sides) and image.
- Jump Squat uses the actual dumbbell jumping-squat record; machine levels are never used for these additions.

## Placeholders

No retained poster additions use placeholders. The two retained exercises that previously had placeholders now use generated local illustrations.

The paid API was searched with poster names and conventional alternatives. All 1,500 entries in the existing public ExerciseDB catalogue were also paginated and reviewed for candidate names/equipment. Kettlebell renegade rows, bodyweight sumo squats/side lunges, push presses, and unrelated fuzzy-search matches were not substituted. The removed seven entries no longer have catalogue or media references.

## Deferred entries

| Poster label | Reason |
|---|---|
| Wrist Curl | Available correct media is seated/supported. Awaiting confirmation of bench/seating equipment. Candidate `exr_41n2hGy6zE7fN6v2` / `2dImyQ8`. |
| Dumbbell Pullover | Requires a verified flat bench for the poster movement. Candidate `9XjtHvS`. |
| Incline Bench Press | Requires confirmation of an adjustable incline bench. Candidate `ns0SIbU`. |
| Chest Fly | Requires a verified flat bench for the poster movement. Candidate `yz9nUhF`. |
| Incline Row | Requires confirmation of an adjustable incline bench. Candidate `7vG5o25`. |
| Bow Extension | Ambiguous label/diagonal overhead-to-knee illustration; no unambiguous API counterpart identified. Needs the intended movement clarified before defining a stable exercise. |
| Farmer's Walk | Candidate `qPEzJjA` exists, but the logger has no exercise distance/duration metric. Treating metres or seconds as reps would misrepresent history. Deferred pending that separate capability. |

Existing Dumbbell Chest Press is preserved; it does not establish verified ownership of an adjustable bench. No new equipment is inferred from the poster.

## Local media and deployment

Thirteen ExerciseDB imports and two generated local illustrations produce 60 local files (640/1280 WebP and AVIF), selected through the existing exercise-owned PRIMARY media resolver on cards, details, workout previews and offline snapshots. Provider IDs/source URLs/attribution remain in seed metadata. Five available provider videos remain references only; public GIF-based entries have no video reference. Some public GIF sources are low resolution; derivatives retain original resolution rather than upscaling. No provider watermark is removed.

`prisma/seed.ts` already consumes the shared catalogue and media arrays, so no seed algorithm or schema migration is required. Its unique-slug/provider-ID upserts make repeated seeding idempotent. The importer now derives its non-machine allowlist from the catalogue instead of a stale hand-written placeholder list. Machine photo protection applies even with `--assets-only`.

Deploy the code and bundled media, then run `npm run db:seed` if your startup did not already run it. No production API key or media request is needed to seed the bundled images. No programme/session/history update is performed by this expansion.
