import { describe, expect, it } from "vitest";
import { computeScore, rankCandidates, validateInstagramUrl, validateLinkedInUrl } from "./ranking";

describe("computeScore", () => {
  const full = { shared_interests: 5, values_alignment: 4, conversation_quality: 3, lifestyle_compatibility: 2, stated_preferences_fit: 1 };
  it("weights rubric deterministically", () => {
    expect(computeScore(full, "high")).toBe(computeScore(full, "high"));
    expect(computeScore(full, "medium")).toBe(74);
  });
  it("returns null for low confidence", () => {
    expect(computeScore(full, "low")).toBeNull();
  });
  it("ignores unknown criteria instead of penalising", () => {
    const partial = { ...full, lifestyle_compatibility: null, stated_preferences_fit: null };
    expect(computeScore(partial, "high")).toBe(Math.round(((1 * 0.3 + 0.8 * 0.25 + 0.6 * 0.2) / 0.75) * 100));
  });
  it("needs at least three rated criteria", () => {
    expect(computeScore({ shared_interests: 5, values_alignment: 5, conversation_quality: null, lifestyle_compatibility: null, stated_preferences_fit: null }, "high")).toBeNull();
  });
});

describe("rankCandidates", () => {
  it("orders scored before unscored and breaks ties stably", () => {
    const out = rankCandidates([
      { candidate_id: "c", score: null, confidence: "low" as const },
      { candidate_id: "b", score: 70, confidence: "medium" as const },
      { candidate_id: "a", score: 70, confidence: "medium" as const },
      { candidate_id: "d", score: 90, confidence: "high" as const },
    ]);
    expect(out.map((r) => r.candidate_id)).toEqual(["d", "a", "b", "c"]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3, null]);
  });
});

describe("url validation", () => {
  it("accepts profile urls", () => {
    expect(validateLinkedInUrl("https://www.linkedin.com/in/jane-doe/")).toBeNull();
    expect(validateInstagramUrl("https://www.instagram.com/jane")).toBeNull();
  });
  it("rejects non-profile urls", () => {
    expect(validateLinkedInUrl("https://www.linkedin.com/company/x")).not.toBeNull();
    expect(validateInstagramUrl("https://www.instagram.com/p/abc")).not.toBeNull();
    expect(validateInstagramUrl("https://example.com/jane")).not.toBeNull();
  });
});
