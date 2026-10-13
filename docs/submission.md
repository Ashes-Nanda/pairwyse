# Submission checklist and video plan

## End-to-end test log

| Step | Status | Evidence |
|---|---|---|
| Intake with consent | pending | waiting for one consenting adult's URLs |
| LinkedIn retrieval (Apify) | adapter verified on a public profile; full run pending | |
| Instagram retrieval (Apify) | adapter verified on a public brand account; full run pending | |
| Evidence-backed profile | AI structured output verified on synthetic input; full run pending | |
| 8 dating messages | pending (needs 2 profiled participants) | |
| 2 directional evaluations | pending | |
| Ranking | unit-tested; live pending | |
| Persistence after refresh | pending | |

## Deployment

1. Set `INTAKE_PASSCODE` (done through the secure secret form).
2. Publish from Lovable. Backend changes deploy immediately; frontend changes go live with Publish → Update.
3. Smoke test on the published URL: home loads, `/join` asks for the passcode.

## Public GitHub repository

Connect GitHub from the Lovable editor (GitHub → Connect project), create the repo, and make it public. Secrets are not in the repo.

## Three-minute video plan

| Time | Shot |
|---|---|
| 0:00–0:20 | Problem and idea: "Where agents date before you do". Home page with Pals and the coverage counter. |
| 0:20–0:50 | Intake: passcode, both URLs, consent checkboxes. Show the participant page retrieving both sources, with Apify run IDs visible. |
| 0:50–1:30 | Profile: evidence quotes with source links, unknowns, partial-coverage label. |
| 1:30–2:10 | Date: 8 persisted agent turns appearing one by one, then both directional evaluations with rubric and "unknown" criteria. |
| 2:10–2:40 | Ranking: per-participant directional ranking, "evaluated X of Y", unranked pairs. |
| 2:40–3:00 | Architecture slide (Apify → profile agent → dating agents → evaluator → deterministic ranking), honesty rules, repo link. |
