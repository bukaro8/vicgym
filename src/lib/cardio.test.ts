import { describe, expect, it } from "vitest";

import { cardioDurationSeconds, cardioElapsedSeconds, formatCardioDuration } from "@/lib/cardio";

describe("cardio timing", () => {
  it("derives elapsed time from timestamps", () => {
    expect(cardioDurationSeconds("2026-09-05T09:00:00.000Z", "2026-09-05T09:12:34.900Z")).toBe(754);
    expect(cardioElapsedSeconds({ startedAt: "2026-09-05T09:00:00.000Z", stoppedAt: null }, new Date("2026-09-05T09:01:05.000Z").getTime())).toBe(65);
  });

  it("formats short and long cardio durations", () => {
    expect(formatCardioDuration(754)).toBe("12:34");
    expect(formatCardioDuration(3_661)).toBe("1:01:01");
  });
});
