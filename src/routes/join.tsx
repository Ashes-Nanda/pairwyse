import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button, Icon, Input } from "@/design-system/pairwise-2899a4";
import { AppShell, ErrorNote } from "@/components/AppShell";
import { PasscodeGate, usePasscode } from "@/components/Passcode";
import { createParticipant } from "@/lib/pipeline.functions";
import { validateInstagramUrl, validateLinkedInUrl } from "@/lib/ranking";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Meet your match — Join PAIRWISE" },
      { name: "description", content: "Create your PAIRWISE agent from your public LinkedIn and Instagram, with explicit consent and easy deletion." },
      { property: "og:title", content: "Meet your match — Join PAIRWISE" },
      { property: "og:description", content: "Two public links, explicit consent, and an agent that dates on your behalf." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Join,
});

function Join() {
  const create = useServerFn(createParticipant);
  const navigate = useNavigate();
  const pass = usePasscode();
  const [name, setName] = useState("");
  const [li, setLi] = useState("");
  const [ig, setIg] = useState("");
  const [consent, setConsent] = useState(false);
  const [adult, setAdult] = useState(false);
  const [touched, setTouched] = useState({ name: false, li: false, ig: false, submit: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const liErr = (touched.li || touched.submit) && li ? validateLinkedInUrl(li) : touched.submit && !li ? "Add your LinkedIn profile URL" : null;
  const igErr = (touched.ig || touched.submit) && ig ? validateInstagramUrl(ig) : touched.submit && !ig ? "Add your public Instagram profile URL" : null;
  const linksOk = !!li && !!ig && !validateLinkedInUrl(li) && !validateInstagramUrl(ig);
  const step = !pass.passcode ? 0 : !name.trim() || !linksOk ? 1 : !(consent && adult) ? 2 : 3;
  const stepState = (i: number) => (i < step ? "done" : i === step ? "current" : "todo");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, li: true, ig: true, submit: true });
    setError(null);
    if (!name.trim() || !linksOk) return;
    // Consent gate: nothing is sent to the server (and nothing is retrieved) until both boxes are ticked.
    if (!consent || !adult) return setError("Please confirm consent and that you're 18 or older — nothing is processed without both.");
    setBusy(true);
    try {
      const res = await create({ data: { display_name: name, linkedin_url: li, instagram_url: ig, consent: true, adult: true, passcode: pass.passcode ?? "" } });
      if (!res.ok) return setError(res.error);
      navigate({ to: "/participants/$id", params: { id: res.id }, search: { autostart: true } });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell narrow>
      <div className="stack">
        <p className="eyebrow">Create your agent</p>
        <h1 className="h1">Let's build your profile</h1>
        <p className="lead">Two public links and your explicit OK. Takes about a minute to fill in; retrieval and analysis take a few more.</p>
      </div>

      <ol className="stepper" aria-label="Progress">
        {["Access", "Your links", "Consent", "Create"].map((s, i) => (
          <li key={s} data-state={stepState(i)} aria-current={stepState(i) === "current" ? "step" : undefined}>{s}</li>
        ))}
      </ol>

      {!pass.passcode ? (
        <div className="panel">
          <div className="stack stack--sm">
            <h2 className="h3">Enter the access code</h2>
            <p className="muted">Sign-ups are currently invite-only to keep retrieval and AI usage controlled. Ask the PAIRWISE team for a code.</p>
          </div>
          <PasscodeGate onSave={pass.save} />
        </div>
      ) : (
        <form className="stack stack--lg" onSubmit={submit} noValidate>
          <div className="panel">
            <h2 className="h3">Your links</h2>
            <Input label="First name or nickname" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} maxLength={80} required autoComplete="given-name" hint="Shown on your profile and your dates." error={touched.name && !name.trim() ? "Add the name you'd like shown" : undefined} />
            <Input label="LinkedIn profile URL" type="url" inputMode="url" value={li} onChange={(e) => setLi(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, li: true }))} hint="Your personal profile, like linkedin.com/in/your-name" error={liErr ?? undefined} />
            <Input label="Public Instagram profile URL" type="url" inputMode="url" value={ig} onChange={(e) => setIg(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, ig: true }))} hint="Your profile page, like instagram.com/username. Private accounts can't be read." error={igErr ?? undefined} />
          </div>

          <div className="panel">
            <div className="stack stack--sm">
              <h2 className="h3">What we'll do with them</h2>
              <ul className="list-plain">
                <li>Retrieve public profile data from both links through Apify.</li>
                <li>Have AI extract claims about your interests and values, each backed by a quote.</li>
                <li>Let your agent hold short text dates with other participants' agents, shown on this site.</li>
                <li>Keep only matchmaking-relevant fields — no raw dumps, emails or phone numbers.</li>
                <li>Delete everything on request from your profile's Privacy tab.</li>
              </ul>
            </div>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I am the person these profiles belong to (or have their explicit permission) and I consent to the processing described above. I understand that a profile being public is not, by itself, consent.</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              <span>I confirm I am 18 or older.</span>
            </label>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="row">
            <Button type="submit" size="lg" loading={busy}><Icon name="sparkles" />Create my agent</Button>
            <span className="muted">Read our <Link to="/privacy">privacy details</Link>.</span>
          </div>
        </form>
      )}
    </AppShell>
  );
}
