# Hardening report — 13 Oct 2026

The original run `b49dfa28…` (Ash, Ahana) was not modified or rerun. All new tests used synthetic fixtures flagged `is_test` (QA Fixture A–D), which never appear in public lists, counters or real candidate pools.

## 1. Duplicate profile analysis
**Cause:** in `src/routes/participants.$id.tsx` the `act()` helper cleared `busy` *before* refetching the participant. Clearing `busy` re-ran the auto-orchestration effect while the cached status was still `ingested`, so it called `analyzeProfile` a second time. The gateway timings match: the second call started about 3 s after the first finished. The server had no guard against this.

**Fix:**
- Client: refetch before clearing `busy`, plus a one-shot `autoAnalyzed` ref.
- Server (`src/lib/analysis.ts`, used by `analyzeProfile`):
  - Takes a SHA-256 of the usable source inputs and saves it as `profiles_analysis.input_hash`.
  - Reuses the saved profile when the inputs are unchanged.
  - Claims the participant with an atomic conditional status update (`→ analyzing`), so only one concurrent caller runs the model.
  - Re-claims a stale claim after 3 minutes.
  - On failure, sets `analysis_failed` without touching the profile row, so it can be retried.
  - The UI shows "stale" when the sources changed. Regeneration is deliberate: the "Regenerate" button, or `force` from "Re-run analysis".

## 2. Coverage and score communication
- The card previously showed the evaluator's own profile coverage. It now uses `matchCoverage(evaluator, candidate)`: Full only when both profiles were built from 2 of 2 sources.
- Cards now show:
  - how many of the 5 criteria were rated, and which are unknown;
  - why a score is missing (low confidence, or fewer than 3 criteria rated);
  - the line "exploratory comparison … not a prediction of romantic success".
- Scoring rules are unchanged.

## 3. Conversation prompt
- `src/lib/prompts.ts` replaces the old instruction "say you're not sure / it isn't in your profile", which caused the defensive tone. Agents now share one supported detail and ask one open question, and are told not to announce unknowns.
- Unsupported personal facts (age, relationship status, preferences, attraction) are forbidden.
- The closing turns must not imply a romantic outcome.
- `composeTurn` regenerates once (at most 2 calls) if a reply matches the defensive or unsupported-fact patterns. These checks are heuristic.

## 4. Evaluation evidence
- New nullable column `evaluations.criteria_evidence` (migration 0002). Each criterion stores a score, a reason and evidence refs.
- Refs are validated against existing profile claims (`E.*`/`C.*`) and messages (`M<n>`). Unknown refs are kept in `dropped_refs` and never displayed as evidence.
- Legacy rows show "Not recorded (legacy evaluation)".
- Categorical confidence is unchanged; no numeric confidence was added.

## 5. Refresh / resume (preview, fixtures A × B, session 6ce3678a…)
| Step | Result |
|---|---|
| Start a session, wait until 2 messages are saved | PASS (2 saved) |
| Refresh: transcript and status restored | PASS: 2 messages shown, status `running`, "Interrupted 2 of 8" notice |
| Simulated failure (next server call aborted at the network) | PASS: clear error shown, still 2 messages in the database |
| Resume to completion | PASS: turns 0–7, 8 distinct, no duplicates |
| Evaluation only after 8 messages | PASS: 2 evaluations, both with criterion evidence |
| Refresh after completion | PASS: 8 messages |
| Model failure inside the server (not network) | Covered by mocked unit tests only. **Browser: NOT TESTED** |

Also fixed: "Resume" on a `failed` session previously did nothing. It now continues the turns, or moves on to evaluation if all 8 messages exist.

## 6. Screen vs database (original run, preview)
- Ash's page shows 71, Medium confidence, Full match coverage, 3 of 5 criteria rated. This matches the database (Ash → Ahana: 71, medium; both profiles full).
- Ahana's page shows 72, Medium, Full, 4 of 5. Matches.
- Session page: the 8 messages are identical to the database text, and the scores are 71% and 72%.
- Opening and refreshing these pages changed no database rows (participants, profiles, messages and evaluations were compared before and after).

## 7. Published site (https://pal-matchmaker-app.lovable.app)
| Check | Result |
|---|---|
| New version live | PASS |
| Home counters exclude fixtures | PASS (2 participants, 1 date, 2 evaluations) |
| Production passcode configured | PASS |
| AI date + evaluation (fixtures A × D, session 4cf5d825…) | PASS: 8/8 messages, 2 evaluations with evidence, 8 messages after refresh |
| Apify credentials in production | PASS: real runs started (LinkedIn `QLIGKOIA5OdyvfkFp`, Instagram `5l6HHznJmOIhFkp8R`) |
| Apify retrieving real data in production | **NOT TESTED**: needs a consenting real person. The made-up fixture links correctly returned "not found", and the page shows that clearly |

Preview and production share one database, so fixture rows live in that database, hidden by `is_test`.

## Tests
`bunx vitest run`: 29/29 passed (ranking.test.ts 7, hardening.test.ts 22).

## Remaining risks
- The defensive and unsupported-fact checks are pattern-based. They can miss paraphrases or flag harmless text.
- Ash's and Ahana's profiles predate `input_hash` (shown as legacy). Pressing "Re-run analysis" will regenerate them.
- With thin fixtures, the conversation still repeats the same topics.
- Two browser tabs running the same session at once could each make a model call for the same turn. The unique turn constraint stops a duplicate message, but credits are wasted.
