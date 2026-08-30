export type EquipmentTypeSeed =
  | "MACHINE"
  | "DUMBBELL"
  | "BARBELL"
  | "BODYWEIGHT"
  | "CARDIO"
  | "STEP";

export type MediaRoleSeed = "PRIMARY" | "REFERENCE";
export type RepModeSeed = "TOTAL" | "PER_SIDE";
export type LoadEntryModeSeed =
  | "STACK_TOTAL"
  | "TOTAL_LOAD"
  | "PER_DUMBBELL"
  | "BODYWEIGHT"
  | "NONE";

export const DEFAULT_TARGET_REPS = 12;
export const DEMO_SETS = 3;

export type EquipmentPhotoSeed = {
  filename: string;
  role: MediaRoleSeed;
  alt: string;
};

export type EquipmentSeed = {
  slug: string;
  name: string;
  type: EquipmentTypeSeed;
  notes: string;
  photos: EquipmentPhotoSeed[];
};

export const equipmentSeed: EquipmentSeed[] = [
  {
    slug: "triceps-press",
    name: "Triceps Press",
    type: "MACHINE",
    notes: "Life Fitness selectorized triceps press verified from its label and front view.",
    photos: [
      { filename: "20260830_141811.jpg", role: "PRIMARY", alt: "Front view of the Life Fitness Triceps Press machine" },
      { filename: "20260830_141807.jpg", role: "REFERENCE", alt: "Triceps Press machine label showing its name and movement diagram" },
    ],
  },
  {
    slug: "chest-press",
    name: "Chest Press",
    type: "MACHINE",
    notes: "Life Fitness selectorized chest press verified from its label and front view.",
    photos: [
      { filename: "20260830_141819.jpg", role: "PRIMARY", alt: "Front view of the Life Fitness Chest Press machine" },
      { filename: "20260830_141816.jpg", role: "REFERENCE", alt: "Chest Press machine label showing its name and movement diagram" },
    ],
  },
  {
    slug: "shoulder-press",
    name: "Shoulder Press",
    type: "MACHINE",
    notes: "Life Fitness selectorized shoulder press verified from its label and front view.",
    photos: [
      { filename: "20260830_141830.jpg", role: "PRIMARY", alt: "Front view of the Life Fitness Shoulder Press machine" },
      { filename: "20260830_141826.jpg", role: "REFERENCE", alt: "Shoulder Press machine label showing its name and movement diagram" },
    ],
  },
  {
    slug: "squat-machine",
    name: "Squat machine",
    type: "MACHINE",
    notes: "Life Fitness selectorized squat machine verified from its label and platform view.",
    photos: [
      { filename: "20260830_141840.jpg", role: "PRIMARY", alt: "Platform and handles of the Life Fitness Squat machine" },
      { filename: "20260830_141836.jpg", role: "REFERENCE", alt: "Squat machine label showing its name and movement diagram" },
    ],
  },
  {
    slug: "leg-extension",
    name: "Leg Extension",
    type: "MACHINE",
    notes: "Life Fitness selectorized leg extension verified across its label and machine views.",
    photos: [
      { filename: "20260830_141941.jpg", role: "PRIMARY", alt: "Front view of the Life Fitness Leg Extension machine" },
      { filename: "20260830_141936.jpg", role: "REFERENCE", alt: "Leg Extension machine label and movement diagram" },
      { filename: "20260830_141850.jpg", role: "REFERENCE", alt: "Side view of the Leg Extension seat and shin pad" },
      { filename: "20260830_141846.jpg", role: "REFERENCE", alt: "Alternate close view of the Leg Extension label and mechanism" },
    ],
  },
  {
    slug: "lat-pulldown",
    name: "Lat Pulldown",
    type: "MACHINE",
    notes: "Life Fitness selectorized pulldown verified from the labelled machine and wider front view.",
    photos: [
      { filename: "20260830_141858.jpg", role: "PRIMARY", alt: "Wider front view of the Life Fitness Lat Pulldown machine" },
      { filename: "20260830_141853.jpg", role: "REFERENCE", alt: "Lat Pulldown machine label showing its name and movement diagram" },
    ],
  },
  {
    slug: "biceps-curl",
    name: "Biceps Curl",
    type: "MACHINE",
    notes: "Life Fitness selectorized biceps curl verified from its label and front view.",
    photos: [
      { filename: "20260830_141908.jpg", role: "PRIMARY", alt: "Front view of the Life Fitness Biceps Curl machine" },
      { filename: "20260830_141904.jpg", role: "REFERENCE", alt: "Biceps Curl machine label showing its name and movement diagram" },
    ],
  },
  {
    slug: "abdominal-machine",
    name: "Abdominal machine",
    type: "MACHINE",
    notes: "Life Fitness abdominal machine verified by the visible AB DOMINAL label in the main photograph.",
    photos: [
      { filename: "20260830_141918.jpg", role: "PRIMARY", alt: "Life Fitness Abdominal machine with its label visible beside the seat" },
    ],
  },
  {
    slug: "seated-leg-curl",
    name: "Seated Leg Curl",
    type: "MACHINE",
    notes: "Life Fitness selectorized seated leg curl verified from its label and front view.",
    photos: [
      { filename: "20260830_141931.jpg", role: "PRIMARY", alt: "Front view of the Life Fitness Seated Leg Curl machine" },
      { filename: "20260830_141928.jpg", role: "REFERENCE", alt: "Seated Leg Curl machine label showing its name and movement diagram" },
    ],
  },
  {
    slug: "dumbbells",
    name: "Dumbbells / dumbbell rack",
    type: "DUMBBELL",
    notes: "Multi-tier dumbbell rack visible in the free-weights area.",
    photos: [
      { filename: "20260830_141924.jpg", role: "PRIMARY", alt: "Three-tier rack of dumbbells in front of a wall mirror" },
    ],
  },
  {
    slug: "treadmill",
    name: "Treadmill",
    type: "CARDIO",
    notes: "Life Fitness treadmill shown from the user position.",
    photos: [
      { filename: "20260830_141948.jpg", role: "PRIMARY", alt: "Life Fitness treadmill deck, rails and console" },
    ],
  },
  {
    slug: "exercise-bikes",
    name: "Exercise bikes",
    type: "CARDIO",
    notes: "Upright and recumbent exercise bikes visible together in the cardio area.",
    photos: [
      { filename: "20260830_141959.jpg", role: "PRIMARY", alt: "Upright and recumbent exercise bikes in the gym cardio area" },
    ],
  },
  {
    slug: "ellipticals-cross-trainers",
    name: "Ellipticals / cross-trainers",
    type: "CARDIO",
    notes: "Multiple Life Fitness cross-trainers visible from the front and side.",
    photos: [
      { filename: "20260830_142004.jpg", role: "PRIMARY", alt: "Row of Life Fitness elliptical cross-trainers" },
    ],
  },
  {
    slug: "studio-accessories",
    name: "Studio/bodyweight accessories",
    type: "STEP",
    notes: "Studio bars, plates and step platforms shown together; no rack or other barbell station is inferred.",
    photos: [
      { filename: "20260830_142012.jpg", role: "PRIMARY", alt: "Studio bars, coloured plates and stacked step platforms" },
    ],
  },
];

export const muscleSeed = [
  { slug: "chest", name: "Chest", groupName: "Upper body" },
  { slug: "triceps", name: "Triceps", groupName: "Arms" },
  { slug: "anterior-deltoids", name: "Anterior deltoids", groupName: "Shoulders" },
  { slug: "lateral-deltoids", name: "Lateral deltoids", groupName: "Shoulders" },
  { slug: "lats", name: "Lats", groupName: "Back" },
  { slug: "biceps", name: "Biceps", groupName: "Arms" },
  { slug: "upper-back", name: "Upper back", groupName: "Back" },
  { slug: "quadriceps", name: "Quadriceps", groupName: "Legs" },
  { slug: "glutes", name: "Glutes", groupName: "Hips" },
  { slug: "hamstrings", name: "Hamstrings", groupName: "Legs" },
  { slug: "calves", name: "Calves", groupName: "Legs" },
  { slug: "abdominals", name: "Abdominals", groupName: "Core" },
  { slug: "obliques", name: "Obliques", groupName: "Core" },
  { slug: "lower-back", name: "Lower back", groupName: "Back" },
  { slug: "forearms", name: "Forearms", groupName: "Arms" },
] as const;

type ExerciseSeed = {
  slug: string;
  name: string;
  equipmentSlug: string | null;
  primaryMuscle: string;
  secondaryMuscles: string[];
  repMode: RepModeSeed;
  loadEntryMode: LoadEntryModeSeed;
};

export const exerciseSeed: ExerciseSeed[] = [
  { slug: "triceps-press", name: "Triceps Press", equipmentSlug: "triceps-press", primaryMuscle: "triceps", secondaryMuscles: [], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "chest-press", name: "Chest Press", equipmentSlug: "chest-press", primaryMuscle: "chest", secondaryMuscles: ["triceps", "anterior-deltoids"], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "shoulder-press", name: "Shoulder Press", equipmentSlug: "shoulder-press", primaryMuscle: "anterior-deltoids", secondaryMuscles: ["lateral-deltoids", "triceps"], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "machine-squat", name: "Machine Squat", equipmentSlug: "squat-machine", primaryMuscle: "quadriceps", secondaryMuscles: ["glutes", "hamstrings"], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "leg-extension", name: "Leg Extension", equipmentSlug: "leg-extension", primaryMuscle: "quadriceps", secondaryMuscles: [], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "lat-pulldown", name: "Lat Pulldown", equipmentSlug: "lat-pulldown", primaryMuscle: "lats", secondaryMuscles: ["biceps", "upper-back"], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "biceps-curl", name: "Biceps Curl", equipmentSlug: "biceps-curl", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "machine-abdominal-crunch", name: "Machine Abdominal Crunch", equipmentSlug: "abdominal-machine", primaryMuscle: "abdominals", secondaryMuscles: ["obliques"], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "seated-leg-curl", name: "Seated Leg Curl", equipmentSlug: "seated-leg-curl", primaryMuscle: "hamstrings", secondaryMuscles: ["calves"], repMode: "TOTAL", loadEntryMode: "STACK_TOTAL" },
  { slug: "goblet-squat", name: "Goblet Squat", equipmentSlug: "dumbbells", primaryMuscle: "quadriceps", secondaryMuscles: ["glutes", "hamstrings"], repMode: "TOTAL", loadEntryMode: "TOTAL_LOAD" },
  { slug: "dumbbell-romanian-deadlift", name: "Dumbbell Romanian Deadlift", equipmentSlug: "dumbbells", primaryMuscle: "hamstrings", secondaryMuscles: ["glutes", "lower-back", "forearms"], repMode: "TOTAL", loadEntryMode: "PER_DUMBBELL" },
  { slug: "one-arm-dumbbell-row", name: "One-arm Dumbbell Row", equipmentSlug: "dumbbells", primaryMuscle: "lats", secondaryMuscles: ["upper-back", "biceps", "forearms"], repMode: "PER_SIDE", loadEntryMode: "PER_DUMBBELL" },
  { slug: "standing-dumbbell-shoulder-press", name: "Standing Dumbbell Shoulder Press", equipmentSlug: "dumbbells", primaryMuscle: "anterior-deltoids", secondaryMuscles: ["lateral-deltoids", "triceps"], repMode: "TOTAL", loadEntryMode: "PER_DUMBBELL" },
  { slug: "dumbbell-biceps-curl", name: "Dumbbell Biceps Curl", equipmentSlug: "dumbbells", primaryMuscle: "biceps", secondaryMuscles: ["forearms"], repMode: "TOTAL", loadEntryMode: "PER_DUMBBELL" },
  { slug: "dumbbell-lateral-raise", name: "Dumbbell Lateral Raise", equipmentSlug: "dumbbells", primaryMuscle: "lateral-deltoids", secondaryMuscles: ["anterior-deltoids"], repMode: "TOTAL", loadEntryMode: "PER_DUMBBELL" },
  { slug: "push-up", name: "Push-up", equipmentSlug: null, primaryMuscle: "chest", secondaryMuscles: ["triceps", "anterior-deltoids"], repMode: "TOTAL", loadEntryMode: "BODYWEIGHT" },
  { slug: "bodyweight-squat", name: "Bodyweight Squat", equipmentSlug: null, primaryMuscle: "quadriceps", secondaryMuscles: ["glutes", "hamstrings"], repMode: "TOTAL", loadEntryMode: "BODYWEIGHT" },
  { slug: "reverse-lunge", name: "Reverse Lunge", equipmentSlug: null, primaryMuscle: "quadriceps", secondaryMuscles: ["glutes", "hamstrings"], repMode: "PER_SIDE", loadEntryMode: "BODYWEIGHT" },
  { slug: "glute-bridge", name: "Glute Bridge", equipmentSlug: null, primaryMuscle: "glutes", secondaryMuscles: ["hamstrings"], repMode: "TOTAL", loadEntryMode: "BODYWEIGHT" },
  { slug: "step-up", name: "Step-up", equipmentSlug: "studio-accessories", primaryMuscle: "quadriceps", secondaryMuscles: ["glutes", "hamstrings"], repMode: "PER_SIDE", loadEntryMode: "NONE" },
];

export const demoProgrammeSeed = {
  slug: "demo-four-day",
  name: "Demo four-day programme",
  notice: "Demo programme — not training advice.",
  version: 1,
  days: [
    {
      slug: "demo-upper-a",
      name: "Demo Upper A",
      exercises: ["chest-press", "lat-pulldown", "shoulder-press", "triceps-press", "biceps-curl"],
    },
    {
      slug: "demo-lower-a",
      name: "Demo Lower A",
      exercises: ["machine-squat", "leg-extension", "seated-leg-curl", "machine-abdominal-crunch", "bodyweight-squat"],
    },
    {
      slug: "demo-upper-b",
      name: "Demo Upper B",
      exercises: ["one-arm-dumbbell-row", "standing-dumbbell-shoulder-press", "push-up", "dumbbell-biceps-curl", "dumbbell-lateral-raise"],
    },
    {
      slug: "demo-lower-b",
      name: "Demo Lower B",
      exercises: ["goblet-squat", "dumbbell-romanian-deadlift", "reverse-lunge", "glute-bridge", "step-up"],
    },
  ],
} as const;

export function mediaStem(equipmentSlug: string, filename: string): string {
  return `/media/equipment/${equipmentSlug}/${filename.replace(/\.jpg$/i, "")}`;
}
