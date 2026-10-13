import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button, Card } from "@/design-system/pairwise-2899a4";
import { AppShell, ErrorNote } from "@/components/AppShell";
import { PasscodeGate, usePasscode } from "@/components/Passcode";
import { getOpsSummary } from "@/lib/pipeline.functions";

export const Route = createFileRoute("/ops")({
  head: () => ({
    meta: [
      { title: "Operations — PAIRWISE" },
      { name: "description", content: "Restricted pre-demo verification view for PAIRWISE operators." },
      { property: "og:title", content: "Operations — PAIRWISE" },
      { property: "og:description", content: "Restricted operator view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Ops,
});

type Summary = Extract<Awaited<ReturnType<typeof getOpsSummary>>, { ok: true }>;

function Ops() {
  const pass = usePasscode();
  const load = useServerFn(getOpsSummary);
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fetchIt = () => {
    if (!pass.passcode) return;
    setErr(null);
    load({ data: { passcode: pass.passcode } }).then((r) => (r.ok ? setData(r) : setErr(r.error))).catch((e) => setErr((e as Error).message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fetchIt, [pass.passcode]);

  return (
    <AppShell>
      <div className="stack">
        <p className="eyebrow">Restricted</p>
        <h1 className="h1">Pre-demo verification</h1>
        <p className="muted">Operator-only. Real participants and synthetic test fixtures are counted separately; fixtures never appear in public pages or rankings.</p>
      </div>
      {!pass.passcode ? <Card><PasscodeGate onSave={pass.save} /></Card> : err ? <ErrorNote onRetry={fetchIt}>{err}</ErrorNote> : !data ? <p className="muted">Loading…</p> : (
        <>
          <table className="table">
            <thead><tr><th>Check</th><th>Real (production pool)</th><th>Synthetic fixtures</th></tr></thead>
            <tbody>
              {([
                ["Eligible participants (consented)", (s) => s.participants],
                ["Saved demo cohort", (s) => `${s.demo} / 25`],
                ["LinkedIn retrieved / failed / running", (s) => `${s.linkedin.completed} / ${s.linkedin.failed} / ${s.linkedin.running}`],
                ["Instagram retrieved / failed / running", (s) => `${s.instagram.completed} / ${s.instagram.failed} / ${s.instagram.running}`],
                ["Profiles ready / analysis failed", (s) => `${s.profiled} / ${s.analysisFailed}`],
                ["Dates completed / other", (s) => `${s.sessions.completed} / ${s.sessions.other}`],
                ["Messages saved", (s) => s.messages],
                ["Evaluations (scored)", (s) => `${s.evaluations.total} (${s.evaluations.scored})`],
              ] as [string, (s: Summary["real"]) => string | number][]).map(([l, f]) => (
                <tr key={l}><td>{l}</td><td><strong>{f(data.real)}</strong></td><td>{f(data.synthetic)}</td></tr>
              ))}
            </tbody>
          </table>
          <Card variant="soft">
            <div className="stack stack--sm">
              <h2 className="h3">Outstanding before the demo</h2>
              <ul className="list-plain">
                <li>{data.real.participants >= 25 ? "✓" : "○"} 25 real consenting participants ({data.real.participants} now)</li>
                <li>{data.real.linkedin.completed + data.real.instagram.completed >= 50 ? "✓" : "○"} Both sources retrieved for everyone ({data.real.linkedin.completed + data.real.instagram.completed} of {data.real.participants * 2})</li>
                <li>{data.real.profiled >= data.real.participants && data.real.participants > 0 ? "✓" : "○"} Every participant profiled</li>
                <li>{data.real.evaluations.total > 0 ? "✓" : "○"} At least one real evaluated date</li>
                <li>○ Published-site real-profile Apify retrieval verified with a consenting participant</li>
              </ul>
            </div>
          </Card>
          <div><Button variant="ghost" onClick={fetchIt}>Refresh counts</Button></div>
        </>
      )}
    </AppShell>
  );
}
