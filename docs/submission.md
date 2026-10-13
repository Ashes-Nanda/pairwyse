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

## Audit (13 Oct 2026)
| Item | Status |
|---|---|
| /join intake, consent + 18+ gate, passcode | Implemented; wrong-passcode rejection verified in browser |
| LinkedIn / Instagram URL validation | Implemented; unit-tested |
| Apify actors, run IDs, status, errors | Implemented; Instagram + LinkedIn actors returned real public data in sandbox; not yet verified in production |
| Evidence-backed profile with quotes | Implemented; verified on synthetic data only |
| 8-message date, one AI call per message, persisted, resumable | Implemented; not yet run on real participants |
| Directional 5-criterion evaluation, null = unknown | Implemented; not yet run on real participants |
| Deterministic ranking, coverage, confidence | Implemented; 7 unit tests pass |
| Demo vs live separation, real counters | Implemented; verified in browser (all counters 0) |
| Data removal | Implemented (passcode-protected delete on profile page) |
| Direct database reads | Blocked for public; all reads go through server code |

**Complete consenting-person run: NOT executed** — needs two consenting adults' URLs.

## Recording checklist
- [ ] 25 consenting participants processed (blocked)
- [ ] At least one completed date with both evaluations (blocked)
- [ ] Public GitHub repo URL (blocked: connect GitHub in editor)
- [ ] Live site verified in a fresh browser
- [ ] Screen recorder at 1280×800, browser zoom 100%, passcode not shown on screen

## Submission text
Overall (164 chars, limit 200):
PAIRWISE: AI agents built from consenting people's LinkedIn and public Instagram hold real text dates, then give evidence-based, directional compatibility rankings.

Technical (447 chars, limit 500):
Apify Actors (harvestapi~linkedin-profile-scraper, apify~instagram-profile-scraper) retrieve source data. TanStack Start server functions run each step; Lovable Cloud persists sources, profiles, messages and evaluations. An LLM via Lovable AI Gateway builds quoted-evidence profiles, writes each of 8 date messages and rates a 5-criterion rubric (0-5 or unknown). Deterministic app code computes scores and rankings; thin evidence yields no score.
