import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Avatar, Badge, Button, Card, Icon } from "@/design-system/pairwise-2899a4";
import { AppShell, ConfidenceLabel, ConfirmDialog, EmptyState, ErrorNote, RecordKind, STATUS_LABEL, Timeline, statusBadge, type TimelineState } from "@/components/AppShell";
import { PasscodeGate, usePasscode } from "@/components/Passcode";
import { analyzeProfile, createSession, deleteParticipant, getParticipant, refreshIngestion, startIngestion } from "@/lib/pipeline.functions";

const q = (id: string) => queryOptions({ queryKey: ["participant", id], queryFn: () => getParticipant({ data: { id } }) });

export const Route = createFileRoute("/participants/$id")({
  validateSearch: z.object({ autostart: z.boolean().optional(), tab: z.enum(["profile", "status", "dates", "privacy"]).optional() }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(q(params.id)),
  head: ({ loaderData }) => {
    const name = loaderData?.participant.display_name ?? "Participant";
    return {
      meta: [
        { title: `${name}'s profile — PAIRWISE` },
        { name: "description", content: `Evidence-backed profile, agent dates and matches for ${name} on PAIRWISE.` },
        { property: "og:title", content: `${name}'s profile — PAIRWISE` },
        { property: "og:description", content: `What ${name}'s public profiles actually say, with quotes and sources.` },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ParticipantPage,
  notFoundComponent: () => <AppShell><EmptyState title="Participant not found" /></AppShell>,
});

type Ev = { claim: string; source: string; quote: string; source_url: string | null; confidence: string };
type Tab = "profile" | "status" | "dates" | "privacy";
const srcName = (s: string) => (s === "linkedin" ? "LinkedIn" : "Instagram");

function ParticipantPage() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const started = useRef(false);
  const autoAnalyzed = useRef(false);
  const pass = usePasscode();
  const pc = pass.passcode ?? "";

  const reload = () => qc.invalidateQueries({ queryKey: ["participant", id] });
  const status = data?.participant.status;
  const defaultTab: Tab = data?.profile && status === "profiled" ? "profile" : "status";
  const [tab, setTab] = useState<Tab>(search.tab ?? defaultTab);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setErr(null);
    try {
      const r = (await fn()) as { ok?: boolean; error?: string } | undefined;
      if (r && r.ok === false) setErr(r.error ?? "Something went wrong.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      // Refetch BEFORE clearing busy: clearing first re-ran the auto-analysis effect against stale status (duplicate model call).
      await reload();
      setBusy(null);
    }
  }

  // Orchestration (unchanged logic): start ingestion once after intake, poll while running, analyse once when sources are in.
  useEffect(() => {
    if (!data || !pass.passcode) return;
    if (search.autostart && !started.current && data.sources.length === 0) {
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

  if (!data) return <AppShell><EmptyState title="Participant not found" /></AppShell>;
  const { participant: p, sources, profile, sessions, ranking, candidates, profileFreshness } = data;
  const pd = profile?.data as { summary?: string; interests: Ev[]; hobbies: Ev[]; values: Ev[]; professional: Ev[]; stated_preferences: Ev[]; communication_style: string | null; uncertainties: string[] } | undefined;
  const okSources = sources.filter((s) => s.status === "completed").length;
  const canRetrySources = sources.length < 2 || sources.some((s) => s.status === "failed");

  // ---- Real server-side states for the processing timeline ----
  const srcState = (src: string): TimelineState => {
    const s = sources.find((x) => x.source === src)?.status;
    return s === "completed" ? "completed" : s === "failed" ? "failed" : s === "running" ? "running" : "pending";
  };
  const retrievalDone = sources.length === 2 && sources.every((s) => s.status !== "running");
  const extractionState: TimelineState = okSources === 2 ? "completed" : okSources === 1 && retrievalDone ? "partial" : retrievalDone ? "failed" : "pending";
  const analysisState: TimelineState =
    status === "analyzing" || busy === "analyze" ? "running" : status === "analysis_failed" ? "failed" : profile ? (profile.coverage === "partial" ? "partial" : "completed") : "pending";
  const srcDetail = (src: string) => {
    const s = sources.find((x) => x.source === src);
    if (!s) return "Not started yet.";
    if (s.status === "failed") return <>{s.error ?? "Retrieval failed."} {canRetrySources ? "You can retry below." : ""}</>;
    if (s.status === "running") return "Apify is fetching the public profile. This page checks every few seconds.";
    return `Retrieved${s.finished_at ? ` ${new Date(s.finished_at).toLocaleString()}` : ""}.`;
  };

  return (
    <AppShell>
      <section className="profile-head">
        <Avatar name={p.display_name} size="lg" tone="pink" />
        <div className="stack stack--sm">
          <h1 className="h1">{p.display_name}</h1>
          <div className="row">
            <RecordKind isDemo={p.is_demo} isTest={p.is_test} />
            <Badge status={statusBadge(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
            <span className="meta">{okSources} of 2 sources retrieved</span>
          </div>
        </div>
      </section>

      {(p.error || err) && <ErrorNote>{err ?? p.error}</ErrorNote>}

      <div className="stack">
        <div className="tabs" role="tablist" aria-label="Profile sections">
          {([["profile", "Profile"], ["status", "Sources & status"], ["dates", "Dates & matches"], ["privacy", "Privacy & settings"]] as const).map(([k, l]) => (
            <button key={k} role="tab" type="button" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="stack stack--lg" role="tabpanel">
            {!profile || !pd ? (
              <EmptyState icon="sparkles" title={analysisState === "running" ? "The profile agent is reading the sources…" : "No profile yet"}>
                <span>{analysisState === "running" ? "This usually takes under a minute." : "A profile is created once at least one source has been retrieved."}</span>
                <Button variant="secondary" size="sm" onClick={() => setTab("status")}>See processing status</Button>
              </EmptyState>
            ) : (
              <>
                {profile.coverage === "partial" && <div className="notice"><Icon name="alert" size="sm" />Partial profile — built from one of two sources.</div>}
                {profileFreshness === "stale" && <div className="notice"><Icon name="alert" size="sm" />Sources changed since this profile was generated. Regenerate it from Sources &amp; status.</div>}
                <div className="split">
                  <div className="stack stack--lg">
                    <div className="stack stack--sm">
                      <p className="eyebrow">AI-generated summary</p>
                      <p className="generated">{profile.summary}</p>
                      {pd.communication_style && <p className="muted">Communication style (AI reading): {pd.communication_style}</p>}
                    </div>
                    {([["Interests", pd.interests], ["Hobbies", pd.hobbies], ["Values", pd.values], ["Professional interests", pd.professional], ["Stated preferences", pd.stated_preferences]] as const).map(([label, items]) => (
                      <section key={label} className="stack stack--sm">
                        <h2 className="h3">{label}</h2>
                        {items.length === 0 ? <p className="muted">No supporting evidence found in the sources.</p> : (
                          <div>
                            {items.map((e, i) => (
                              <div key={i} className="claim">
                                <strong>{e.claim}</strong>
                                <blockquote className="quote">“{e.quote}”</blockquote>
                                <div className="claim__meta">
                                  <span>Source quote · {srcName(e.source)}</span>
                                  <ConfidenceLabel value={e.confidence} />
                                  {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer">Open post <Icon name="external" size="sm" /></a>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    ))}
                  </div>
                  <aside className="stack">
                    <Card variant="soft">
                      <div className="stack stack--sm">
                        <h2 className="h3">Unknown or unverified</h2>
                        {pd.uncertainties.length ? <ul className="list-plain">{pd.uncertainties.map((u, i) => <li key={i}>{u}</li>)}</ul> : <p className="muted">None recorded.</p>}
                        <p className="meta">Unknowns are never counted against anyone. Dating preferences aren't inferred from professional details, and captions aren't treated as lasting traits.</p>
                      </div>
                    </Card>
                    <Card>
                      <div className="stack stack--sm">
                        <h2 className="h3">About this analysis</h2>
                        <p className="muted">Generated {new Date(profile.created_at).toLocaleString()} by {profile.model}.</p>
                        <p className="muted">{profileFreshness === "current" ? "Up to date with the retrieved sources." : profileFreshness === "stale" ? "Out of date — sources changed." : "Created before input tracking existed."}</p>
                        <div className="row">
                          <a className="muted" href={p.linkedin_url} target="_blank" rel="noreferrer">LinkedIn <Icon name="external" size="sm" /></a>
                          <a className="muted" href={p.instagram_url} target="_blank" rel="noreferrer">Instagram <Icon name="external" size="sm" /></a>
                        </div>
                      </div>
                    </Card>
                  </aside>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "status" && (
          <div className="split" role="tabpanel">
            <Timeline
              steps={[
                { title: "Link validation", state: "completed", detail: "Both URLs matched the LinkedIn and Instagram profile formats and consent was recorded." },
                { title: "LinkedIn retrieval", state: srcState("linkedin"), detail: srcDetail("linkedin") },
                { title: "Instagram retrieval", state: srcState("instagram"), detail: srcDetail("instagram") },
                { title: "Evidence extraction", state: extractionState, detail: extractionState === "partial" ? "Only one source produced usable fields; the profile will be partial." : extractionState === "failed" ? "No source produced usable fields." : extractionState === "completed" ? "Matchmaking-relevant fields kept from both sources." : "Waits for retrieval." },
                { title: "Profile analysis", state: analysisState, detail: analysisState === "failed" ? "The analysis call failed. Your sources are saved — retry below." : analysisState === "running" ? "The profile agent is writing evidence-backed claims." : profile ? `Saved ${new Date(profile.created_at).toLocaleString()}${profile.coverage === "partial" ? " · partial (one source)" : " · complete"}.` : "Starts automatically once a source is retrieved." },
              ]}
            />
            <aside className="stack">
              {!pass.passcode && !p.is_demo ? (
                <Card><div className="stack stack--sm"><h2 className="h3">Operator controls</h2><p className="muted">Retries and re-analysis spend retrieval and AI credits, so they need the access code.</p><PasscodeGate onSave={pass.save} /></div></Card>
              ) : (
                <Card>
                  <div className="stack">
                    <h2 className="h3">Actions</h2>
                    {canRetrySources && <Button variant="secondary" loading={busy === "ingest"} onClick={() => act("ingest", () => start({ data: { id, passcode: pc } }))}>{sources.length ? "Retry failed sources" : "Start retrieval"}</Button>}
                    {status === "ingesting" && <Button variant="ghost" loading={busy === "refresh"} onClick={() => act("refresh", () => refresh({ data: { id, passcode: pc } }))}>Check status now</Button>}
                    {["analysis_failed", "profiled", "partial", "ingested"].includes(status ?? "") && (
                      <Button variant="agent" loading={busy === "analyze"} onClick={() => act("analyze", () => analyze({ data: { id, passcode: pc, force: profileFreshness === "current" } }))}>
                        <Icon name="sparkles" />{!profile ? "Analyse profile" : profileFreshness === "stale" ? "Regenerate (sources changed)" : status === "analysis_failed" ? "Retry analysis" : "Re-run analysis"}
                      </Button>
                    )}
                    <p className="meta">Unchanged sources reuse the saved profile; a failed retry never overwrites a saved one.</p>
                  </div>
                </Card>
              )}
            </aside>
          </div>
        )}

        {tab === "dates" && (
          <div className="stack stack--lg" role="tabpanel">
            {status === "profiled" && pass.passcode && (
              <Card>
                <div className="stack">
                  <h2 className="h3">Send {p.display_name}'s agent on a date</h2>
                  {candidates.length === 0 ? <p className="muted">No other profiled participants are waiting for a date with {p.display_name}.</p> : (
                    <div className="row">
                      <select className="pw-input" aria-label="Choose a date partner" value={partner} onChange={(e) => setPartner(e.target.value)}>
                        <option value="">Choose someone with a ready profile…</option>
                        {candidates.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                      </select>
                      <Button disabled={!partner} loading={busy === "date"} onClick={() => act("date", async () => {
                        const r = await newSession({ data: { a: id, b: partner, passcode: pc } });
                        if (r.ok) navigate({ to: "/sessions/$id", params: { id: r.id }, search: { run: true } });
                        return r;
                      })}><Icon name="heart" />Start date</Button>
                    </div>
                  )}
                </div>
              </Card>
            )}
            <section className="stack">
              <div className="section-head"><h2 className="h2">Dates</h2>{ranking.length > 0 && <Link to="/discover" search={{ for: id }} className="pw-button pw-button--secondary pw-button--sm">See {p.display_name}'s matches<Icon name="arrowRight" size="sm" /></Link>}</div>
              {sessions.length === 0 ? <EmptyState icon="conversation" title="No dates yet" /> : (
                <div className="grid">
                  {sessions.map((s) => (
                    <Link key={s.id} to="/sessions/$id" params={{ id: s.id }} className="link-reset">
                      <Card variant="raised">
                        <div className="stack stack--sm">
                          <div className="row"><Avatar name={s.partner_name} tone="blue" size="sm" /><strong>with {s.partner_name}</strong></div>
                          <Badge status={statusBadge(s.status)}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                          <span className="meta">Open conversation →</span>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "privacy" && (
          <div className="split" role="tabpanel">
            <div className="stack stack--lg">
              <section className="stack stack--sm">
                <h2 className="h3">Sources</h2>
                {(["linkedin", "instagram"] as const).map((src) => {
                  const s = sources.find((x) => x.source === src);
                  return (
                    <div key={src} className="row row--between claim">
                      <a href={src === "linkedin" ? p.linkedin_url : p.instagram_url} target="_blank" rel="noreferrer">{srcName(src)} profile <Icon name="external" size="sm" /></a>
                      <Badge status={statusBadge(s?.status ?? "pending")}>{s?.status === "completed" ? "Retrieved" : s?.status === "failed" ? "Failed" : s?.status === "running" ? "Retrieving" : "Not started"}</Badge>
                    </div>
                  );
                })}
              </section>
              <section className="stack stack--sm">
                <h2 className="h3">Consent</h2>
                <p className="muted">Consent and 18+ confirmation recorded {p.consent_at ? new Date(p.consent_at).toLocaleString() : "—"}.</p>
              </section>
              <section className="stack stack--sm">
                <h2 className="h3">What's retained</h2>
                <ul className="list-plain">
                  <li>Matchmaking-relevant source fields (no raw output, emails or phone numbers).</li>
                  <li>The AI-generated profile and its supporting quotes.</li>
                  <li>Agent date transcripts and evaluations involving {p.display_name}.</li>
                </ul>
              </section>
            </div>
            <aside className="stack">
              {!pass.passcode ? (
                <Card><div className="stack stack--sm"><h2 className="h3">Manage data</h2><p className="muted">Refreshing or deleting requires the access code, so nobody else can remove your data.</p><PasscodeGate onSave={pass.save} /></div></Card>
              ) : (
                <Card>
                  <div className="stack">
                    <h2 className="h3">Manage data</h2>
                    <Button variant="secondary" onClick={() => setTab("status")}>Refresh profile…</Button>
                    <Button variant="danger" loading={busy === "delete"} onClick={() => setConfirmDelete(true)}>Delete my data</Button>
                    <p className="meta">Deletion permanently removes sources, profile, dates and every evaluation involving {p.display_name}.</p>
                  </div>
                </Card>
              )}
            </aside>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title={`Delete all data for ${p.display_name}?`}
        body="This permanently removes retrieved sources, the profile, all dates and evaluations. It can't be undone."
        confirmLabel="Delete permanently"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void act("delete", async () => {
            const r = await removeParticipant({ data: { id, passcode: pc } });
            if (r.ok) navigate({ to: "/" });
            return r;
          });
        }}
      />
    </AppShell>
  );
}
