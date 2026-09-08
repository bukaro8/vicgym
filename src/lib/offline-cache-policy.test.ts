import { describe, expect, it } from "vitest";

import { isAccountNeutralOfflinePath, isSafePreparedAsset } from "@/lib/offline-cache-policy";

describe("multi-user offline cache policy", () => {
  it("allows only account-neutral offline route shells", () => {
    expect(isAccountNeutralOfflinePath("/offline")).toBe(true);
    expect(isAccountNeutralOfflinePath("/offline/workout/session/exercise")).toBe(true);
    expect(isAccountNeutralOfflinePath("/workouts/private-session")).toBe(false);
    expect(isAccountNeutralOfflinePath("/progress")).toBe(false);
  });

  it("never prepares authenticated pages in the shared service-worker cache", () => {
    expect(isSafePreparedAsset("/media/exercises/push-up/image.webp")).toBe(true);
    expect(isSafePreparedAsset("/offline/summary/session-id")).toBe(true);
    expect(isSafePreparedAsset("/workouts/session-id/exercises/exercise-id")).toBe(false);
    expect(isSafePreparedAsset("/programme")).toBe(false);
  });
});
