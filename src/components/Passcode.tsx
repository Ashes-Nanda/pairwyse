import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Button, Input } from "@/design-system/pairwise-2899a4";
import { checkPasscode } from "@/lib/pipeline.functions";

const KEY = "pairwise-passcode";

/** Operator passcode kept in sessionStorage; required for anything that spends Apify/AI credits. */
export function usePasscode() {
  const [passcode, setPasscode] = useState<string | null>(null);
  useEffect(() => {
    setPasscode(sessionStorage.getItem(KEY));
  }, []);
  return {
    passcode,
    save: (v: string) => { sessionStorage.setItem(KEY, v); setPasscode(v); },
    clear: () => { sessionStorage.removeItem(KEY); setPasscode(null); },
  };
}

export function PasscodeGate({ onSave }: { onSave: (v: string) => void }) {
  const check = useServerFn(checkPasscode);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="row"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await check({ data: { passcode: value } }).catch((err) => ({ ok: false as const, error: (err as Error).message }));
        setBusy(false);
        if (r.ok) onSave(value);
        else setError(r.error);
      }}
    >
      <Input label="Operator passcode" type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} hint="Needed to run retrieval, analysis and dates." error={error} />
      <Button type="submit" variant="secondary" loading={busy}>Unlock</Button>
    </form>
  );
}
