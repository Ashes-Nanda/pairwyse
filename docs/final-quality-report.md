# PAIRWISE — Final quality pass (2026-10-13)

## Redesign
New Pals-token layout layer (`src/styles.css`) and shared components in `src/components/AppShell.tsx`
(nav/footer, RecordKind, ConfidenceLabel, CriteriaMeter, Timeline, EmptyState, ErrorNote, ConfirmDialog).
Routes: `/` (hero, steps, trust, real counts), `/join` (stepper, consent + 18+), `/participants/$id`
(tabs: Profile · Sources & status timeline · Dates & matches · Privacy & settings with confirm-delete),
`/sessions/$id` (conversation centrepiece, 8-turn indicator, honest states, evidence drawer),
`/match/$sessionId/$evaluatorId` (new breakdown), `/discover` (new, per-participant ranking; single-match
shown as breakdown), `/privacy` (new), `/ops` (new, passcode-gated, real vs synthetic counts).

## Backend changes (minimal)
- `createSession` refuses pairing synthetic fixtures with real participants and unconsented rows.
- `getParticipant` ranking only includes candidates in the same eligible pool.
- `getSession` returns profile claims for the evidence drawer.
- `getOpsSummary` (passcode) added.
- Prompts: per-turn conversation arc, specific-question rule, ban on generic questions and invented memories,
  `isRepetitive` check added to the single corrective retry.

## Tests
`bunx vitest run`: 33/33 passed (29 previous, 2 updated for new prompt wording, 4 new in `quality.test.ts`).
`tsgo --noEmit`: no errors.

## Browser (preview, 1440×1000 and 390×844)
All 9 routes rendered with no page errors. Historical session b49dfa28: match page score 72 equals
recomputed deterministic score (no mismatch alert); 8 messages displayed; single-match discover state shown.
Mobile URL overflow and nav wrap fixed after review.

## Synthetic 8-turn date (fixtures "Fixture Mira"/"Fixture Theo", is_test=true, session bf88a0f9…)
Run in browser with real model calls: reload after 1 message restored transcript; navigated away after 2
(paused), resumed; finished with 8 messages, 8 distinct turns (no duplicates), 2 evaluations created only
after completion. Scores: Mira→Theo 70 (medium; recomputed 70), Theo→Mira no score (low confidence).
Compared with b49dfa28: messages react to the prior line ("A very patient pigeon sounds like a rare
professional"), progress through new topics (bike → Catan → sourdough → teaching), vary length, close
without a question. No invented memories observed. Residual: two mild hedges ("I can't say for sure how the
colour compared…") remain — the heuristic didn't flag them.
Model-failure retry: covered by mocked tests and the previous forced-abort browser test; not re-run.

## Published-site Apify real-profile retrieval
BLOCKED — needs a new consenting adult's LinkedIn + public Instagram. Ash/Ahana not rerun.
