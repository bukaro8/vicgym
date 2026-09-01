import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_TIMEZONE: z.string().min(1).default("Europe/London"),
  RAPIDAPI_KEY: z.string().min(1).optional(),
  RAPIDAPI_HOST: z.string().regex(/^[a-z0-9.-]+$/i, "RAPIDAPI_HOST is invalid").default("edb-with-videos-and-images-by-ascendapi.p.rapidapi.com"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function parseServerEnv(input: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(input);

  if (!result.success) {
    const fields = Object.keys(z.flattenError(result.error).fieldErrors).join(", ");
    throw new Error(`Invalid server environment: ${fields || "unknown error"}`);
  }

  return result.data;
}

export function getServerEnv(): ServerEnv {
  cachedEnv ??= parseServerEnv(process.env);
  return cachedEnv;
}
