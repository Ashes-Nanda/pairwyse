// Evaluation evidence references. Refs must point to existing profile claims or conversation messages.
import { RUBRIC_WEIGHTS, type RubricKey } from "./ranking";

const CATS = ["interests", "hobbies", "values", "professional", "stated_preferences"] as const;
type Claim = { claim: string; quote?: string; source?: string };
type ProfileData = Partial<Record<(typeof CATS)[number], Claim[]>> | null | undefined;

export type EvidenceIndex = Map<string, { kind: "profile_claim" | "message"; label: string }>;

/** Builds the set of citable refs: E.<cat>.<i> (evaluator claim), C.<cat>.<i> (candidate claim), M<turn> (message). */
export function buildEvidenceIndex(evaluator: ProfileData, candidate: ProfileData, messages: { turn: number; content: string }[]): EvidenceIndex {
  const idx: EvidenceIndex = new Map();
  for (const [prefix, p] of [["E", evaluator], ["C", candidate]] as const) {
    for (const cat of CATS) (p?.[cat] ?? []).forEach((c, i) => idx.set(`${prefix}.${cat}.${i}`, { kind: "profile_claim", label: c.claim }));
  }
  for (const m of messages) idx.set(`M${m.turn}`, { kind: "message", label: m.content.slice(0, 120) });
  return idx;
}

export function describeIndex(idx: EvidenceIndex): string {
  return [...idx.entries()].map(([k, v]) => `${k}: ${v.label}`).join("\n");
}

export type RawCriterion = { score: number | null; reason: string; evidence_refs: string[] };
export type CriterionEvidence = { score: number | null; reason: string; refs: { ref: string; kind: string; label: string }[]; dropped_refs: string[] };
export type CriteriaEvidence = Record<RubricKey, CriterionEvidence>;

/** Keeps only refs that exist in the index; reports dropped ones instead of silently trusting the model. */
export function validateCriteria(raw: Record<RubricKey, RawCriterion>, idx: EvidenceIndex): CriteriaEvidence {
  const out = {} as CriteriaEvidence;
  for (const key of Object.keys(RUBRIC_WEIGHTS) as RubricKey[]) {
    const r = raw[key];
    const refs: CriterionEvidence["refs"] = [];
    const dropped: string[] = [];
    for (const ref of new Set(r?.evidence_refs ?? [])) {
      const hit = idx.get(ref);
      if (hit) refs.push({ ref, kind: hit.kind, label: hit.label });
      else dropped.push(ref);
    }
    const score = r?.score === null || r?.score === undefined ? null : Math.max(0, Math.min(5, r.score));
    out[key] = { score, reason: r?.reason ?? "", refs, dropped_refs: dropped };
  }
  return out;
}

/** Legacy evaluations (criteria_evidence NULL) are displayed as "not recorded", never back-filled. */
export function readCriteriaEvidence(v: unknown): CriteriaEvidence | null {
  if (!v || typeof v !== "object") return null;
  return v as CriteriaEvidence;
}
