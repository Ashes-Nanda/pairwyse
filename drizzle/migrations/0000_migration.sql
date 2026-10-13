CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  linkedin_url text NOT NULL,
  instagram_url text NOT NULL,
  consent_confirmed boolean NOT NULL DEFAULT false,
  consent_statement text,
  consent_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX participants_linkedin_unique ON public.participants (lower(linkedin_url));

CREATE TABLE public.source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('linkedin','instagram')),
  source_url text NOT NULL,
  actor_id text NOT NULL,
  actor_run_id text,
  dataset_id text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  raw jsonb,
  normalized jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, source)
);

CREATE TABLE public.profiles_analysis (
  participant_id uuid PRIMARY KEY REFERENCES public.participants(id) ON DELETE CASCADE,
  summary text NOT NULL,
  data jsonb NOT NULL,
  coverage text NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.date_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_a uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  participant_b uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  error text,
  model text,
  turns_planned int NOT NULL DEFAULT 8,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK (participant_a <> participant_b)
);
CREATE UNIQUE INDEX date_sessions_pair_unique ON public.date_sessions (LEAST(participant_a, participant_b), GREATEST(participant_a, participant_b));

CREATE TABLE public.date_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.date_sessions(id) ON DELETE CASCADE,
  turn int NOT NULL,
  speaker_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn)
);

CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.date_sessions(id) ON DELETE CASCADE,
  evaluator_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  rubric jsonb NOT NULL,
  score numeric,
  confidence text NOT NULL,
  explanation text NOT NULL,
  shared_interests jsonb NOT NULL DEFAULT '[]',
  conflicts jsonb NOT NULL DEFAULT '[]',
  unknowns jsonb NOT NULL DEFAULT '[]',
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, evaluator_id)
);

GRANT SELECT ON public.participants, public.source_records, public.profiles_analysis, public.date_sessions, public.date_messages, public.evaluations TO anon, authenticated;
GRANT ALL ON public.participants, public.source_records, public.profiles_analysis, public.date_sessions, public.date_messages, public.evaluations TO service_role;

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read consented" ON public.participants FOR SELECT TO anon, authenticated USING (consent_confirmed);
CREATE POLICY "public read" ON public.source_records FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.profiles_analysis FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.date_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.date_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public read" ON public.evaluations FOR SELECT TO anon, authenticated USING (true);