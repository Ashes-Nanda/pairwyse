ALTER TABLE public.profiles_analysis ADD COLUMN IF NOT EXISTS input_hash text;
ALTER TABLE public.evaluations ADD COLUMN IF NOT EXISTS criteria_evidence jsonb;
ALTER TABLE public.participants ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles_analysis.input_hash IS 'SHA-256 of the source inputs used; mismatch = stale analysis. NULL for legacy rows.';
COMMENT ON COLUMN public.evaluations.criteria_evidence IS 'Per-criterion reason + validated evidence refs. NULL for legacy evaluations.';
COMMENT ON COLUMN public.participants.is_test IS 'Isolated QA fixtures; excluded from public lists, counters and candidate pools.';