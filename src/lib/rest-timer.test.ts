import { describe, expect, it } from "vitest";

import { adjustedRemainingMilliseconds, formatTimer, remainingMilliseconds } from "@/lib/rest-timer";

describe("timestamp rest timer calculations", () => {
  it("derives remaining time from endsAt rather than stored countdown state", () => {
    expect(remainingMilliseconds(new Date(12_500), 2_000)).toBe(10_500);
    expect(remainingMilliseconds(new Date(1_000), 2_000)).toBe(0);
  });

  it("adjusts by 15 seconds and floors at zero", () => {
    expect(adjustedRemainingMilliseconds(20_250, 15)).toBe(35_250);
    expect(adjustedRemainingMilliseconds(10_250, -15)).toBe(0);
  });

  it("formats partial seconds conservatively", () => {
    expect(formatTimer(60_001)).toBe("1:01");
    expect(formatTimer(0)).toBe("0:00");
  });
});
