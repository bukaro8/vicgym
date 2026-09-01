import { z } from "zod";

export const EXERCISEDB_PROVIDER = "ascendapi-exercisedb";
export const defaultExerciseDbHost = "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";

const urlSchema = z.string().url().refine((value) => new URL(value).protocol === "https:", "ExerciseDB media must use HTTPS");
const exerciseSchema = z.object({
  exerciseId: z.string().min(1), name: z.string().min(1), equipments: z.array(z.string()).default([]), bodyParts: z.array(z.string()).default([]), exerciseType: z.string().optional(), targetMuscles: z.array(z.string()).default([]), secondaryMuscles: z.array(z.string()).default([]), imageUrl: urlSchema.optional(), imageUrls: z.record(z.string(), urlSchema).optional(), videoUrl: urlSchema.optional(),
});
const responseSchema = z.object({ success: z.literal(true), data: z.union([exerciseSchema, z.array(exerciseSchema)]), meta: z.object({ total: z.number().optional(), hasNextPage: z.boolean().optional(), hasPreviousPage: z.boolean().optional(), nextCursor: z.string().optional(), previousCursor: z.string().optional() }).optional() });

export type ExerciseDbExercise = z.infer<typeof exerciseSchema>;
export type ExerciseDbSearchResult = { candidates: ExerciseDbExercise[]; nextCursor: string | null; total: number | null };

export function getExerciseDbConfig(environment: Record<string, string | undefined> = process.env) {
  const key = environment.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY is required for ExerciseDB developer commands.");
  const host = environment.RAPIDAPI_HOST || defaultExerciseDbHost;
  if (!/^[a-z0-9.-]+$/i.test(host)) throw new Error("RAPIDAPI_HOST is invalid.");
  return { key, host };
}

async function request(pathname: string, fetcher: typeof fetch, environment?: Record<string, string | undefined>) {
  const { key, host } = getExerciseDbConfig(environment);
  const response = await fetcher(`https://${host}/api/v1${pathname}`, { headers: { Accept: "application/json", "x-rapidapi-host": host, "x-rapidapi-key": key } });
  if (!response.ok) throw new Error(`ExerciseDB request failed (${response.status}).`);
  const parsed = responseSchema.safeParse(await response.json() as unknown);
  if (!parsed.success) throw new Error("ExerciseDB returned an unexpected response structure.");
  return parsed.data;
}

export async function searchExerciseDb(query: string, options: { after?: string; limit?: number } = {}, fetcher: typeof fetch = fetch, environment?: Record<string, string | undefined>): Promise<ExerciseDbSearchResult> {
  if (!query.trim()) throw new Error("Provide an exercise search term.");
  const params = new URLSearchParams({ name: query.trim(), limit: String(Math.min(Math.max(options.limit ?? 10, 1), 25)) });
  if (options.after) params.set("after", options.after);
  const result = await request(`/exercises?${params.toString()}`, fetcher, environment);
  if (!Array.isArray(result.data)) throw new Error("ExerciseDB search returned an invalid data shape.");
  return { candidates: result.data, nextCursor: result.meta?.nextCursor ?? null, total: result.meta?.total ?? null };
}

export async function getExerciseDbExercise(externalExerciseId: string, fetcher: typeof fetch = fetch, environment?: Record<string, string | undefined>): Promise<ExerciseDbExercise> {
  if (!externalExerciseId.trim()) throw new Error("Provide an ExerciseDB exercise ID.");
  const result = await request(`/exercises/${encodeURIComponent(externalExerciseId)}`, fetcher, environment);
  if (Array.isArray(result.data)) throw new Error("ExerciseDB exercise detail returned an invalid data shape.");
  return result.data;
}

export function preferredExerciseDbImage(exercise: ExerciseDbExercise): string | null {
  return exercise.imageUrls?.["1080p"] ?? exercise.imageUrls?.["720p"] ?? exercise.imageUrls?.["480p"] ?? exercise.imageUrls?.["360p"] ?? exercise.imageUrl ?? null;
}
