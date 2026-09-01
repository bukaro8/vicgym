import { describe, expect, it } from "vitest";

import { getExercisePrimaryMedia, getExerciseReferenceMedia, getExerciseVideoMedia } from "@/lib/exercise-media";

const machinePhoto = { storagePath: "/machine.webp", altText: "Machine", role: "PRIMARY" };
const rackPhoto = { storagePath: "/rack.webp", altText: "Rack", role: "PRIMARY" };

describe("exercise display media", () => {
  it("uses a machine photo only for a machine exercise without its own image", () => {
    expect(getExercisePrimaryMedia({ equipment: { type: "MACHINE", media: [machinePhoto] } })).toEqual(machinePhoto);
  });

  it("does not present a dumbbell rack or studio accessories as an exercise movement", () => {
    expect(getExercisePrimaryMedia({ equipment: { type: "DUMBBELL", media: [rackPhoto] } })).toBeNull();
    expect(getExercisePrimaryMedia({ equipment: { type: "STEP", media: [rackPhoto] } })).toBeNull();
    expect(getExercisePrimaryMedia({ equipment: null })).toBeNull();
    expect(getExerciseReferenceMedia({ equipment: { type: "DUMBBELL", media: [rackPhoto] } })).toEqual([]);
  });

  it("prefers an exercise-owned movement image for every equipment type", () => {
    const movement = { storagePath: "/curl.webp", altText: "Dumbbell curl movement", role: "PRIMARY" };
    expect(getExercisePrimaryMedia({ media: [movement], equipment: { type: "DUMBBELL", media: [rackPhoto] } })).toEqual(movement);
  });

  it("keeps a provider video reference separate from image selection", () => {
    const video = { storagePath: "https://cdn.exercisedb.dev/video.mp4", sourceUrl: "https://cdn.exercisedb.dev/video.mp4", altText: "Movement video", role: "REFERENCE", kind: "VIDEO" };
    expect(getExercisePrimaryMedia({ media: [video], equipment: { type: "DUMBBELL", media: [rackPhoto] } })).toBeNull();
    expect(getExerciseVideoMedia({ media: [video] })).toEqual(video);
  });
});
