import { describe, expect, it } from "vitest";

import { londonWeekRange } from "@/server/weekly-review";

describe("Europe/London weekly boundaries", () => {
  it("uses Monday to Monday across the BST transition", () => {
    const range = londonWeekRange(undefined, new Date("2026-03-29T12:00:00.000Z"));
    expect(range.startDate).toBe("2026-03-23");
    expect(range.endDate).toBe("2026-03-30");
    expect(range.start.toISOString()).toBe("2026-03-23T00:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-03-29T23:00:00.000Z");
  });

  it("keeps an explicit Monday week stable", () => {
    const range = londonWeekRange("2026-08-24");
    expect(range.startDate).toBe("2026-08-24");
    expect(range.endDate).toBe("2026-08-31");
  });

  it("rejects a week selector value that is not Monday", () => {
    expect(() => londonWeekRange("2026-08-30")).toThrow("INVALID_WEEK");
  });
});
