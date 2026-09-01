export type ExerciseDisplayMedia = {
  id?: string;
  storagePath: string;
  altText: string;
  role: string;
  kind?: string;
  sourceFilename?: string;
  sourceUrl?: string | null;
};

type ExerciseMediaSource = {
  media?: ExerciseDisplayMedia[];
  equipment?: { type: string; media: ExerciseDisplayMedia[] } | null;
};

/**
 * An equipment photograph can illustrate a machine movement, but it does not
 * represent a free-weight, bodyweight, or studio exercise. Exercise-owned media
 * always wins so a future real movement image can be added without UI changes.
 */
export function getExercisePrimaryMedia(exercise: ExerciseMediaSource): ExerciseDisplayMedia | null {
  const exerciseImage = exercise.media?.find((media) => media.role === "PRIMARY" && media.kind !== "VIDEO");
  if (exerciseImage) return exerciseImage;
  return exercise.equipment?.type === "MACHINE"
    ? exercise.equipment.media.find((media) => media.role === "PRIMARY") ?? null
    : null;
}

export function getExerciseReferenceMedia(exercise: ExerciseMediaSource): ExerciseDisplayMedia[] {
  if (exercise.media?.length) return exercise.media.filter((media) => media.role === "REFERENCE" && media.kind !== "VIDEO");
  return exercise.equipment?.type === "MACHINE"
    ? exercise.equipment.media.filter((media) => media.role === "REFERENCE")
    : [];
}

export function getExerciseVideoMedia(exercise: ExerciseMediaSource): ExerciseDisplayMedia | null {
  return exercise.media?.find((media) => media.kind === "VIDEO" && Boolean(media.sourceUrl)) ?? null;
}
