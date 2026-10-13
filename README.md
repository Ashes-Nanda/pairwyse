# PAIRWISE — Where agents date before you do

PAIRWISE is an agentic matchmaking prototype. Each consenting participant gets an AI agent built from two sources: their LinkedIn profile and their public Instagram. Agents hold real multi-turn conversations, evaluate each other directionally, and the app ranks candidates deterministically.

**Pipeline:** Intake (consent) → Apify retrieval (LinkedIn + Instagram) → evidence-backed profile → 8-turn agent date → two directional evaluations → per-participant ranking.

## Stack

- TanStack Start (React 19, Vite) on an edge Worker runtime. The HLD named FastAPI; the same stages and data model are implemented as server functions.
- Lovable Cloud (Postgres) for persistence.
- Apify through the Lovable connector gateway:
  - LinkedIn: `harvestapi~linkedin-profile-scraper`, input `{ "urls": [url] }`
  - Instagram: `apify~instagram-profile-scraper`, input `{ "usernames": [name], "resultsLimit": 12 }`
- Lovable AI Gateway (`openai/gpt-6-astra`, Responses API, streamed) for profile analysis, agent turns and evaluation.
- Pals design system (`src/design-system/pairwise-2899a4`).

## Key files

| Path | Purpose |
|---|---|
| `src/lib/apify.server.ts` | Apify adapter: start run, poll, read dataset, normalize (drops emails/phones) |
| `src/lib/ai.server.ts` | AI gateway helpers (structured output and text) |
| `src/lib/ranking.ts` | Deterministic score from rubric, ranking, URL validation (unit-tested) |
| `src/lib/pipeline.functions.ts` | All server functions: intake, ingestion, analysis, dates, evaluation, reads |
| `src/routes/` | `/` overview + coverage, `/join` intake, `/participants/$id`, `/sessions/$id` |

## Environment variables (server-side only)

| Name | Required | Purpose |
|---|---|---|
| `LOVABLE_API_KEY` | yes (auto-provisioned) | Lovable AI Gateway and connector gateway auth |
| `APIFY_API_KEY` | yes (set by linking the Apify connector) | Apify connection key for the gateway |
| `INTAKE_PASSCODE` | yes | Operator passcode required for intake and every credit-spending action; without it processing is disabled |
| `APIFY_LINKEDIN_ACTOR_ID` | optional | Override LinkedIn actor (default `harvestapi~linkedin-profile-scraper`) |
| `APIFY_INSTAGRAM_ACTOR_ID` | optional | Override Instagram actor (default `apify~instagram-profile-scraper`) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*` | auto | Managed by Lovable Cloud |

No secret is committed. Put them in the hosting secret store.

## Scoring

The evaluator rates five criteria from 0 to 5, or null when evidence is insufficient: shared interests 30%, values 25%, conversation quality 20%, lifestyle 15%, stated preferences 10%. The score is a weighted mean over the rated criteria. It is withheld when confidence is low or fewer than 3 criteria are rated, because missing data is never counted as negative. Ranking orders by score, then confidence, then id.

## Honesty rules

- Processing refuses participants without recorded consent and 18+ confirmation. Private Instagram accounts fail eligibility.
- `participants.is_demo` marks the saved demo cohort. The UI labels it "Saved demo run" and keeps it separate from live submissions.
- Interrupted dates, failed evaluations and partial (one-source) profiles are shown as such. Unevaluated pairs are never ranked.

## Tests

```
bunx vitest run
```

## Running locally

```
bun install
bun run dev
```

You need the environment variables above. The database schema is in `drizzle/migrations/`.

## Security & data removal
- The database blocks all direct public reads; pages read only through server functions, which return consenting participants only.
- Every action that spends Apify/AI credits or deletes data requires `INTAKE_PASSCODE`.
- Delete a participant (and all derived data) from the bottom of their profile page once unlocked.
- Copy `.env.example` for variable names; never commit values.
