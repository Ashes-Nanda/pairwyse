// Idempotent profile-analysis orchestration. Pure with injected store/model so it is unit-testable.

export type SourceInput = { source: string; normalized: unknown };

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** SHA-256 over the sorted usable sources. Same inputs → same hash (Web Crypto: works in Workers and Node). */
export async function hashInputs(sources: SourceInput[]): Promise<string> {
  const sorted = [...sources].sort((a, b) => a.source.localeCompare(b.source));
  const bytes = new TextEncoder().encode(stable(sorted));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const ANALYZABLE = ["ingested", "partial", "analysis_failed", "profiled"] as const;
/** An "analyzing" claim older than this is treated as abandoned (crashed worker) and may be re-claimed. */
export const STALE_CLAIM_MS = 3 * 60 * 1000;

export interface AnalysisStore {
  usableSources(id: string): Promise<SourceInput[]>;
  existingHash(id: string): Promise<string | null | undefined>; // undefined = no profile; null = legacy profile
  /** Atomically move status → analyzing. Must succeed for at most one concurrent caller. */
  claim(id: string, staleBefore: Date): Promise<boolean>;
  save(id: string, profile: unknown, hash: string, coverage: "full" | "partial"): Promise<void>;
  fail(id: string, message: string): Promise<void>;
}

export type AnalysisResult =
  | { ok: true; outcome: "generated" | "reused" }
  | { ok: true; outcome: "in_progress" }
  | { ok: false; error: string };

export async function analyzeOnce<P>(
  id: string,
  store: AnalysisStore,
  generate: (sources: SourceInput[]) => Promise<P>,
  opts: { force?: boolean; now?: Date } = {},
): Promise<AnalysisResult> {
  const sources = await store.usableSources(id);
  if (!sources.length) return { ok: false, error: "No successfully retrieved source data to analyse." };
  const hash = await hashInputs(sources);
  const prev = await store.existingHash(id);
  if (!opts.force && prev === hash) return { ok: true, outcome: "reused" };
  const now = opts.now ?? new Date();
  if (!(await store.claim(id, new Date(now.getTime() - STALE_CLAIM_MS)))) return { ok: true, outcome: "in_progress" };
  try {
    const profile = await generate(sources);
    await store.save(id, profile, hash, sources.length >= 2 ? "full" : "partial");
    return { ok: true, outcome: "generated" };
  } catch (e) {
    const msg = (e as Error).message;
    await store.fail(id, msg); // status → analysis_failed: retryable, previous profile row untouched
    return { ok: false, error: msg };
  }
}
