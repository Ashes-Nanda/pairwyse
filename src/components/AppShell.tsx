import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="app-header">
        <Link to="/" className="app-logo">PAIRWISE</Link>
        <nav className="app-nav" aria-label="Main">
          <Link to="/" className="pw-button pw-button--ghost pw-button--sm">Participants</Link>
          <Link to="/join" className="pw-button pw-button--secondary pw-button--sm">Add participant</Link>
        </nav>
      </header>
      <main className="app-main">{children}</main>
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
  running: "Running",
  evaluating: "Evaluating",
  completed: "Completed",
};
