import { describe, expect, it } from "vitest";

import { londonWeekRange } from "@/server/weekly-review";

describe("Europe/London weekly boundaries", () => {
  it("defaults to the most recently completed week", () => {
    const range = londonWeekRange(undefined, new Date("2026-09-07T12:00:00.000Z"));
    expect(range.startDate).toBe("2026-08-31");
    expect(range.endDate).toBe("2026-09-07");
    expect(range.start.toISOString()).toBe("2026-08-30T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-06T23:00:00.000Z");
  });

  it("does not default to an incomplete Sunday week", () => {
    const range = londonWeekRange(undefined, new Date("2026-03-29T12:00:00.000Z"));
    expect(range.startDate).toBe("2026-03-16");
    expect(range.endDate).toBe("2026-03-23");
  });

  it("uses London midnight across the BST transition", () => {
    const range = londonWeekRange("2026-03-23");
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
