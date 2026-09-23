import type { ExerciseSeed, ExerciseDbMediaSeed } from "./phase-2-catalogue";

// Reviewed poster additions; existing catalogue slugs and session snapshots remain unchanged.
export const posterExerciseSeed: ExerciseSeed[] = [
  {
    "slug": "hammer-curl",
    "name": "Hammer Curl",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "biceps",
    "secondaryMuscles": [
      "forearms"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "concentration-curl",
    "name": "Standing Dumbbell Concentration Curl",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "biceps",
    "secondaryMuscles": [
      "forearms"
    ],
    "repMode": "PER_SIDE",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "dumbbell-triceps-kickback",
    "name": "Dumbbell Triceps Kickback",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "triceps",
    "secondaryMuscles": [
      "posterior-deltoids"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "dumbbell-front-raise",
    "name": "Dumbbell Front Raise",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "anterior-deltoids",
    "secondaryMuscles": [
      "lateral-deltoids",
      "chest"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "dumbbell-shrug",
    "name": "Dumbbell Shrug",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "upper-back",
    "secondaryMuscles": [
      "forearms"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "dumbbell-reverse-fly",
    "name": "Dumbbell Reverse Fly",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "posterior-deltoids",
    "secondaryMuscles": [
      "upper-back",
      "lateral-deltoids"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "dumbbell-side-bend",
    "name": "Dumbbell Side Bend",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "obliques",
    "secondaryMuscles": [],
    "repMode": "PER_SIDE",
    "loadEntryMode": "TOTAL_LOAD",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "jump-squat",
    "name": "Dumbbell Jump Squat",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "quadriceps",
    "secondaryMuscles": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "v-up",
    "name": "V-Up",
    "equipmentSlug": null,
    "primaryMuscle": "abdominals",
    "secondaryMuscles": [
      "hip-flexors",
      "obliques"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "BODYWEIGHT",
    "loadTrackingType": "BODYWEIGHT"
  },
  {
    "slug": "dumbbell-triceps-extension",
    "name": "Dumbbell Triceps Extension",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "triceps",
    "secondaryMuscles": [],
    "repMode": "TOTAL",
    "loadEntryMode": "TOTAL_LOAD",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "russian-twist",
    "name": "Russian Twist",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "obliques",
    "secondaryMuscles": [
      "abdominals",
      "hip-flexors"
    ],
    "repMode": "PER_SIDE",
    "loadEntryMode": "TOTAL_LOAD",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "dumbbell-squat",
    "name": "Dumbbell Squat",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "quadriceps",
    "secondaryMuscles": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "floor-t-raise",
    "name": "Dumbbell Floor T Raise",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "posterior-deltoids",
    "secondaryMuscles": [
      "upper-back"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "renegade-row",
    "name": "Dumbbell Renegade Row",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "lats",
    "secondaryMuscles": [
      "upper-back",
      "biceps",
      "abdominals",
      "obliques"
    ],
    "repMode": "PER_SIDE",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
  {
    "slug": "dumbbell-thruster",
    "name": "Dumbbell Thruster",
    "equipmentSlug": "dumbbells",
    "primaryMuscle": "quadriceps",
    "secondaryMuscles": [
      "glutes",
      "anterior-deltoids",
      "triceps"
    ],
    "repMode": "TOTAL",
    "loadEntryMode": "PER_DUMBBELL",
    "loadTrackingType": "KILOGRAM"
  },
];

// Retained poster additions now have local movement illustrations.
export const posterPlaceholderSlugs = [] as const;

export const posterExerciseMediaSeed: ExerciseDbMediaSeed[] = [
  {
    "exerciseSlug": "hammer-curl",
    "externalId": "slDvUAU",
    "sourceFilename": "exercisedb-slDvUAU-source",
    "sourceUrl": "https://static.exercisedb.dev/media/slDvUAU.gif",
    "alt": "dumbbell hammer curl movement demonstration supplied by ExerciseDB"
  },
  {
    "exerciseSlug": "concentration-curl",
    "externalId": "7inpWch",
    "sourceFilename": "exercisedb-7inpWch-source",
    "sourceUrl": "https://static.exercisedb.dev/media/7inpWch.gif",
    "alt": "dumbbell standing concentration curl movement demonstration supplied by ExerciseDB"
  },
  {
    "exerciseSlug": "dumbbell-triceps-kickback",
    "externalId": "UmpPAAe",
    "sourceFilename": "exercisedb-UmpPAAe-source",
    "sourceUrl": "https://static.exercisedb.dev/media/UmpPAAe.gif",
    "alt": "dumbbell standing kickback movement demonstration supplied by ExerciseDB"
  },
  {
    "exerciseSlug": "dumbbell-shrug",
    "externalId": "NJzBsGJ",
    "sourceFilename": "exercisedb-NJzBsGJ-source",
    "sourceUrl": "https://static.exercisedb.dev/media/NJzBsGJ.gif",
    "alt": "dumbbell shrug movement demonstration supplied by ExerciseDB"
  },
  {
    "exerciseSlug": "dumbbell-side-bend",
    "externalId": "exr_41n2hTCBiQVsEfZ7",
    "sourceFilename": "exercisedb-exr_41n2hTCBiQVsEfZ7-source",
    "sourceUrl": "https://cdn.exercisedb.dev/media/w/images/npkvzZSqV3.jpg",
    "alt": "Dumbbell Side Bend movement demonstration supplied by ExerciseDB",
    "videoUrl": "https://cdn.exercisedb.dev/w/videos/H6GDkvm/41n2hTCBiQVsEfZ7__Dumbbell-Side-Bend_Waist.mp4"
  },
  {
    "exerciseSlug": "jump-squat",
    "externalId": "exr_41n2huf7mAC2rhfC",
    "sourceFilename": "exercisedb-exr_41n2huf7mAC2rhfC-source",
    "sourceUrl": "https://cdn.exercisedb.dev/media/w/images/qEHRERBXBU.jpg",
    "alt": "Dumbbell Jumping Squat movement demonstration supplied by ExerciseDB",
    "videoUrl": "https://cdn.exercisedb.dev/w/videos/d0fWZfg/41n2huf7mAC2rhfC__Dumbbell-Jumping-Squat_Plyometric_.mp4"
  },
  {
    "exerciseSlug": "dumbbell-triceps-extension",
    "externalId": "PdmaD0N",
    "sourceFilename": "exercisedb-PdmaD0N-source",
    "sourceUrl": "https://static.exercisedb.dev/media/PdmaD0N.gif",
    "alt": "dumbbell standing triceps extension movement demonstration supplied by ExerciseDB"
  },
  {
    "exerciseSlug": "russian-twist",
    "externalId": "WU9BLIs",
    "sourceFilename": "exercisedb-WU9BLIs-source",
    "sourceUrl": "https://static.exercisedb.dev/media/WU9BLIs.gif",
    "alt": "weighted russian twist (legs up) movement demonstration supplied by ExerciseDB"
  },
  {
    "exerciseSlug": "floor-t-raise",
    "externalId": "Ion0XWz",
    "sourceFilename": "exercisedb-Ion0XWz-source",
    "sourceUrl": "https://static.exercisedb.dev/media/Ion0XWz.gif",
    "alt": "dumbbell lying on floor rear delt raise movement demonstration supplied by ExerciseDB"
  }
];
