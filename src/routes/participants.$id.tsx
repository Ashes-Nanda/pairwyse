import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Avatar, Badge, Button, Card, Icon, MatchResultCard } from "@/design-system/pairwise-2899a4";
import { AppShell, STATUS_LABEL, statusBadge } from "@/components/AppShell";
import { PasscodeGate, usePasscode } from "@/components/Passcode";
import { COVERAGE_LABEL, SCORE_DISCLAIMER, noScoreReason, rubricSummary, type Rubric } from "@/lib/ranking";
import { analyzeProfile, createSession, deleteParticipant, getParticipant, refreshIngestion, startIngestion } from "@/lib/pipeline.functions";

const q = (id: string) => queryOptions({ queryKey: ["participant", id], queryFn: () => getParticipant({ data: { id } }) });

export const Route = createFileRoute("/participants/$id")({
  validateSearch: z.object({ autostart: z.boolean().optional() }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(q(params.id)),
  head: ({ loaderData }) => {
    const name = loaderData?.participant.display_name ?? "Participant";
    return {
      meta: [
        { title: `${name} — PAIRWISE` },
        { name: "description", content: `Evidence-backed profile, agent dates and rankings for ${name}.` },
        { property: "og:title", content: `${name} — PAIRWISE` },
        { property: "og:description", content: `Profile evidence, conversations and directional rankings for ${name}.` },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ParticipantPage,
  notFoundComponent: () => <AppShell><p>Participant not found.</p></AppShell>,
});

type Ev = { claim: string; source: string; quote: string; source_url: string | null; confidence: string };

function ParticipantPage() {
  const { id } = Route.useParams();
  const { autostart } = Route.useSearch();
  const { data } = useSuspenseQuery(q(id));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const start = useServerFn(startIngestion);
  const refresh = useServerFn(refreshIngestion);
  const analyze = useServerFn(analyzeProfile);
  const newSession = useServerFn(createSession);
  const removeParticipant = useServerFn(deleteParticipant);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [partner, setPartner] = useState("");
  const started = useRef(false);
  const autoAnalyzed = useRef(false);
  const pass = usePasscode();
  const pc = pass.passcode ?? "";

  const reload = () => qc.invalidateQueries({ queryKey: ["participant", id] });
  const status = data?.participant.status;

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setErr(null);
    try {
      const r = (await fn()) as { ok?: boolean; error?: string } | undefined;
      if (r && r.ok === false) setErr(r.error ?? "Failed");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      // Refetch BEFORE clearing busy: clearing first re-ran the auto-analysis effect against stale status (duplicate model call).
      await reload();
      setBusy(null);
    }
  }

  // Auto-orchestrate: start ingestion once after intake, poll while running, analyse when sources are in.
  useEffect(() => {
    if (!data || !pass.passcode) return;
    if (autostart && !started.current && data.sources.length === 0) {
      started.current = true;
      void act("ingest", () => start({ data: { id, passcode: pc } }));
      return;
    }
    if (status === "ingesting" && data.sources.length > 0 && !busy) {
      const t = setTimeout(() => void act("refresh", () => refresh({ data: { id, passcode: pc } })), 8000);
      return () => clearTimeout(t);
    }
    if ((status === "ingested" || status === "partial") && !busy && !autoAnalyzed.current) {
      autoAnalyzed.current = true; // auto-trigger at most once per page view; server dedupes too
      void act("analyze", () => analyze({ data: { id, passcode: pc } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, data?.sources.length, busy, pass.passcode]);

  if (!data) return <AppShell><p>Participant not found.</p></AppShell>;
  const { participant: p, sources, profile, sessions, ranking, candidates, totalOthers, profileFreshness } = data;
  const pd = profile?.data as { interests: Ev[]; hobbies: Ev[]; values: Ev[]; professional: Ev[]; stated_preferences: Ev[]; communication_style: string | null; uncertainties: string[] } | undefined;

  return (
    <AppShell>
      <section className="row">
        <Avatar name={p.display_name} size="lg" tone="blue" />
        <div className="col" style={{ gap: "var(--space-1)" }}>
          <h1 className="page-title">{p.display_name}</h1>
          <div className="row">
            <Badge status={statusBadge(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
            <span className="muted">{p.is_demo ? "Saved demo record" : "Live submission"} · consent recorded {p.consent_at ? new Date(p.consent_at).toLocaleDateString() : "—"}</span>
          </div>
        </div>
      </section>
      {p.error && <div className="alert" role="alert">{p.error}</div>}
      {err && <div className="alert" role="alert">{err}</div>}
      {!pass.passcode && !p.is_demo && <PasscodeGate onSave={pass.save} />}

      <section>
        <h2 className="section-title">Sources</h2>
        <div className="grid">
          {(["linkedin", "instagram"] as const).map((src) => {
            const s = sources.find((x) => x.source === src);
            return (
              <Card key={src}>
                <div className="col">
                  <div className="row"><strong>{src === "linkedin" ? "LinkedIn" : "Instagram"}</strong><Badge status={statusBadge(s?.status ?? "pending")}>{STATUS_LABEL[s?.status ?? "pending"] ?? s?.status}</Badge></div>
                  <a className="muted" href={src === "linkedin" ? p.linkedin_url : p.instagram_url} target="_blank" rel="noreferrer">Open source profile <Icon name="external" size="sm" /></a>
                  {s && <span className="muted">Actor {s.actor_id}{s.actor_run_id ? ` · run ${s.actor_run_id}` : ""}</span>}
                  {s?.error && <span className="alert">{s.error}</span>}
                </div>
              </Card>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: "var(--space-4)" }}>
          {(sources.length < 2 || sources.some((s) => s.status === "failed")) && (
            <Button variant="secondary" loading={busy === "ingest"} onClick={() => act("ingest", () => start({ data: { id, passcode: pc } }))}>{sources.length ? "Retry failed sources" : "Start retrieval"}</Button>
          )}
          {status === "ingesting" && <Button variant="ghost" loading={busy === "refresh"} onClick={() => act("refresh", () => refresh({ data: { id, passcode: pc } }))}>Check status now</Button>}
          {["analysis_failed", "profiled", "partial"].includes(status ?? "") && (
            <Button variant="agent" loading={busy === "analyze"} onClick={() => act("analyze", () => analyze({ data: { id, passcode: pc, force: profileFreshness === "current" } }))}><Icon name="sparkles" />{!profile ? "Analyse profile" : profileFreshness === "stale" ? "Regenerate (sources changed)" : "Re-run analysis"}</Button>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">Analysed profile</h2>
        {!profile || !pd ? (
          <p className="muted">{busy === "analyze" || status === "analyzing" ? "The profile agent is analysing retrieved sources…" : "No profile yet. It's created once at least one source is retrieved."}</p>
        ) : (
          <div className="col">
            {profile.coverage === "partial" && <div className="notice">Partial coverage: built from one source only.</div>}
            {profileFreshness === "stale" && <div className="notice">Sources changed since this profile was generated. It is shown as-is until you regenerate it.</div>}
            <p>{profile.summary}</p>
            {pd.communication_style && <p className="muted">Communication style: {pd.communication_style}</p>}
            <div className="grid">
              {([["Interests", pd.interests], ["Hobbies", pd.hobbies], ["Values", pd.values], ["Professional", pd.professional], ["Stated preferences", pd.stated_preferences]] as const).map(([label, items]) => (
                <Card key={label}>
                  <h3 className="pw-title">{label}</h3>
                  {items.length === 0 ? <p className="muted">No evidence found.</p> : (
                    <div className="col">
                      {items.map((e, i) => (
                        <blockquote key={i} className="evidence">
                          <strong>{e.claim}</strong>
                          <div className="muted"><q>{e.quote}</q> · {e.source} · {e.confidence} confidence{e.source_url ? <> · <a href={e.source_url} target="_blank" rel="noreferrer">post</a></> : null}</div>
                        </blockquote>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
              <Card variant="soft">
                <h3 className="pw-title">Unknowns</h3>
                {pd.uncertainties.length ? <ul>{pd.uncertainties.map((u, i) => <li key={i} className="muted">{u}</li>)}</ul> : <p className="muted">None recorded.</p>}
              </Card>
            </div>
            <p className="muted">Generated by {profile.model} on {new Date(profile.created_at).toLocaleString()}.</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="section-title">Dates</h2>
        {status === "profiled" && (
          <div className="row" style={{ marginBottom: "var(--space-4)" }}>
            <select className="pw-input" aria-label="Choose a date partner" value={partner} onChange={(e) => setPartner(e.target.value)}>
              <option value="">Choose a partner with a ready profile…</option>
              {candidates.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
            </select>
            <Button disabled={!partner} loading={busy === "date"} onClick={() => act("date", async () => {
              const r = await newSession({ data: { a: id, b: partner, passcode: pc } });
              if (r.ok) navigate({ to: "/sessions/$id", params: { id: r.id }, search: { run: true } });
              return r;
            })}><Icon name="heart" />Start date</Button>
          </div>
        )}
        {sessions.length === 0 ? <p className="muted">No dates yet.</p> : (
          <table className="table">
            <thead><tr><th>Partner</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>{s.partner_name}</td>
                  <td><Badge status={statusBadge(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge></td>
                  <td><Link to="/sessions/$id" params={{ id: s.id }}>View conversation</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 className="section-title">{p.display_name}'s ranking</h2>
        <p className="muted">Directional: how {p.display_name}'s agent rates each partner. Evaluated {ranking.length} of {totalOthers} other participants; unevaluated pairs are not ranked.</p>
        <p className="pw-meta">{SCORE_DISCLAIMER}</p>
        {ranking.length === 0 ? <p className="muted">No completed evaluations yet.</p> : (
          <div className="col">
            {ranking.map((r) => (
              <MatchResultCard
                key={r.session_id}
                name={`${r.rank ? `#${r.rank} ` : ""}${r.candidate_name}`}
                score={r.score ?? undefined}
                subtitle={`${rubricSummary(r.rubric as Rubric).rated.length} of 5 criteria rated${rubricSummary(r.rubric as Rubric).unknown.length ? ` · unknown: ${rubricSummary(r.rubric as Rubric).unknown.map((k) => k.replace(/_/g, " ")).join(", ")}` : ""}`}
                coverage={COVERAGE_LABEL[r.match_coverage]}
                confidence={(r.confidence.charAt(0).toUpperCase() + r.confidence.slice(1)) as "Low" | "Medium" | "High"}
                interests={r.shared_interests as string[]}
                conflicts={r.conflicts as string[]}
                explanation={r.explanation}
              >
                {r.score === null && <p className="muted">{noScoreReason(r.rubric as Rubric, r.confidence)}</p>}
                <Link to="/sessions/$id" params={{ id: r.session_id }} className="pw-small">View conversation →</Link>
              </MatchResultCard>
            ))}
          </div>
        )}
      </section>

      {pass.passcode && (
        <section>
          <h2 className="section-title">Remove this participant</h2>
          <p className="muted">Permanently deletes {p.display_name}'s retrieved data, profile, dates and evaluations.</p>
          <Button
            variant="danger"
            loading={busy === "delete"}
            onClick={() => {
              if (!window.confirm(`Delete all data for ${p.display_name}? This cannot be undone.`)) return;
              void act("delete", async () => {
                const r = await removeParticipant({ data: { id, passcode: pc } });
                if (r.ok) navigate({ to: "/" });
                return r;
              });
            }}
          >
            Delete participant data
          </Button>
        </section>
      )}
    </AppShell>
  );
}
