import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { Button, Icon } from "@/design-system/pairwise-2899a4";

export function AppShell({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <>
      <header className="nav">
        <div className="nav__inner">
          <Link to="/" className="wordmark" aria-label="PAIRWISE home"><span className="wordmark__dot" aria-hidden />PAIRWISE</Link>
          <nav className="nav__links" aria-label="Main">
            <Link to="/discover" className="nav__link">Discover</Link>
            <Link to="/privacy" className="nav__link">Privacy</Link>
            <Link to="/join" className="pw-button pw-button--primary pw-button--sm">Meet your match</Link>
          </nav>
        </div>
      </header>
      <main className={`page${narrow ? " page--narrow" : ""}`}>{children}</main>
      <footer className="footer">
        <div className="footer__inner">
          <span>PAIRWISE · exploratory agent-to-agent matchmaking. Scores are not predictions of romantic success.</span>
          <span className="row"><Link to="/privacy">Privacy &amp; consent</Link><Link to="/ops">Operations</Link></span>
        </div>
      </footer>
    </>
  );
}

export function statusBadge(status: string): "pending" | "running" | "completed" | "partial" | "failed" | "insufficient" {
  if (["profiled", "completed", "ingested"].includes(status)) return "completed";
  if (["ingesting", "analyzing", "running", "evaluating"].includes(status)) return "running";
  if (status === "partial") return "partial";
  if (["failed", "analysis_failed"].includes(status)) return "failed";
  return "pending";
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ingesting: "Retrieving sources",
  ingested: "Sources retrieved",
  partial: "Partial sources",
  failed: "Failed",
  analyzing: "Analysing",
  analysis_failed: "Analysis failed",
  profiled: "Profile ready",
  running: "In progress",
  evaluating: "Evaluating",
  completed: "Completed",
};

/** Synthetic / saved-demo / live label. Honesty requirement: never present fixtures as real people. */
export function RecordKind({ isDemo, isTest }: { isDemo?: boolean; isTest?: boolean }) {
  if (isTest) return <span className="tag tone-yellow"><Icon name="alert" size="sm" />Synthetic test fixture — not a real person</span>;
  if (isDemo) return <span className="tag tone-lavender"><Icon name="clock" size="sm" />Saved demo run</span>;
  return <span className="tag tone-blue"><Icon name="check" size="sm" />Live participant</span>;
}

export function ConfidenceLabel({ value }: { value: string }) {
  const v = (["high", "medium", "low"].includes(value) ? value : "low") as "high" | "medium" | "low";
  return <span className={`conf conf--${v}`}>{v.charAt(0).toUpperCase() + v.slice(1)} confidence</span>;
}

/** Rated-criteria meter: n of 5 filled segments, with text. */
export function CriteriaMeter({ rated, total = 5 }: { rated: number; total?: number }) {
  return (
    <span className="row" style={{ gap: "var(--space-2)" }}>
      <span className="meter" aria-hidden>{Array.from({ length: total }, (_, i) => <span key={i} data-on={i < rated} />)}</span>
      <span className="meta">{rated} of {total} criteria rated</span>
    </span>
  );
}

export function EmptyState({ icon = "search", title, children }: { icon?: Parameters<typeof Icon>[0]["name"]; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size="lg" />
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function ErrorNote({ children, onRetry, retryLabel = "Try again" }: { children: ReactNode; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div className="alert" role="alert">
      <Icon name="alert" size="sm" />
      <div className="stack stack--sm">
        <span>{children}</span>
        {onRetry && <div><Button size="sm" variant="secondary" onClick={onRetry}>{retryLabel}</Button></div>}
      </div>
    </div>
  );
}

/** Native <dialog> confirmation — keyboard accessible, Escape cancels. */
export function ConfirmDialog({ open, title, body, confirmLabel, danger, onConfirm, onCancel }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); onCancel(); }} aria-labelledby="dlg-title">
      <div className="stack">
        <h2 id="dlg-title" className="h3">{title}</h2>
        <div className="muted">{body}</div>
        <div className="row">
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </dialog>
  );
}

export type TimelineState = "pending" | "running" | "completed" | "failed" | "partial";
export function Timeline({ steps }: { steps: { title: string; state: TimelineState; detail?: ReactNode }[] }) {
  const icon: Record<TimelineState, Parameters<typeof Icon>[0]["name"]> = { pending: "clock", running: "loading", completed: "check", failed: "alert", partial: "alert" };
  const label: Record<TimelineState, string> = { pending: "Waiting", running: "In progress", completed: "Done", failed: "Failed", partial: "Partial" };
  return (
    <ol className="timeline">
      {steps.map((s) => (
        <li key={s.title} className="timeline__item" data-state={s.state}>
          <span className="timeline__dot"><Icon name={icon[s.state]} size="sm" /></span>
          <div className="timeline__body">
            <strong>{s.title} <span className="meta">· {label[s.state]}</span></strong>
            {s.detail && <div className="muted">{s.detail}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export const CRITERION_LABEL: Record<string, string> = {
  shared_interests: "Shared interests",
  values_alignment: "Values alignment",
  conversation_quality: "Conversation quality",
  lifestyle_compatibility: "Lifestyle compatibility",
  stated_preferences_fit: "Stated-preference fit",
};
