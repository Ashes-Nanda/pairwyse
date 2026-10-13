import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { computeScore, matchCoverage, rankCandidates, validateInstagramUrl, validateLinkedInUrl, type Coverage, type Rubric } from "./ranking";

function requirePasscode(passcode: string | undefined) {
  const expected = process.env["INTAKE_PASSCODE"];
  if (!expected) throw new Error("Processing is disabled: INTAKE_PASSCODE is not configured on the server.");
  if (!passcode || passcode !== expected) throw new Error("Incorrect passcode.");
}

const withPass = <T extends z.ZodRawShape>(shape: T) => z.object({ ...shape, passcode: z.string().max(200) });
const idPass = withPass({ id: z.string().uuid() });

export const checkPasscode = createServerFn({ method: "POST" })
  .inputValidator((d: { passcode: string }) => z.object({ passcode: z.string().max(200) }).parse(d))
  .handler(async ({ data }) => {
    try { requirePasscode(data.passcode); return { ok: true as const }; } catch (e) { return { ok: false as const, error: (e as Error).message }; }
  });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const CONSENT_STATEMENT =
  "I am the person these profiles belong to (or have their explicit permission), I am 18 or older, and I consent to PAIRWISE retrieving my public LinkedIn and Instagram data through Apify, analysing it with AI, and having an AI agent hold simulated date conversations on my behalf, visible on this site.";

export const getConsentStatement = createServerFn({ method: "GET" }).handler(async () => CONSENT_STATEMENT);

// ---------- Reads ----------

export const listParticipants = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data, error } = await db
    .from("participants")
    .select("id, display_name, status, error, is_demo, created_at, profiles_analysis(coverage, summary)")
    .eq("consent_confirmed", true)
    .eq("is_test", false)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const [{ count: sessions }, { count: evals }] = await Promise.all([
    db.from("date_sessions").select("id, a:participants!date_sessions_participant_a_fkey!inner(is_test)", { count: "exact", head: true }).eq("status", "completed").eq("a.is_test", false),
    db.from("evaluations").select("id, e:participants!evaluations_evaluator_id_fkey!inner(is_test)", { count: "exact", head: true }).eq("e.is_test", false),
  ]);
  return { participants: data ?? [], completedSessions: sessions ?? 0, completedEvaluations: evals ?? 0 };
});

export const getParticipant = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: p, error } = await db
      .from("participants")
      .select("id, display_name, linkedin_url, instagram_url, status, error, is_demo, is_test, consent_at, created_at")
      .eq("id", data.id)
      .eq("consent_confirmed", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!p) return null;
    const [{ data: sources }, { data: profile }, { data: sessions }, { data: evals }, { data: others }] = await Promise.all([
      db.from("source_records").select("source, source_url, actor_id, actor_run_id, status, error, normalized, started_at, finished_at").eq("participant_id", data.id),
      db.from("profiles_analysis").select("summary, data, coverage, model, created_at, input_hash").eq("participant_id", data.id).maybeSingle(),
      db.from("date_sessions").select("id, participant_a, participant_b, status, error, created_at").or(`participant_a.eq.${data.id},participant_b.eq.${data.id}`),
      db.from("evaluations").select("session_id, candidate_id, score, confidence, explanation, shared_interests, conflicts, unknowns, rubric, criteria_evidence").eq("evaluator_id", data.id),
      db.from("participants").select("id, display_name, status, profiles_analysis(coverage)").eq("consent_confirmed", true).eq("is_test", p.is_test).neq("id", data.id),
    ]);
    const names = Object.fromEntries((others ?? []).map((o) => [o.id, o.display_name]));
    const covOf = Object.fromEntries((others ?? []).map((o) => [o.id, ((o as any).profiles_analysis?.coverage ?? null) as Coverage | null]));
    const ranking = rankCandidates(
      (evals ?? []).map((e) => ({ ...e, candidate_id: e.candidate_id, score: e.score === null ? null : Number(e.score), confidence: e.confidence as "low" | "medium" | "high", candidate_name: names[e.candidate_id] ?? "Unknown", match_coverage: matchCoverage((profile?.coverage ?? null) as Coverage | null, covOf[e.candidate_id]) })),
    );
    const datedIds = new Set((sessions ?? []).map((s) => (s.participant_a === data.id ? s.participant_b : s.participant_a)));
    const usable = (sources ?? []).filter((s) => s.status === "completed" && s.normalized).map((s) => ({ source: s.source, normalized: s.normalized }));
    const { hashInputs } = await import("./analysis");
    const currentHash = usable.length ? await hashInputs(usable) : null;
    const profileFreshness = !profile ? "none" : profile.input_hash === null ? "legacy" : profile.input_hash === currentHash ? "current" : "stale";
    return {
      profileFreshness,
      participant: p,
      sources: sources ?? [],
      profile,
      sessions: (sessions ?? []).map((s) => ({ ...s, partner_id: s.participant_a === data.id ? s.participant_b : s.participant_a, partner_name: names[s.participant_a === data.id ? s.participant_b : s.participant_a] ?? "Unknown" })),
      ranking,
      candidates: (others ?? []).filter((o) => o.status === "profiled" && !datedIds.has(o.id)),
      totalOthers: (others ?? []).length,
    };
  });

export const getSession = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: s } = await db.from("date_sessions").select("*").eq("id", data.id).maybeSingle();
    if (!s) return null;
    const [{ data: msgs }, { data: evals }, { data: people }] = await Promise.all([
      db.from("date_messages").select("turn, speaker_id, content, created_at").eq("session_id", data.id).order("turn"),
      db.from("evaluations").select("evaluator_id, candidate_id, score, confidence, explanation, shared_interests, conflicts, unknowns, rubric, criteria_evidence").eq("session_id", data.id),
      db.from("participants").select("id, display_name, is_demo").in("id", [s.participant_a, s.participant_b]),
    ]);
    return { session: s, messages: msgs ?? [], evaluations: evals ?? [], people: people ?? [] };
  });

// ---------- Intake ----------

const intakeSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  linkedin_url: z.string().trim().url().max(300),
  instagram_url: z.string().trim().url().max(300),
  consent: z.literal(true),
  adult: z.literal(true),
  passcode: z.string().max(200),
});

export const createParticipant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => intakeSchema.parse(d))
  .handler(async ({ data }) => {
    try { requirePasscode(data.passcode); } catch (e) { return { ok: false as const, error: (e as Error).message }; }
    const li = validateLinkedInUrl(data.linkedin_url);
    const ig = validateInstagramUrl(data.instagram_url);
    if (li || ig) return { ok: false as const, error: li ?? ig! };
    const db = await admin();
    const { data: row, error } = await db
      .from("participants")
      .insert({
        display_name: data.display_name,
        linkedin_url: data.linkedin_url,
        instagram_url: data.instagram_url,
        consent_confirmed: true,
        consent_statement: CONSENT_STATEMENT,
        consent_at: new Date().toISOString(),
        status: "ingesting",
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.code === "23505" ? "This LinkedIn profile is already registered." : error.message };
    return { ok: true as const, id: row.id };
  });

// ---------- Ingestion ----------

export const startIngestion = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; passcode: string }) => idPass.parse(d))
  .handler(async ({ data }) => {
    requirePasscode(data.passcode);
    const { startRun } = await import("./apify.server");
    const db = await admin();
    const { data: p } = await db.from("participants").select("*").eq("id", data.id).single();
    if (!p?.consent_confirmed) throw new Error("Consent not recorded; processing refused.");
    const { data: existing } = await db.from("source_records").select("source, status").eq("participant_id", data.id);
    for (const source of ["linkedin", "instagram"] as const) {
      const prev = existing?.find((e) => e.source === source);
      if (prev && prev.status !== "failed") continue;
      const url = source === "linkedin" ? p.linkedin_url : p.instagram_url;
      try {
        const run = await startRun(source, url);
        await db.from("source_records").upsert(
          { participant_id: data.id, source, source_url: url, actor_id: run.actorId, actor_run_id: run.runId, dataset_id: run.datasetId, status: "running", error: null, started_at: new Date().toISOString(), finished_at: null },
          { onConflict: "participant_id,source" },
        );
      } catch (e) {
        const { actorIdFor } = await import("./apify.server");
        await db.from("source_records").upsert(
          { participant_id: data.id, source, source_url: url, actor_id: actorIdFor(source), status: "failed", error: (e as Error).message },
          { onConflict: "participant_id,source" },
        );
      }
    }
    await db.from("participants").update({ status: "ingesting", error: null, updated_at: new Date().toISOString() }).eq("id", data.id);
    return refresh(data.id);
  });

async function refresh(id: string) {
  const { getRun, getItems, normalize } = await import("./apify.server");
  const db = await admin();
  const { data: sources } = await db.from("source_records").select("*").eq("participant_id", id);
  for (const s of sources ?? []) {
    if (s.status !== "running" || !s.actor_run_id) continue;
    try {
      const run = await getRun(s.actor_run_id);
      if (run.status === "SUCCEEDED") {
        const items = await getItems(run.defaultDatasetId);
        const item = items[0];
        const source = s.source as "linkedin" | "instagram";
        if (!item || (item as any).error) {
          await db.from("source_records").update({ status: "failed", error: `No profile data returned${(item as any)?.error ? `: ${(item as any).error}` : ""}`, finished_at: new Date().toISOString() }).eq("id", s.id);
        } else {
          const norm = normalize(source, item as any);
          const isPrivate = source === "instagram" && (norm as any).isPrivate;
          await db.from("source_records").update({
            status: isPrivate ? "failed" : "completed",
            error: isPrivate ? "Instagram account is private; only public accounts are eligible." : null,
            normalized: norm,
            finished_at: new Date().toISOString(),
          }).eq("id", s.id);
        }
      } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
        await db.from("source_records").update({ status: "failed", error: `Apify run ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`, finished_at: new Date().toISOString() }).eq("id", s.id);
      }
    } catch (e) {
      await db.from("source_records").update({ error: (e as Error).message }).eq("id", s.id);
    }
  }
  const { data: after } = await db.from("source_records").select("status").eq("participant_id", id);
  const st = (after ?? []).map((a) => a.status);
  let status = "ingesting";
  if (st.length === 2 && st.every((x) => x === "completed")) status = "ingested";
  else if (st.length === 2 && !st.includes("running")) status = st.includes("completed") ? "partial" : "failed";
  const { data: p } = await db.from("participants").select("status").eq("id", id).single();
  if (p && ["ingesting", "pending"].includes(p.status)) {
    await db.from("participants").update({ status, updated_at: new Date().toISOString(), error: status === "failed" ? "Both sources failed to retrieve." : null }).eq("id", id);
  }
  return { status };
}

export const refreshIngestion = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; passcode: string }) => idPass.parse(d))
  .handler(async ({ data }) => { requirePasscode(data.passcode); return refresh(data.id); });

// ---------- Profile analysis ----------

const evidenceItem = z.object({
  claim: z.string(),
  source: z.enum(["linkedin", "instagram"]),
  quote: z.string(),
  source_url: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});
const profileSchema = z.object({
  summary: z.string(),
  interests: z.array(evidenceItem),
  hobbies: z.array(evidenceItem),
  values: z.array(evidenceItem),
  professional: z.array(evidenceItem),
  stated_preferences: z.array(evidenceItem),
  communication_style: z.string().nullable(),
  uncertainties: z.array(z.string()),
});

export const analyzeProfile = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; passcode: string; force?: boolean }) => withPass({ id: z.string().uuid(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    requirePasscode(data.passcode);
    const { generateStructured, AI_MODEL } = await import("./ai.server");
    const { analyzeOnce, ANALYZABLE } = await import("./analysis");
    const db = await admin();
    const { data: pc } = await db.from("participants").select("consent_confirmed").eq("id", data.id).single();
    if (!pc?.consent_confirmed) return { ok: false as const, error: "Consent not recorded; processing refused." };
    return analyzeOnce(
      data.id,
      {
        usableSources: async (id) => {
          const { data: src } = await db.from("source_records").select("source, status, normalized").eq("participant_id", id);
          return (src ?? []).filter((s) => s.status === "completed" && s.normalized).map((s) => ({ source: s.source, normalized: s.normalized }));
        },
        existingHash: async (id) => {
          const { data: row } = await db.from("profiles_analysis").select("input_hash").eq("participant_id", id).maybeSingle();
          return row ? row.input_hash : undefined;
        },
        claim: async (id, staleBefore) => {
          const now = new Date().toISOString();
          const { data: a } = await db.from("participants").update({ status: "analyzing", error: null, updated_at: now }).eq("id", id).in("status", [...ANALYZABLE]).select("id");
          if (a?.length) return true;
          const { data: b } = await db.from("participants").update({ status: "analyzing", error: null, updated_at: now }).eq("id", id).eq("status", "analyzing").lt("updated_at", staleBefore.toISOString()).select("id");
          return !!b?.length;
        },
        save: async (id, profile, hash, coverage) => {
          const pr = profile as z.infer<typeof profileSchema>;
          const { error } = await db.from("profiles_analysis").upsert({ participant_id: id, summary: pr.summary, data: pr, coverage, model: AI_MODEL, input_hash: hash, created_at: new Date().toISOString() });
          if (error) throw new Error(error.message);
          await db.from("participants").update({ status: "profiled", error: null, updated_at: new Date().toISOString() }).eq("id", id);
        },
        fail: async (id, message) => {
          await db.from("participants").update({ status: "analysis_failed", error: message, updated_at: new Date().toISOString() }).eq("id", id);
        },
      },
      (usable) => generateStructured({
        name: "participant_profile",
        schema: profileSchema,
        instructions:
          "You are the PAIRWISE Profile Agent. Extract a dating-relevant profile ONLY from the supplied public source data. Every claim must cite a short verbatim quote from the data and its source. Never infer protected attributes (religion, ethnicity, health, sexuality, politics) or anything not supported by evidence. Only list stated_preferences if explicitly stated. Record what is unknown in uncertainties. Keep evidence concise.",
        prompt: `Sources (JSON):\n${JSON.stringify(usable).slice(0, 24000)}`,
      }),
      { force: data.force },
    );
  });

// ---------- Dating sessions ----------

export const createSession = createServerFn({ method: "POST" })
  .inputValidator((d: { a: string; b: string; passcode: string }) => withPass({ a: z.string().uuid(), b: z.string().uuid() }).refine((x) => x.a !== x.b).parse(d))
  .handler(async ({ data }) => {
    requirePasscode(data.passcode);
    const db = await admin();
    const { data: ps } = await db.from("participants").select("id, status").in("id", [data.a, data.b]);
    if ((ps ?? []).length !== 2 || ps!.some((p) => p.status !== "profiled")) return { ok: false as const, error: "Both participants need a completed profile." };
    const { data: s, error } = await db.from("date_sessions").insert({ participant_a: data.a, participant_b: data.b, status: "running" }).select("id").single();
    if (error) return { ok: false as const, error: error.code === "23505" ? "These two have already dated." : error.message };
    return { ok: true as const, id: s.id };
  });

/** Generates and persists exactly one agent turn. Client calls repeatedly until done. */
export const runNextTurn = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; passcode: string }) => idPass.parse(d))
  .handler(async ({ data }) => {
    requirePasscode(data.passcode);
    const { generateTextReply, AI_MODEL } = await import("./ai.server");
    const db = await admin();
    const { data: s } = await db.from("date_sessions").select("*").eq("id", data.id).single();
    if (!s) throw new Error("Session not found");
    if (s.status === "completed" || s.status === "evaluating") return { done: true, status: s.status };
    const { data: msgs } = await db.from("date_messages").select("turn, speaker_id, content").eq("session_id", s.id).order("turn");
    const turn = (msgs ?? []).length;
    if (turn >= s.turns_planned) return { done: true, status: s.status };
    const speaker = turn % 2 === 0 ? s.participant_a : s.participant_b;
    const other = speaker === s.participant_a ? s.participant_b : s.participant_a;
    const [{ data: me }, { data: them }] = await Promise.all([
      db.from("participants").select("display_name, profiles_analysis(summary, data)").eq("id", speaker).single(),
      db.from("participants").select("display_name").eq("id", other).single(),
    ]);
    const myProfile = (me as any)?.profiles_analysis;
    const { buildDatingInstructions, composeTurn } = await import("./prompts");
    const instructions = buildDatingInstructions({ me: me?.display_name ?? "", them: them?.display_name ?? "", profileJson: JSON.stringify(myProfile?.data ?? {}), turn, turnsPlanned: s.turns_planned });
    const history = (msgs ?? []).map((m) => ({ role: (m.speaker_id === speaker ? "assistant" : "user") as "assistant" | "user", content: m.content }));
    if (!history.length) history.push({ role: "user", content: `(The date begins. Introduce yourself to ${them?.display_name}'s agent.)` });
    try {
      const { text: reply } = await composeTurn(generateTextReply, instructions, history, (c) => ({ role: "user" as const, content: c }), (c) => ({ role: "assistant" as const, content: c }));
      const { error } = await db.from("date_messages").insert({ session_id: s.id, turn, speaker_id: speaker, content: reply });
      if (error && error.code !== "23505") throw new Error(error.message);
      const done = turn + 1 >= s.turns_planned;
      await db.from("date_sessions").update({ model: AI_MODEL, status: done ? "evaluating" : "running", error: null }).eq("id", s.id);
      return { done, status: done ? "evaluating" : "running" };
    } catch (e) {
      await db.from("date_sessions").update({ status: "failed", error: (e as Error).message }).eq("id", s.id);
      throw e;
    }
  });

const criterion = z.object({ score: z.number().nullable(), reason: z.string(), evidence_refs: z.array(z.string()) });
const evalSchema = z.object({
  criteria: z.object({
    shared_interests: criterion,
    values_alignment: criterion,
    conversation_quality: criterion,
    lifestyle_compatibility: criterion,
    stated_preferences_fit: criterion,
  }),
  confidence: z.enum(["low", "medium", "high"]),
  explanation: z.string(),
  shared_interests: z.array(z.string()),
  conflicts: z.array(z.string()),
  unknowns: z.array(z.string()),
});

export const evaluateSession = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; passcode: string }) => idPass.parse(d))
  .handler(async ({ data }) => {
    requirePasscode(data.passcode);
    const { generateStructured, AI_MODEL } = await import("./ai.server");
    const db = await admin();
    const { data: s } = await db.from("date_sessions").select("*").eq("id", data.id).single();
    if (!s) throw new Error("Session not found");
    const { data: msgs } = await db.from("date_messages").select("turn, speaker_id, content").eq("session_id", s.id).order("turn");
    if ((msgs ?? []).length < s.turns_planned) return { ok: false as const, error: "Conversation not finished yet." };
    const { data: people } = await db.from("participants").select("id, display_name, profiles_analysis(data, coverage)").in("id", [s.participant_a, s.participant_b]);
    const byId = Object.fromEntries((people ?? []).map((p: any) => [p.id, p]));
    const transcript = msgs!.map((m) => `[M${m.turn}] ${byId[m.speaker_id]?.display_name}: ${m.content}`).join("\n");
    const { buildEvidenceIndex, describeIndex, validateCriteria } = await import("./evidence");
    try {
      for (const [evaluator, candidate] of [[s.participant_a, s.participant_b], [s.participant_b, s.participant_a]] as const) {
        const ev = byId[evaluator];
        const ca = byId[candidate];
        const idx = buildEvidenceIndex(ev.profiles_analysis?.data, ca.profiles_analysis?.data, msgs!);
        const out = await generateStructured({
          name: "directional_evaluation",
          schema: evalSchema,
          instructions:
            "You are the PAIRWISE Match Evaluator. Assess compatibility FROM THE EVALUATOR'S PERSPECTIVE (directional). Rate each rubric criterion 0-5 using only the profiles' evidence and the transcript; use null when there is not enough evidence. For each criterion give a one-sentence reason and cite evidence_refs using ONLY ids from the supplied reference list (E.* = evaluator claim, C.* = candidate claim, M<n> = message); use an empty list if nothing supports it. Missing data is not a negative signal. Set confidence low if evidence is thin. Do not claim to predict relationship success.",
          prompt: `Evaluator: ${ev.display_name}\nEvaluator profile: ${JSON.stringify(ev.profiles_analysis?.data).slice(0, 7000)}\n\nCandidate: ${ca.display_name}\nCandidate profile: ${JSON.stringify(ca.profiles_analysis?.data).slice(0, 7000)}\n\nTranscript:\n${transcript}\n\nCitable references:\n${describeIndex(idx)}`,
        });
        const criteria = validateCriteria(out.criteria, idx);
        const rubric = Object.fromEntries(Object.entries(criteria).map(([k, v]) => [k, v.score])) as Rubric;
        const score = computeScore(rubric, out.confidence);
        await db.from("evaluations").upsert(
          { session_id: s.id, evaluator_id: evaluator, candidate_id: candidate, rubric, criteria_evidence: criteria, score, confidence: out.confidence, explanation: out.explanation, shared_interests: out.shared_interests, conflicts: out.conflicts, unknowns: out.unknowns, model: AI_MODEL },
          { onConflict: "session_id,evaluator_id" },
        );
      }
      await db.from("date_sessions").update({ status: "completed", completed_at: new Date().toISOString(), error: null }).eq("id", s.id);
      return { ok: true as const };
    } catch (e) {
      await db.from("date_sessions").update({ status: "failed", error: `Evaluation failed: ${(e as Error).message}` }).eq("id", s.id);
      return { ok: false as const, error: (e as Error).message };
    }
  });

// ---------- Data removal ----------

/** Permanently deletes a participant and everything derived from them (cascades to sources, profile, dates, evaluations). */
export const deleteParticipant = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; passcode: string }) => idPass.parse(d))
  .handler(async ({ data }) => {
    try { requirePasscode(data.passcode); } catch (e) { return { ok: false as const, error: (e as Error).message }; }
    const db = await admin();
    const { error } = await db.from("participants").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
