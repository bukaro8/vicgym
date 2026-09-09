import { describe, expect, it } from "vitest";

import { emailIsAllowed, parseServerEnv } from "@/lib/env";

const required = { DATABASE_URL: "postgresql://localhost/vicgym", APP_ORIGIN: "http://localhost:3000", RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "VicGym <login@example.com>" };

describe("parseServerEnv", () => {
  it("applies safe non-secret defaults", () => {
    expect(parseServerEnv(required)).toMatchObject({
      APP_TIMEZONE: "Europe/London",
      NODE_ENV: "development",
    });
  });

  it("rejects a missing database URL", () => {
    expect(() => parseServerEnv({})).toThrow("DATABASE_URL");
  });

  it("supports an optional normalized email allowlist", () => {
    expect(emailIsAllowed(" Victor@Example.com ", "other@example.com, victor@example.com")).toBe(true);
    expect(emailIsAllowed("unknown@example.com", "victor@example.com")).toBe(false);
    expect(emailIsAllowed("anyone@example.com", "")).toBe(true);
  });

  it("accepts an optional administrator bootstrap email and rejects malformed values", () => {
    expect(parseServerEnv({ ...required, ADMIN_EMAIL: "admin@example.com" }).ADMIN_EMAIL).toBe("admin@example.com");
    expect(parseServerEnv({ ...required, ADMIN_EMAIL: "" }).ADMIN_EMAIL).toBe("");
    expect(() => parseServerEnv({ ...required, ADMIN_EMAIL: "not-an-email" })).toThrow("ADMIN_EMAIL");
  });
});
