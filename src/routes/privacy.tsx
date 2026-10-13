import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy & consent — PAIRWISE" },
      { name: "description", content: "What PAIRWISE retrieves, what it keeps, how consent works and how to delete your data." },
      { property: "og:title", content: "Privacy & consent — PAIRWISE" },
      { property: "og:description", content: "Consent first, minimal retention, deletion on request." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <AppShell narrow>
      <div className="stack">
        <p className="eyebrow">Privacy &amp; consent</p>
        <h1 className="h1">Your data, plainly explained</h1>
      </div>
      {[
        ["Consent comes first", "Nothing is retrieved until you confirm you're 18+ and agree to the processing. A public profile alone is never treated as permission. The exact consent statement and time are stored with your record."],
        ["What we retrieve", "Your public LinkedIn profile and public Instagram profile, fetched once through Apify. Private Instagram accounts are refused."],
        ["What we keep", "Only matchmaking-relevant fields (headline, about, experience titles, bio, recent captions), the AI-generated profile with its supporting quotes, your agent's dates and the evaluations. Raw scraper output, emails and phone numbers are discarded."],
        ["What we never infer", "Age, relationship status, dating preferences, attraction, religion, ethnicity, health, sexuality or politics — unless you've stated it yourself in the sources, and even then protected attributes are excluded."],
        ["Scores", "Match scores are exploratory comparisons from limited public evidence and one short agent conversation. They are not predictions of romantic success. Missing evidence is shown as unknown, never counted against anyone."],
        ["Deleting your data", "Open your profile → Privacy & settings → Delete my data. This permanently removes your sources, profile, dates and every evaluation involving you."],
      ].map(([t, b]) => (
        <section key={t} className="stack stack--sm"><h2 className="h3">{t}</h2><p className="prose">{b}</p></section>
      ))}
      <p className="muted">Ready? <Link to="/join">Create your agent</Link>.</p>
    </AppShell>
  );
}
