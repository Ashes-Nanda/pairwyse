import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Avatar, Badge, Button, Card, Icon } from "@/design-system/pairwise-2899a4";
import { AppShell, ConfidenceLabel, CriteriaMeter, EmptyState, ErrorNote, RecordKind } from "@/components/AppShell";
import { PasscodeGate, usePasscode } from "@/components/Passcode";
import { evaluateSession, getSession, runNextTurn } from "@/lib/pipeline.functions";
import { rubricSummary, type Rubric } from "@/lib/ranking";

const q = (id: string) => queryOptions({ queryKey: ["session", id], queryFn: () => getSession({ data: { id } }) });

export const Route = createFileRoute("/sessions/$id")({
  validateSearch: z.object({ run: z.boolean().optional() }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(q(params.id)),
  head: ({ loaderData }) => {
    const n = (loaderData?.people ?? []).map((p) => p.display_name).join(" × ") || "Agent date";
    return {
      meta: [
        { title: `${n} — agent date on PAIRWISE` },
        { name: "description", content: `The saved eight-message conversation between ${n}'s agents, with evidence and match breakdowns.` },
        { property: "og:title", content: `${n} — agent date on PAIRWISE` },
        { property: "og:description", content: "A real, persisted agent-to-agent first date." },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: SessionPage,
  notFoundComponent: () => <AppShell><EmptyState title="Date not found" /></AppShell>,
});

type Ev = { claim: string; source: string; quote: string };

function SessionPage() {
  const { id } = Route.useParams();
  const { run } = Route.useSearch();
  const { data } = useSuspenseQuery(q(id));
  const qc = useQueryClient();
  const next = useServerFn(runNextTurn);
  const evaluate = useServerFn(evaluateSession);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoRun, setAutoRun] = useState(!!run);
  const [resumed, setResumed] = useState(false);
  const pass = usePasscode();

  const s = data?.session;
  // Orchestration (unchanged): one persisted turn per call; evaluation only after all planned turns exist.
  useEffect(() => {
    if (!s || !autoRun || working || !pass.passcode) return;
    if ((s.status === "running" || s.status === "failed") && data.messages.length < s.turns_planned) {
      setWorking(true);
      next({ data: { id, passcode: pass.passcode ?? "" } })
        .catch((e) => { setErr(`${(e as Error).message}`); setAutoRun(false); })
        .finally(async () => { await qc.invalidateQueries({ queryKey: ["session", id] }); setWorking(false); });
    } else if (s.status === "failed" && data.messages.length >= s.turns_planned) {
      setWorking(true);
      next({ data: { id, passcode: pass.passcode ?? "" } })
        .catch((e) => { setErr((e as Error).message); setAutoRun(false); })
        .finally(async () => { await qc.invalidateQueries({ queryKey: ["session", id] }); setWorking(false); });
    } else if (s.status === "evaluating") {
      setWorking(true);
      evaluate({ data: { id, passcode: pass.passcode ?? "" } })
        .then((r) => { if (!r.ok) setErr(r.error); })
        .catch((e) => setErr((e as Error).message))
        .finally(async () => { setAutoRun(false); await qc.invalidateQueries({ queryKey: ["session", id] }); setWorking(false); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.status, data?.messages.length, autoRun, working, pass.passcode]);

  if (!data || !s) return <AppShell><EmptyState title="Date not found" /></AppShell>;
  const person = (pid: string) => data.people.find((p) => p.id === pid);
  const name = (pid: string) => person(pid)?.display_name ?? "Unknown";
  const isDemo = data.people.some((p) => p.is_demo);
  const isTest = data.people.some((p) => p.is_test);
  const n = data.messages.length;
  const complete = n >= s.turns_planned;
  const evalA = data.evaluations.find((e) => e.evaluator_id === s.participant_a);
  const evalB = data.evaluations.find((e) => e.evaluator_id === s.participant_b);

  // Honest state label derived only from persisted status + what this page is doing right now.
  const state =
    s.status === "completed" ? { label: "Completed", badge: "completed" as const, note: `All ${s.turns_planned} messages and both evaluations are saved.` }
    : working && s.status === "evaluating" ? { label: "Evaluating", badge: "running" as const, note: "Both agents are writing their evaluations." }
    : working ? { label: resumed ? "Resumed — agents talking" : "Agents talking", badge: "running" as const, note: `Writing message ${n + 1} of ${s.turns_planned}.` }
    : s.status === "failed" && complete ? { label: "Evaluation failed", badge: "failed" as const, note: "The conversation is complete, but the evaluation didn't finish. This pair isn't ranked yet." }
    : s.status === "failed" ? { label: "Interrupted", badge: "failed" as const, note: `Stopped after ${n} of ${s.turns_planned} saved messages. Nothing was lost.` }
    : s.status === "evaluating" ? { label: "Waiting to evaluate", badge: "partial" as const, note: "Conversation complete; evaluation hasn't run yet." }
    : n > 0 ? { label: "Paused", badge: "partial" as const, note: `${n} of ${s.turns_planned} messages saved. No evaluation exists until all ${s.turns_planned} are done.` }
    : { label: "Not started", badge: "pending" as const, note: "No messages yet." };

  const canContinue = pass.passcode && !working && s.status !== "completed";

  return (
    <AppShell>
      <section className="stack">
        <div className="row"><RecordKind isDemo={isDemo} isTest={isTest} /><Badge status={state.badge}>{state.label}</Badge></div>
        <h1 className="h2">{name(s.participant_a)} × {name(s.participant_b)}</h1>
        <div className="date-head">
          <Link to="/participants/$id" params={{ id: s.participant_a }} className="person">
            <Avatar name={name(s.participant_a)} tone="blue" /><div><strong>{name(s.participant_a)}</strong><p className="meta">Agent</p></div>
          </Link>
          <div className="stack stack--sm" style={{ alignItems: "center" }}>
            <div className="turns" role="img" aria-label={`${n} of ${s.turns_planned} messages`}>
              {Array.from({ length: s.turns_planned }, (_, i) => <span key={i} data-done={i < n} data-current={working && i === n} />)}
            </div>
            <span className="meta">{n} / {s.turns_planned} messages</span>
          </div>
          <Link to="/participants/$id" params={{ id: s.participant_b }} className="person person--right">
            <Avatar name={name(s.participant_b)} tone="pink" /><div><strong>{name(s.participant_b)}</strong><p className="meta">Agent</p></div>
          </Link>
        </div>
        <p className="muted">{state.note}</p>
      </section>

      {(err || (s.error && !working)) && (
        <ErrorNote onRetry={canContinue ? () => { setErr(null); setResumed(true); setAutoRun(true); } : undefined} retryLabel={complete ? "Retry evaluation" : "Resume from message " + (n + 1)}>
          {err ?? s.error} Saved messages are kept; retrying continues from where it stopped.
        </ErrorNote>
      )}
      {!pass.passcode && s.status !== "completed" && (
        <Card><div className="stack stack--sm"><strong>Continue this date</strong><p className="muted">Generating messages uses AI credits, so it needs the access code.</p><PasscodeGate onSave={pass.save} /></div></Card>
      )}
      {canContinue && !autoRun && !err && !s.error && (
        <div><Button variant="agent" onClick={() => { setResumed(n > 0); setAutoRun(true); }}><Icon name="conversation" />{n === 0 ? "Start the date" : complete ? "Run evaluation" : "Resume date"}</Button></div>
      )}

      <section className="chat" aria-live="polite" aria-label="Conversation">
        {n === 0 && !working && <p className="muted">No messages generated yet.</p>}
        {data.messages.map((m) => {
          const b = m.speaker_id === s.participant_b;
          return (
            <div key={m.turn} id={`m-${m.turn}`} className={`msg${b ? " msg--b" : ""}`}>
              <Avatar name={name(m.speaker_id)} tone={b ? "pink" : "blue"} size="sm" />
              <div className="msg__col">
                <span className="meta">{name(m.speaker_id)}'s agent · {m.turn + 1}</span>
                <div className="bubble">{m.content}</div>
              </div>
            </div>
          );
        })}
        {working && s.status !== "evaluating" && (
          <div className={`msg${n % 2 === 1 ? " msg--b" : ""}`}>
            <Avatar name={name(n % 2 === 0 ? s.participant_a : s.participant_b)} tone={n % 2 === 1 ? "pink" : "blue"} size="sm" />
            <div className="bubble" aria-label="Typing"><span className="typing"><i /><i /><i /></span></div>
          </div>
        )}
      </section>

      <details className="drawer">
        <summary>What each agent knows (evidence)</summary>
        <div className="grid">
          {[s.participant_a, s.participant_b].map((pid) => {
            const d = (person(pid) as any)?.profiles_analysis?.data as Record<string, Ev[]> | undefined;
            const claims = d ? ["interests", "hobbies", "values"].flatMap((k) => d[k] ?? []).slice(0, 6) : [];
            return (
              <div key={pid} className="stack stack--sm">
                <strong>{name(pid)}</strong>
                {claims.length === 0 ? <p className="muted">No profile evidence available.</p> : claims.map((c, i) => (
                  <div key={i} className="claim"><span className="muted">{c.claim}</span><blockquote className="quote">“{c.quote}” · {c.source === "linkedin" ? "LinkedIn" : "Instagram"}</blockquote></div>
                ))}
                <Link to="/participants/$id" params={{ id: pid }} className="meta">Full profile →</Link>
              </div>
            );
          })}
        </div>
      </details>

      <section className="stack">
        <h2 className="h2">Match breakdowns</h2>
        {data.evaluations.length === 0 ? (
          <EmptyState icon="star" title="Not evaluated yet">{complete ? "The conversation is complete; the evaluation hasn't finished." : `Evaluations run only after all ${s.turns_planned} messages exist.`}</EmptyState>
        ) : (
          <div className="grid">
            {([[s.participant_a, evalA], [s.participant_b, evalB]] as const).map(([pid, e]) => (
              <Card key={pid} variant="raised">
                <div className="stack">
                  <strong>How {name(pid)}'s agent saw {name(pid === s.participant_a ? s.participant_b : s.participant_a)}</strong>
                  {!e ? <p className="muted">This direction hasn't been evaluated.</p> : (
                    <>
                      <div className="row"><span className="score-sm">{e.score === null ? "No score" : e.score}</span><ConfidenceLabel value={e.confidence} /></div>
                      <CriteriaMeter rated={rubricSummary(e.rubric as Rubric).rated.length} />
                      <Link to="/match/$sessionId/$evaluatorId" params={{ sessionId: s.id, evaluatorId: pid }} className="pw-button pw-button--secondary pw-button--sm">Full breakdown<Icon name="arrowRight" size="sm" /></Link>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
