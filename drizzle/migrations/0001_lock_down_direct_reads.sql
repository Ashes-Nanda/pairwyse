DROP POLICY IF EXISTS "public read" ON public.date_messages;
DROP POLICY IF EXISTS "public read" ON public.date_sessions;
DROP POLICY IF EXISTS "public read" ON public.evaluations;
DROP POLICY IF EXISTS "public read" ON public.profiles_analysis;
DROP POLICY IF EXISTS "public read" ON public.source_records;
DROP POLICY IF EXISTS "public read consented" ON public.participants;
REVOKE ALL ON public.date_messages, public.date_sessions, public.evaluations, public.profiles_analysis, public.source_records, public.participants FROM anon, authenticated;
GRANT ALL ON public.date_messages, public.date_sessions, public.evaluations, public.profiles_analysis, public.source_records, public.participants TO service_role;