import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Avatar, Card, Icon } from "@/design-system/pairwise-2899a4";
import { AppShell, CRITERION_LABEL, ConfidenceLabel, CriteriaMeter, EmptyState, RecordKind } from "@/components/AppShell";
import { getSession } from "@/lib/pipeline.functions";
import { RUBRIC_WEIGHTS, SCORE_DISCLAIMER, computeScore, noScoreReason, rubricSummary, type Confidence, type Rubric, type RubricKey } from "@/lib/ranking";
import { readCriteriaEvidence } from "@/lib/evidence";

const q = (id: string) => queryOptions({ queryKey: ["session", id], queryFn: () => getSession({ data: { id } }) });

export const Route = createFileRoute("/match/$sessionId/$evaluatorId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(q(params.sessionId)),
  head: ({ loaderData, params }) => {
    const ev = loaderData?.people.find((p) => p.id === params.evaluatorId)?.display_name ?? "Participant";
    const ca = loaderData?.people.find((p) => p.id !== params.evaluatorId)?.display_name ?? "candidate";
    return {
      meta: [
        { title: `${ev} → ${ca} match breakdown — PAIRWISE` },
        { name: "description", content: `How ${ev}'s agent rated the date with ${ca}: five criteria, confidence and the saved evidence.` },
        { property: "og:title", content: `${ev} → ${ca} match breakdown — PAIRWISE` },
        { property: "og:description", content: "An exploratory, evidence-led match breakdown." },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: MatchPage,
});

function MatchPage() {
  const { sessionId, evaluatorId } = Route.useParams();
  const { data } = useSuspenseQuery(q(sessionId));
  const e = data?.evaluations.find((x) => x.evaluator_id === evaluatorId);
  if (!data || !e) return <AppShell narrow><EmptyState icon="star" title="No evaluation for this direction">It may not have run yet. {data && <Link to="/sessions/$id" params={{ id: sessionId }}>Back to the date</Link>}</EmptyState></AppShell>;

  const name = (pid: string) => data.people.find((p) => p.id === pid)?.display_name ?? "Unknown";
  const isTest = data.people.some((p) => p.is_test);
  const isDemo = data.people.some((p) => p.is_demo);
  const rubric = e.rubric as Rubric;
  const { rated, unknown } = rubricSummary(rubric);
  const evidence = readCriteriaEvidence(e.criteria_evidence);
  const score = e.score === null ? null : Number(e.score);
  // Integrity check: displayed score must equal the deterministic implementation.
  const recomputed = computeScore(rubric, e.confidence as Confidence);
  const mismatch = recomputed !== score;
  const shared = e.shared_interests as string[];

  return (
    <AppShell>
      <section className="stack">
        <div className="row"><RecordKind isDemo={isDemo} isTest={isTest} /><Link to="/sessions/$id" params={{ id: sessionId }} className="meta">← Back to the conversation</Link></div>
        <div className="row"><Avatar name={name(e.evaluator_id)} tone="blue" /><Icon name="arrowRight" /><Avatar name={name(e.candidate_id)} tone="pink" /></div>
        <h1 className="h1">How {name(e.evaluator_id)}'s agent saw {name(e.candidate_id)}</h1>
      </section>

      <section className="score-hero">
        <div className={`score-big${score === null ? " score-big--none" : ""}`}>
          <div><strong>{score ?? "—"}</strong><span className="meta">{score === null ? "no score" : "out of 100"}</span></div>
        </div>
        <div className="stack">
          <div className="row"><ConfidenceLabel value={e.confidence} /><CriteriaMeter rated={rated.length} /></div>
          {score === null && <p className="muted">{noScoreReason(rubric, e.confidence as Confidence)}</p>}
          <p className="prose">{e.explanation}</p>
          <p className="meta">{SCORE_DISCLAIMER}</p>
          {mismatch && <div className="alert">Stored score doesn't match the current scoring rules (expected {recomputed ?? "no score"}).</div>}
        </div>
      </section>

      {shared.length > 0 && (
        <section className="stack stack--sm">
          <h2 className="h3">Shared-interest highlights</h2>
          <div className="pw-chips">{shared.map((x) => <span key={x} className="pw-chip">{x}</span>)}</div>
        </section>
      )}

      <div className="split">
        <section className="stack">
          <h2 className="h2">Five criteria</h2>
          <Card>
            <div>
              {(Object.keys(RUBRIC_WEIGHTS) as RubricKey[]).map((k) => {
                const v = rubric[k];
                const ce = evidence?.[k];
                return (
                  <div key={k} className="criterion">
                    <strong>{CRITERION_LABEL[k]}</strong>
                    <span className="meta">{v === null || v === undefined ? "Unknown" : `${v} / 5`} · weight {Math.round(RUBRIC_WEIGHTS[k] * 100)}%</span>
                    <div className="criterion__body">
                      {v !== null && v !== undefined
                        ? <div className="bar" aria-hidden><span style={{ width: `${(v / 5) * 100}%` }} /></div>
                        : <p className="muted">Not enough evidence to rate — left out of the score, not counted against anyone.</p>}
                      {ce ? (
                        <>
                          {ce.reason && <p className="muted">{ce.reason}</p>}
                          {ce.refs.length > 0 && (
                            <div className="row" style={{ gap: "var(--space-2)" }}>
                              {ce.refs.map((r) => r.ref.startsWith("M")
                                ? <Link key={r.ref} to="/sessions/$id" params={{ id: sessionId }} hash={`m-${r.ref.slice(1)}`} className="ref"><Icon name="conversation" size="sm" />Message {Number(r.ref.slice(1)) + 1}</Link>
                                : <span key={r.ref} className="ref" title={r.ref.startsWith("E") ? `${name(e.evaluator_id)}'s profile` : `${name(e.candidate_id)}'s profile`}><Icon name="link" size="sm" />{r.label}</span>)}
                            </div>
                          )}
                        </>
                      ) : <p className="meta">Criterion explanation not recorded (evaluation made before evidence tracking).</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </section>
        <aside className="stack">
          <Card variant="soft">
            <div className="stack stack--sm">
              <h2 className="h3">Unknown</h2>
              {unknown.length === 0 && (e.unknowns as string[]).length === 0 ? <p className="muted">Every criterion had some evidence.</p> : (
                <ul className="list-plain">
                  {unknown.map((k) => <li key={k}>{CRITERION_LABEL[k]} (not rated)</li>)}
                  {(e.unknowns as string[]).map((u) => <li key={u}>{u}</li>)}
                </ul>
              )}
            </div>
          </Card>
          {(e.conflicts as string[]).length > 0 && (
            <Card>
              <div className="stack stack--sm"><h2 className="h3">Possible friction</h2><ul className="list-plain">{(e.conflicts as string[]).map((c) => <li key={c}>{c}</li>)}</ul></div>
            </Card>
          )}
          <Link to="/discover" search={{ for: e.evaluator_id }} className="pw-button pw-button--secondary">All of {name(e.evaluator_id)}'s matches</Link>
        </aside>
      </div>
    </AppShell>
  );
}
