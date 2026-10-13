// Deterministic scoring and ranking. Pure functions — no model calls.

export const RUBRIC_WEIGHTS = {
  shared_interests: 0.3,
  values_alignment: 0.25,
  conversation_quality: 0.2,
  lifestyle_compatibility: 0.15,
  stated_preferences_fit: 0.1,
} as const;

export type RubricKey = keyof typeof RUBRIC_WEIGHTS;
/** Each criterion 0–5, or null when evidence is insufficient. */
export type Rubric = Record<RubricKey, number | null>;
export type Confidence = "low" | "medium" | "high";

/**
 * Score 0–100 from the rubric. Returns null (no score) when confidence is low
 * or fewer than 3 criteria have evidence; absent data is never treated as negative.
 */
export function computeScore(rubric: Rubric, confidence: Confidence): number | null {
  if (confidence === "low") return null;
  let weighted = 0;
  let weightSum = 0;
  let rated = 0;
  for (const key of Object.keys(RUBRIC_WEIGHTS) as RubricKey[]) {
    const v = rubric[key];
    if (v === null || v === undefined || Number.isNaN(v)) continue;
    const clamped = Math.max(0, Math.min(5, v));
    weighted += (clamped / 5) * RUBRIC_WEIGHTS[key];
    weightSum += RUBRIC_WEIGHTS[key];
    rated++;
  }
  if (rated < 3 || weightSum === 0) return null;
  return Math.round((weighted / weightSum) * 100);
}

export interface RankInput {
  candidate_id: string;
  score: number | null;
  confidence: Confidence;
}

const CONF_ORDER: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };

/** Directional ranking: scored first (desc), then by confidence, then by id for stability. */
export function rankCandidates<T extends RankInput>(rows: T[]): (T & { rank: number | null })[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.score === null && b.score !== null) return 1;
    if (b.score === null && a.score !== null) return -1;
    if (a.score !== null && b.score !== null && a.score !== b.score) return b.score - a.score;
    if (CONF_ORDER[a.confidence] !== CONF_ORDER[b.confidence]) return CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence];
    return a.candidate_id.localeCompare(b.candidate_id);
  });
  let r = 0;
  return sorted.map((row) => ({ ...row, rank: row.score === null ? null : ++r }));
}

export function validateLinkedInUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)linkedin\.com$/.test(u.hostname)) return "Must be a linkedin.com URL";
    if (!/^\/in\/[^/]+\/?$/.test(u.pathname)) return "Use a personal profile URL like https://www.linkedin.com/in/your-name";
    return null;
  } catch {
    return "Not a valid URL";
  }
}

export function validateInstagramUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return "Must be an instagram.com URL";
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length !== 1 || ["p", "reel", "explore", "stories"].includes(parts[0]!))
      return "Use a profile URL like https://www.instagram.com/username";
    return null;
  } catch {
    return "Not a valid URL";
  }
}

export type Coverage = "full" | "partial" | "missing";

/**
 * Match-specific evidence coverage: describes the pair, not the evaluator.
 * Full only when both sides' profiles were built from both sources.
 */
export function matchCoverage(evaluator: Coverage | null | undefined, candidate: Coverage | null | undefined): Coverage {
  if (!evaluator || !candidate) return "missing";
  return evaluator === "full" && candidate === "full" ? "full" : "partial";
}

export const COVERAGE_LABEL: Record<Coverage, string> = {
  full: "Full match", // both profiles built from 2 of 2 sources
  partial: "Partial match", // at least one profile built from 1 of 2 sources
  missing: "No match",
};

/** Which rubric criteria were rated vs unknown, for display. */
export function rubricSummary(rubric: Partial<Record<RubricKey, number | null>> | null | undefined) {
  const rated: RubricKey[] = [];
  const unknown: RubricKey[] = [];
  for (const k of Object.keys(RUBRIC_WEIGHTS) as RubricKey[]) {
    const v = rubric?.[k];
    if (v === null || v === undefined || Number.isNaN(v)) unknown.push(k);
    else rated.push(k);
  }
  return { rated, unknown };
}

/** Why a row has no score (null when it has one). Mirrors computeScore's rules. */
export function noScoreReason(rubric: Partial<Record<RubricKey, number | null>> | null | undefined, confidence: Confidence): string | null {
  if (confidence === "low") return "No score: the evaluator's confidence was low.";
  if (rubricSummary(rubric).rated.length < 3) return "No score: fewer than 3 of 5 criteria had enough evidence.";
  return null;
}

export const SCORE_DISCLAIMER = "Exploratory comparison from available public evidence and one agent conversation — not a prediction of romantic success.";
