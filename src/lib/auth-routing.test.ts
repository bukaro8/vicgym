import { describe, expect, it } from "vitest";

import { authenticatedHomePath } from "@/lib/auth-routing";

describe("role-aware authenticated routing", () => {
  it("sends administrators to requests and keeps users on the normal app", () => {
    expect(authenticatedHomePath("ADMIN")).toBe("/admin/requests");
    expect(authenticatedHomePath("USER")).toBe("/");
  });
});
