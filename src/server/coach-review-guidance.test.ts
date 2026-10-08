import { describe, expect, it } from "vitest";
import { coachReviewGuidance as prompt } from "./coach-review-guidance";

describe("external trainer review contract", () => {
  it("links repeated Easy sets to completed targets and confirmed load increments", () => {
    expect(prompt).toContain("Easy / Easy / Easy with every planned set and target rep completed");
    expect(prompt).toContain("especially when repeated across sessions");
    expect(prompt).toContain("if the next load is unknown, ask rather than inventing it");
  });
  it("requires fatigue and performance evidence for rest changes", () => {
    expect(prompt).toContain("Easy / Moderate / Hard");
    expect(prompt).toContain("If later-set reps or load also deteriorate");
    expect(prompt).toContain("Do not increase rest merely because the last set is Hard");
    expect(prompt).toContain("Moderate / Moderate / Moderate generally means maintain");
    expect(prompt).toContain("Moderate / Hard / Hard normally means hold load");
  });
  it("prevents Hard-set progression and treating missing effort as Easy", () => {
    expect(prompt).toContain("Hard / Hard / Hard or repeated missed target reps means do not increase load");
    expect(prompt).toContain("Missing effort is unknown, not Easy");
  });
  it("limits substitutions to catalogue entries with matching muscles and useful reasons", () => {
    expect(prompt).toContain("same primary muscle, preferably a similar movement pattern");
    expect(prompt).toContain("Use only currently available catalogue entries and exact slugs");
    expect(prompt).toContain("replace one progressing well without a useful reason");
    expect(prompt).toContain("A substitution is a remove for the old exercise plus an upsert");
  });
  it("protects stability across frequent versions", () => {
    expect(prompt).toContain("80–90% or more");
    expect(prompt).toContain("at most one substitution per day");
    expect(prompt).toContain("A new version is not a reason to change exercises");
    expect(prompt).toContain("completed exposure counts, not version numbers alone");
    expect(prompt).toContain("If evidence is insufficient, maintain and return changes: []");
  });
});
