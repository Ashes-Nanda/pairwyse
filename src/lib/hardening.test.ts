import { describe, expect, it, vi } from "vitest";
import { analyzeOnce, hashInputs, type AnalysisStore } from "./analysis";
import { COVERAGE_LABEL, computeScore, matchCoverage, noScoreReason, rubricSummary } from "./ranking";
import { buildDatingInstructions, composeTurn, hasUnsupportedFact, isDefensive } from "./prompts";
import { buildEvidenceIndex, readCriteriaEvidence, validateCriteria } from "./evidence";

// In-memory store that mimics the conditional UPDATE used in production (atomic compare-and-set on status).
function memStore(init: { status: string; hash?: string | null; sources?: { source: string; normalized: unknown }[] }) {
  const st = { status: init.status, updatedAt: new Date(), hash: init.hash, writes: 0, profile: undefined as unknown };
  const store: AnalysisStore = {
    usableSources: async () => init.sources ?? [{ source: "linkedin", normalized: { a: 1 } }, { source: "instagram", normalized: { b: 2 } }],
    existingHash: async () => st.hash,
    claim: async (_id, staleBefore) => {
      if (["ingested", "partial", "analysis_failed", "profiled"].includes(st.status) || (st.status === "analyzing" && st.updatedAt < staleBefore)) {
        st.status = "analyzing"; st.updatedAt = new Date(); return true;
      }
      return false;
    },
    save: async (_id, p, h) => { st.writes++; st.profile = p; st.hash = h; st.status = "profiled"; },
    fail: async () => { st.status = "analysis_failed"; },
  };
  return { st, store };
}

describe("profile analysis idempotency", () => {
  it("hash is stable regardless of key/source order", async () => {
    const a = await hashInputs([{ source: "linkedin", normalized: { x: 1, y: 2 } }, { source: "instagram", normalized: {} }]);
    const b = await hashInputs([{ source: "instagram", normalized: {} }, { source: "linkedin", normalized: { y: 2, x: 1 } }]);
    expect(a).toBe(b);
  });
  it("concurrent duplicate triggers make exactly one model call and one write", async () => {
    const { st, store } = memStore({ status: "ingested" });
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const gen = vi.fn(async () => { await gate; return { summary: "s" }; });
    const p1 = analyzeOnce("x", store, gen);
    const p2 = analyzeOnce("x", store, gen);
    const p3 = analyzeOnce("x", store, gen);
    await new Promise((r) => setTimeout(r, 0));
    release();
    const res = await Promise.all([p1, p2, p3]);
    expect(gen).toHaveBeenCalledTimes(1);
    expect(st.writes).toBe(1);
    expect(res.filter((r) => r.ok && r.outcome === "generated")).toHaveLength(1);
    expect(res.every((r) => r.ok && ["generated", "in_progress", "reused"].includes(r.outcome))).toBe(true);
  });
  it("sequential re-trigger with unchanged inputs reuses the saved analysis (the original duplicate bug)", async () => {
    const { st, store } = memStore({ status: "ingested" });
    const gen = vi.fn(async () => ({ summary: "s" }));
    await analyzeOnce("x", store, gen);
    st.status = "ingested"; // stale client view re-fires
    const r = await analyzeOnce("x", store, gen);
    expect(r).toEqual({ ok: true, outcome: "reused" });
    expect(gen).toHaveBeenCalledTimes(1);
  });
  it("changed inputs are detected as stale and regenerate", async () => {
    const { st, store } = memStore({ status: "profiled", hash: "old-hash" });
    const gen = vi.fn(async () => ({ summary: "new" }));
    const r = await analyzeOnce("x", store, gen);
    expect(r).toEqual({ ok: true, outcome: "generated" });
    expect(st.hash).not.toBe("old-hash");
  });
  it("legacy profile (null hash) is regenerated only when asked", async () => {
    const { store } = memStore({ status: "profiled", hash: null });
    const gen = vi.fn(async () => ({}));
    await analyzeOnce("x", store, gen);
    expect(gen).toHaveBeenCalledTimes(1); // null !== current hash → treated as stale
  });
  it("failure is retryable and writes no profile", async () => {
    const { st, store } = memStore({ status: "ingested" });
    const bad = vi.fn(async () => { throw new Error("AI request failed (500)"); });
    const r1 = await analyzeOnce("x", store, bad);
    expect(r1.ok).toBe(false);
    expect(st.status).toBe("analysis_failed");
    expect(st.writes).toBe(0);
    const r2 = await analyzeOnce("x", store, vi.fn(async () => ({})));
    expect(r2).toEqual({ ok: true, outcome: "generated" });
    expect(st.writes).toBe(1);
  });
  it("abandoned 'analyzing' claim can be re-claimed after the timeout, not before", async () => {
    const { st, store } = memStore({ status: "analyzing", hash: undefined });
    st.updatedAt = new Date();
    expect((await analyzeOnce("x", store, vi.fn(async () => ({})))).ok && "in_progress").toBeTruthy();
    expect(st.writes).toBe(0);
    st.updatedAt = new Date(Date.now() - 10 * 60 * 1000);
    await analyzeOnce("x", store, vi.fn(async () => ({})));
    expect(st.writes).toBe(1);
  });
});

describe("match coverage and score communication", () => {
  it("coverage describes the pair, not the evaluator", () => {
    expect(matchCoverage("full", "partial")).toBe("partial");
    expect(matchCoverage("partial", "full")).toBe("partial");
    expect(matchCoverage("full", "full")).toBe("full");
    expect(matchCoverage("full", null)).toBe("missing");
    expect(COVERAGE_LABEL[matchCoverage("full", "partial")]).toMatch(/partial/i);
  });
  it("reports rated and unknown criteria", () => {
    const r = { shared_interests: 4, values_alignment: null, conversation_quality: 3, lifestyle_compatibility: null, stated_preferences_fit: 0 };
    expect(rubricSummary(r)).toEqual({ rated: ["shared_interests", "conversation_quality", "stated_preferences_fit"], unknown: ["values_alignment", "lifestyle_compatibility"] });
  });
  it("low confidence → no score with reason", () => {
    const r = { shared_interests: 5, values_alignment: 5, conversation_quality: 5, lifestyle_compatibility: 5, stated_preferences_fit: 5 };
    expect(computeScore(r, "low")).toBeNull();
    expect(noScoreReason(r, "low")).toMatch(/confidence/);
  });
  it("insufficient evidence → no score with reason", () => {
    const r = { shared_interests: 5, values_alignment: null, conversation_quality: 4, lifestyle_compatibility: null, stated_preferences_fit: null };
    expect(computeScore(r, "high")).toBeNull();
    expect(noScoreReason(r, "high")).toMatch(/fewer than 3/);
  });
  it("scored rows have no no-score reason; 0 is a rating, not unknown", () => {
    const r = { shared_interests: 0, values_alignment: 0, conversation_quality: 0, lifestyle_compatibility: null, stated_preferences_fit: null };
    expect(computeScore(r, "medium")).toBe(0);
    expect(noScoreReason(r, "medium")).toBeNull();
  });
});

describe("regression: persisted run b49dfa28 (values copied read-only)", () => {
  it("stored scores reproduce from stored rubrics", () => {
    expect(computeScore({"shared_interests": 4, "values_alignment": 4, "conversation_quality": 3, "stated_preferences_fit": null, "lifestyle_compatibility": 3}, "medium")).toBe(72);
    expect(computeScore({"shared_interests": 4, "values_alignment": 3.5, "conversation_quality": 3, "stated_preferences_fit": null, "lifestyle_compatibility": null}, "medium")).toBe(71);
  });
});

describe("dating prompt and reply checks", () => {
  const ctx = { me: "A", them: "B", profileJson: '{"interests":[]}', turn: 0, turnsPlanned: 8 };
  it("prompt forbids unsupported facts and formulaic disclaimers, asks open questions", () => {
    const p = buildDatingInstructions(ctx);
    expect(p).toMatch(/Never state or guess age, relationship status, dating preferences, attraction/);
    expect(p).toMatch(/open-ended question/);
    expect(p).toMatch(/Avoid phrases like "my profile doesn't establish/);
    expect(p).not.toMatch(/say you're not sure \/ it isn't in your profile/); // old instruction that caused the defensive tone
  });
  it("closing turns don't manufacture a romantic outcome", () => {
    expect(buildDatingInstructions({ ...ctx, turn: 7 })).toMatch(/without promising or implying a romantic outcome/);
  });
  it("detects defensive phrasing", () => {
    expect(isDefensive("My profile doesn't establish whether I like hiking, but…")).toBe(true);
    expect(isDefensive("That's not in my profile.")).toBe(true);
    expect(isDefensive("I love slow mornings in Gokarna — what's a place that makes you slow down?")).toBe(false);
  });
  it("detects unsupported personal facts", () => {
    expect(hasUnsupportedFact("I'm 27 and I'm single.")).toBe(true);
    expect(hasUnsupportedFact("My type is someone adventurous.")).toBe(true);
    expect(hasUnsupportedFact("I've been exploring Bangalore's food scene lately.")).toBe(false);
  });
  it("regenerates once on a defensive reply and keeps the clean version", async () => {
    const gen = vi.fn()
      .mockResolvedValueOnce("My profile doesn't establish that. What do you enjoy?")
      .mockResolvedValueOnce("I've been loving beach trips lately — what's your favourite escape?");
    const r = await composeTurn(gen, "i", [], (c) => c, (c) => c);
    expect(gen).toHaveBeenCalledTimes(2);
    expect(r.text).toMatch(/beach trips/);
    expect(r.flags).toEqual([]);
  });
  it("clean reply → single model call", async () => {
    const gen = vi.fn().mockResolvedValue("What got you into photography?");
    await composeTurn(gen, "i", [], (c) => c, (c) => c);
    expect(gen).toHaveBeenCalledTimes(1);
  });
  it("never more than two calls even if both are flagged", async () => {
    const gen = vi.fn().mockResolvedValue("I'm single.");
    const r = await composeTurn(gen, "i", [], (c) => c, (c) => c);
    expect(gen).toHaveBeenCalledTimes(2);
    expect(r.flags).toContain("unsupported_fact");
  });
});

describe("evaluation evidence", () => {
  const ev = { interests: [{ claim: "Enjoys travel" }] };
  const ca = { hobbies: [{ claim: "Food exploration" }] };
  const msgs = [{ turn: 0, content: "Hi" }, { turn: 1, content: "Hello" }];
  const idx = buildEvidenceIndex(ev, ca, msgs);
  const crit = (refs: string[]) => ({ score: 4, reason: "r", evidence_refs: refs });
  it("keeps valid refs and drops fabricated ones", () => {
    const out = validateCriteria({
      shared_interests: crit(["E.interests.0", "C.hobbies.0", "M1", "C.hobbies.9", "M42"]),
      values_alignment: { score: null, reason: "no evidence", evidence_refs: [] },
      conversation_quality: crit(["M0"]),
      lifestyle_compatibility: crit([]),
      stated_preferences_fit: { score: 9, reason: "clamped", evidence_refs: [] },
    }, idx);
    expect(out.shared_interests.refs.map((r) => r.ref)).toEqual(["E.interests.0", "C.hobbies.0", "M1"]);
    expect(out.shared_interests.dropped_refs).toEqual(["C.hobbies.9", "M42"]);
    expect(out.values_alignment.score).toBeNull();
    expect(out.stated_preferences_fit.score).toBe(5);
  });
  it("legacy evaluations without evidence read as null (displayed as not recorded)", () => {
    expect(readCriteriaEvidence(null)).toBeNull();
    expect(readCriteriaEvidence(undefined)).toBeNull();
  });
});
