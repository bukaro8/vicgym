import { describe, expect, it, vi } from "vitest";

import { getExerciseDbConfig, getExerciseDbExercise, preferredExerciseDbImage, searchExerciseDb } from "@/lib/exercisedb-core";

const environment = { RAPIDAPI_KEY: "test-key", RAPIDAPI_HOST: "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com" };
const candidate = {
  exerciseId: "exr_example",
  name: "Goblet Squat",
  equipments: ["Dumbbell"],
  bodyParts: ["Upper Legs"],
  exerciseType: "Strength",
  targetMuscles: ["Quadriceps"],
  secondaryMuscles: ["Gluteus Maximus"],
  imageUrl: "https://cdn.exercisedb.dev/media/images/default.webp",
  imageUrls: { "720p": "https://cdn.exercisedb.dev/media/images/detail.webp" },
  videoUrl: "https://cdn.exercisedb.dev/videos/example.mp4",
};

describe("ExerciseDB developer client", () => {
  it("keeps the RapidAPI credential server-side and rejects a missing key", () => {
    expect(() => getExerciseDbConfig({})).toThrow("RAPIDAPI_KEY is required");
    expect(getExerciseDbConfig(environment)).toEqual({ key: "test-key", host: environment.RAPIDAPI_HOST });
  });

  it("uses the documented filtered search endpoint and parses candidates", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, meta: { total: 1, hasNextPage: false }, data: [candidate] }), { status: 200 }));
    const result = await searchExerciseDb("goblet squat", {}, fetcher, environment);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/v1/exercises?name=goblet+squat&limit=10"), expect.objectContaining({ headers: expect.objectContaining({ "x-rapidapi-key": "test-key" }) }));
    expect(result.candidates[0]?.exerciseId).toBe("exr_example");
    expect(preferredExerciseDbImage(result.candidates[0]!)).toBe(candidate.imageUrls["720p"]);
  });

  it("fails safely when an explicit external ID does not return a valid detail record", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, data: null }), { status: 404 }));
    await expect(getExerciseDbExercise("not-a-real-id", fetcher, environment)).rejects.toThrow("ExerciseDB request failed (404)");
  });
});
