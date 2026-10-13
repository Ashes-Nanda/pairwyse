import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Avatar, Card, Icon } from "@/design-system/pairwise-2899a4";
import { AppShell, ConfidenceLabel, CriteriaMeter, EmptyState, RecordKind } from "@/components/AppShell";
import { getParticipant, listParticipants } from "@/lib/pipeline.functions";
import { SCORE_DISCLAIMER, noScoreReason, rubricSummary, type Rubric } from "@/lib/ranking";

const listQ = queryOptions({ queryKey: ["participants"], queryFn: () => listParticipants() });
const pQ = (id: string) => queryOptions({ queryKey: ["participant", id], queryFn: () => getParticipant({ data: { id } }) });

export const Route = createFileRoute("/discover")({
  validateSearch: z.object({ for: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ for: search.for }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(listQ);
    if (deps.for) await context.queryClient.ensureQueryData(pQ(deps.for));
  },
  head: () => ({
    meta: [
      { title: "Discover matches — PAIRWISE" },
      { name: "description", content: "Individualised, evidence-backed match rankings from real agent dates between consenting participants." },
      { property: "og:title", content: "Discover matches — PAIRWISE" },
      { property: "og:description", content: "See who each participant's agent connected with, and why." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Discover,
});

const tones = ["pink", "blue", "yellow"] as const;

function Discover() {
  const { for: forId } = Route.useSearch();
  const { data: list } = useSuspenseQuery(listQ);
  const profiled = list.participants.filter((p) => p.status === "profiled");
  return (
    <AppShell>
      <div className="stack">
        <p className="eyebrow">Discover</p>
        <h1 className="h1">Whose matches would you like to see?</h1>
        <p className="lead">Rankings are individual: each person's agent rates its own dates. Only real, consenting participants appear here.</p>
      </div>
      {profiled.length === 0 ? <EmptyState icon="users" title="No profiled participants yet" /> : (
        <nav className="row" aria-label="Choose a participant">
          {profiled.map((p, i) => (
            <Link key={p.id} to="/discover" search={{ for: p.id }} className={`pw-button pw-button--sm ${p.id === forId ? "pw-button--primary" : "pw-button--ghost"}`}>
              <Avatar name={p.display_name} size="sm" tone={tones[i % 3]} />{p.display_name}
            </Link>
          ))}
        </nav>
      )}
      {forId ? <Rankings id={forId} /> : profiled.length > 0 && <EmptyState icon="heart" title="Pick someone above to see their matches" />}
    </AppShell>
  );
}

function Rankings({ id }: { id: string }) {
  const { data } = useSuspenseQuery(pQ(id));
  if (!data) return <EmptyState title="Participant not found" />;
  const { participant: p, ranking, candidates, totalOthers } = data;
  const scored = ranking.filter((r) => r.score !== null);
  const unscored = ranking.filter((r) => r.score === null);
  const single = scored.length === 1;

  return (
    <section className="stack stack--lg">
      <div className="section-head">
        <div className="stack stack--sm">
          <div className="row"><h2 className="h2">{p.display_name}'s matches</h2>{(p.is_test || p.is_demo) && <RecordKind isDemo={p.is_demo} isTest={p.is_test} />}</div>
          <p className="muted">{ranking.length} of {totalOthers} other participants evaluated · {scored.length} with a score · {candidates.length} not dated yet</p>
        </div>
        <Link to="/participants/$id" params={{ id }} className="meta">View profile →</Link>
      </div>
      <p className="meta">{SCORE_DISCLAIMER}</p>

      {scored.length === 0 && <EmptyState icon="star" title="No scored matches yet">{ranking.length ? "Evaluations exist but none had enough evidence for a score." : `${p.display_name}'s agent hasn't completed an evaluated date yet.`}</EmptyState>}
      {single && <div className="info"><Icon name="sparkles" size="sm" />Only one match has a score so far, so this is a single breakdown, not a ranking.</div>}

      <div className="stack">
        {scored.map((r) => {
          const rated = rubricSummary(r.rubric as Rubric).rated.length;
          return (
            <Link key={r.session_id} to="/match/$sessionId/$evaluatorId" params={{ sessionId: r.session_id, evaluatorId: id }} className="link-reset">
              <Card variant="raised">
                <div className="rank-card">
                  {!single && <span className="rank-num">#{r.rank}</span>}
                  <Avatar name={r.candidate_name} tone="pink" />
                  <div className="stack stack--sm">
                    <strong className="h3">{r.candidate_name}</strong>
                    <div className="row"><ConfidenceLabel value={r.confidence} /><CriteriaMeter rated={rated} /></div>
                    {(r.shared_interests as string[]).length > 0 && <div className="pw-chips">{(r.shared_interests as string[]).slice(0, 3).map((x) => <span key={x} className="pw-chip">{x}</span>)}</div>}
                  </div>
                  <div className="stack stack--sm" style={{ alignItems: "flex-end" }}><span className="score-sm">{r.score}</span><span className="meta">Breakdown →</span></div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {unscored.length > 0 && (
        <div className="stack stack--sm">
          <h3 className="h3">Evaluated, but not enough evidence to score</h3>
          {unscored.map((r) => (
            <Link key={r.session_id} to="/match/$sessionId/$evaluatorId" params={{ sessionId: r.session_id, evaluatorId: id }} className="row claim link-reset">
              <Avatar name={r.candidate_name} size="sm" tone="yellow" /><strong>{r.candidate_name}</strong><span className="muted">{noScoreReason(r.rubric as Rubric, r.confidence)}</span>
            </Link>
          ))}
        </div>
      )}
      {candidates.length > 0 && (
        <div className="stack stack--sm">
          <h3 className="h3">Not dated yet</h3>
          <p className="muted">{candidates.map((c) => c.display_name).join(", ")} — no conversation, so no evaluation. These aren't ranked.</p>
        </div>
      )}
    </section>
  );
}
