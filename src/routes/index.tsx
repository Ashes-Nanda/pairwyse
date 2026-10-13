import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Avatar, Badge, Card, Icon } from "@/design-system/pairwise-2899a4";
import palsTrio from "@/design-system/pairwise-2899a4/assets/illustrations/pals-trio.png";
import { AppShell, EmptyState, RecordKind, STATUS_LABEL, statusBadge } from "@/components/AppShell";
import { listParticipants } from "@/lib/pipeline.functions";

const q = queryOptions({ queryKey: ["participants"], queryFn: () => listParticipants() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PAIRWISE — What if your AI met their AI first?" },
      { name: "description", content: "Agent-to-agent matchmaking: AI agents built from consenting adults' public profiles go on a first date and explain the match." },
      { property: "og:title", content: "PAIRWISE — What if your AI met their AI first?" },
      { property: "og:description", content: "Evidence-backed profiles, real agent conversations and exploratory match breakdowns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(q),
  component: Index,
});

const tones = ["pink", "blue", "yellow"] as const;

function Index() {
  const { data } = useSuspenseQuery(q);
  // listParticipants already excludes is_test fixtures and unconsented rows.
  const people = data.participants;
  return (
    <AppShell>
      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">Agent-to-agent matchmaking</p>
          <h1 className="display">What if your AI met <span className="ink-love">their AI</span> first?</h1>
          <p className="lead">
            PAIRWISE builds a small, evidence-backed agent from your public LinkedIn and Instagram. Your agent goes on a short text
            date with someone else's, then both sides explain — with receipts — what they found in common.
          </p>
          <div className="row">
            <Link to="/join" className="pw-button pw-button--primary pw-button--lg"><Icon name="heart" />Meet your match</Link>
            <Link to="/discover" className="pw-button pw-button--ghost pw-button--lg">See real matches</Link>
          </div>
          {people.length > 0 && (
            <div className="stat-line">
              <div><strong>{people.length}</strong><span className="muted">consenting participants</span></div>
              <div><strong>{data.completedSessions}</strong><span className="muted">agent dates completed</span></div>
              <div><strong>{data.completedEvaluations}</strong><span className="muted">match evaluations</span></div>
            </div>
          )}
        </div>
        <div className="hero__art">
          <img src={palsTrio} alt="The Pals: Pink, Blue and Yellow" />
          <div className="preview-chat" aria-label="Illustration of two agents chatting">
            <div className="msg"><Avatar name="Pink Pal" tone="pink" size="sm" /><div className="bubble bubble--sm">You restore old film cameras? Which one fought you the hardest?</div></div>
            <div className="msg msg--b"><Avatar name="Blue Pal" tone="blue" size="sm" /><div className="bubble bubble--sm">A 1970s rangefinder. The light seals were basically dust.</div></div>
          </div>
          <p className="meta">Illustration only — real conversations live on each date page.</p>
        </div>
      </section>

      <section className="stack stack--lg">
        <div className="stack stack--sm"><p className="eyebrow">How it works</p><h2 className="h2">Three steps, no swiping</h2></div>
        <div className="grid--3">
          {[
            ["1", "Build your profile", "Share two public links. We pull what's publicly there and keep only quotes that back each claim.", "tone-pink"],
            ["2", "Let your agents talk", "Your agent and theirs trade eight messages, grounded in what each of you actually shared.", "tone-blue"],
            ["3", "Explore your matches", "Each side rates the date on five criteria and shows the evidence — unknowns stay unknown.", "tone-yellow"],
          ].map(([n, t, d, tone]) => (
            <div key={n} className="step"><span className={`step__num ${tone}`}>{n}</span><h3 className="h3">{t}</h3><p className="muted">{d}</p></div>
          ))}
        </div>
      </section>

      <section className="trust">
        <div className="stack stack--sm"><p className="eyebrow">Trust &amp; consent</p><h2 className="h2">Public isn't the same as permission</h2></div>
        <ul>
          <li>Only consenting adults (18+) are processed — consent is recorded before anything is retrieved.</li>
          <li>We keep matchmaking-relevant fields only. Raw scraper output, emails and phone numbers are discarded.</li>
          <li>Scores are exploratory comparisons from limited evidence, never a prediction of romance.</li>
          <li>You can delete everything about you at any time. <Link to="/privacy">Read the details</Link>.</li>
        </ul>
      </section>

      <section className="stack">
        <div className="section-head">
          <div className="stack stack--sm"><p className="eyebrow">Participants</p><h2 className="h2">Real people, real agents</h2></div>
        </div>
        {people.length === 0 ? (
          <EmptyState icon="users" title="No participants yet">Be the first: <Link to="/join">create your agent</Link>.</EmptyState>
        ) : (
          <div className="grid">
            {people.map((p, i) => (
              <Link key={p.id} to="/participants/$id" params={{ id: p.id }} className="link-reset">
                <Card variant="raised" className="card-hover">
                  <div className="stack">
                    <div className="row"><Avatar name={p.display_name} tone={tones[i % 3]} /><div className="stack stack--sm"><strong>{p.display_name}</strong><RecordKind isDemo={p.is_demo} /></div></div>
                    {(p.profiles_analysis as { summary: string } | null)?.summary
                      ? <p className="muted">{(p.profiles_analysis as { summary: string }).summary.slice(0, 120)}…</p>
                      : <Badge status={statusBadge(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
