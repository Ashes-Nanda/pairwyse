import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button, Icon, Input } from "@/design-system/pairwise-2899a4";
import { AppShell } from "@/components/AppShell";
import { PasscodeGate, usePasscode } from "@/components/Passcode";
import { createParticipant } from "@/lib/pipeline.functions";
import { validateInstagramUrl, validateLinkedInUrl } from "@/lib/ranking";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Add a participant — PAIRWISE" },
      { name: "description", content: "Submit a consenting participant's LinkedIn and public Instagram profile to create their AI dating agent." },
      { property: "og:title", content: "Add a participant — PAIRWISE" },
      { property: "og:description", content: "Create an evidence-backed AI agent from two public profiles." },
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
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const liErr = touched ? validateLinkedInUrl(li) : null;
  const igErr = touched ? validateInstagramUrl(ig) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!name.trim() || validateLinkedInUrl(li) || validateInstagramUrl(ig)) return;
    if (!consent || !adult) return setError("Consent and age confirmation are required before any processing.");
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
    <AppShell>
      <div className="col">
        <h1 className="page-title">Add a participant</h1>
        <p className="muted">Only add yourself, or someone who has explicitly agreed. Instagram must be public.</p>
      </div>
      {!pass.passcode ? <PasscodeGate onSave={pass.save} /> : (
      <form className="form" onSubmit={submit} noValidate>
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required error={touched && !name.trim() ? "Enter a name" : undefined} />
        <Input label="LinkedIn profile URL" type="url" value={li} onChange={(e) => setLi(e.target.value)} placeholder="https://www.linkedin.com/in/your-name" error={liErr ?? undefined} />
        <Input label="Public Instagram profile URL" type="url" value={ig} onChange={(e) => setIg(e.target.value)} placeholder="https://www.instagram.com/username" error={igErr ?? undefined} />
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I am this person or have their explicit permission, and consent to their public LinkedIn and Instagram data being retrieved, analysed by AI, and used by an AI agent in simulated dates shown on this site.</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
          <span>The participant is 18 or older.</span>
        </label>
        {error && <div className="alert" role="alert">{error}</div>}
        <div><Button type="submit" loading={busy}><Icon name="sparkles" />Create agent</Button></div>
      </form>
      )}
    </AppShell>
  );
}
