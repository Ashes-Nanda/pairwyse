# PAIRWISE engineering rules

- Backend runs as TanStack server functions (`src/lib/pipeline.functions.ts`) on Lovable Cloud instead of the HLD's FastAPI — the project stack is TanStack Start; the HLD data model and pipeline stages are kept.
- Apify is called only through `src/lib/apify.server.ts` via the connector gateway; actor IDs live there and can be overridden with `APIFY_LINKEDIN_ACTOR_ID` / `APIFY_INSTAGRAM_ACTOR_ID` — one place to swap actors.
- Only normalized, matchmaking-relevant source fields are persisted; raw actor output and contact data (emails/phones) are discarded — privacy.
- AI calls go through `src/lib/ai.server.ts` (Lovable AI Gateway, Responses API, always streamed) — single place for model/provider options.
- Scores and rankings are computed only in `src/lib/ranking.ts` (pure, unit-tested); the model supplies rubric ratings, never the final score — determinism.
- Long work is split into small server-function steps (start/poll ingestion, one agent turn per call, evaluate) orchestrated by the page — keeps each Worker request short and every step persisted.
- Demo records are flagged `participants.is_demo`; the UI must label them as a saved run — honesty requirement.
- Processing refuses participants without recorded consent.
