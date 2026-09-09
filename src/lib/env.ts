import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_ORIGIN: z.string().url("APP_ORIGIN must be an absolute URL").refine((value) => {
    const url = new URL(value);
    return url.pathname === "/" && !url.search && !url.hash;
  }, "APP_ORIGIN must not include a path, query, or fragment").optional(),
  APP_TIMEZONE: z.string().min(1).default("Europe/London"),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(3).optional(),
  AUTH_ALLOWED_EMAILS: z.string().optional(),
  ADMIN_EMAIL: z.union([z.string().trim().email("ADMIN_EMAIL must be a valid email address"), z.literal("")]).optional(),
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

export function emailIsAllowed(email: string, value = getServerEnv().AUTH_ALLOWED_EMAILS): boolean {
  if (!value?.trim()) return true;
  const normalized = email.trim().toLowerCase();
  return value.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean).includes(normalized);
}

export function getAuthEmailEnv(): ServerEnv & { APP_ORIGIN: string; RESEND_API_KEY: string; RESEND_FROM_EMAIL: string } {
  const env = getServerEnv();
  if (!env.APP_ORIGIN || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("APP_ORIGIN, RESEND_API_KEY and RESEND_FROM_EMAIL are required for magic-link login");
  }
  return env as ServerEnv & { APP_ORIGIN: string; RESEND_API_KEY: string; RESEND_FROM_EMAIL: string };
}
