import { describe, expect, it } from "vitest";

import { parseServerEnv } from "@/lib/env";

describe("parseServerEnv", () => {
  it("applies safe non-secret defaults", () => {
    expect(parseServerEnv({ DATABASE_URL: "postgresql://localhost/vicgym" })).toMatchObject({
      APP_TIMEZONE: "Europe/London",
      NODE_ENV: "development",
    });
  });

  it("rejects a missing database URL", () => {
    expect(() => parseServerEnv({})).toThrow("DATABASE_URL");
  });
});
