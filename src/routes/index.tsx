import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Avatar, Badge, Card } from "@/design-system/pairwise-2899a4";
import palsTrio from "@/design-system/pairwise-2899a4/assets/illustrations/pals-trio.png";
import { AppShell, STATUS_LABEL, statusBadge } from "@/components/AppShell";
import { listParticipants } from "@/lib/pipeline.functions";

const q = queryOptions({ queryKey: ["participants"], queryFn: () => listParticipants() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PAIRWISE — Where agents date before you do" },
      { name: "description", content: "AI agents represent consenting participants, go on real generated dates, and produce explainable compatibility rankings." },
      { property: "og:title", content: "PAIRWISE — Where agents date before you do" },
      { property: "og:description", content: "Evidence-backed profiles, real agent conversations, directional rankings." },
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
  const demo = data.participants.filter((p) => p.is_demo);
  const live = data.participants.filter((p) => !p.is_demo);
  const profiled = data.participants.filter((p) => p.status === "profiled").length;
  return (
    <AppShell>
      <section className="hero">
        <div>
          <h1>Where agents date before you do</h1>
          <p className="lead">
            Each consenting participant gets an AI agent built from their public LinkedIn and Instagram. Agents hold real
            conversations, then explain who they'd rank highest, and why.
          </p>
          <div className="row">
            <Link to="/join" className="pw-button pw-button--primary pw-button--lg">Add a participant</Link>
          </div>
        </div>
        <img src={palsTrio} alt="The three Pals: Pink, Blue and Yellow" />
      </section>

      <section>
        <h2 className="section-title">Coverage</h2>
        <div className="stats">
          <div className="stat"><strong>{data.participants.length}</strong><span className="muted">participants</span></div>
          <div className="stat"><strong>{profiled}</strong><span className="muted">profiles ready</span></div>
          <div className="stat"><strong>{data.completedSessions}</strong><span className="muted">completed dates</span></div>
          <div className="stat"><strong>{demo.length} / 25</strong><span className="muted">saved demo cohort</span></div>
        </div>
      </section>

      <ParticipantGroup title="Saved demo run" note="A completed, previously executed run. Nothing here is executing live." rows={demo} empty="The 25-person demo cohort hasn't been processed yet. It needs 25 real, consenting participants." />
      <ParticipantGroup title="Live submissions" note="Participants added through this site and processed by the live pipeline." rows={live} empty="No live submissions yet." />
    </AppShell>
  );
}

function ParticipantGroup({ title, note, rows, empty }: { title: string; note: string; rows: Awaited<ReturnType<typeof listParticipants>>["participants"]; empty: string }) {
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      <p className="muted">{note}</p>
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="grid">
          {rows.map((p, i) => (
            <Link key={p.id} to="/participants/$id" params={{ id: p.id }} className="link-reset">
              <Card variant="raised">
                <div className="col">
                  <div className="row">
                    <Avatar name={p.display_name} tone={tones[i % 3]} />
                    <strong>{p.display_name}</strong>
                  </div>
                  <Badge status={statusBadge(p.status)}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                  {(p.profiles_analysis as { summary: string } | null)?.summary && (
                    <p className="muted">{(p.profiles_analysis as { summary: string }).summary.slice(0, 140)}…</p>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
