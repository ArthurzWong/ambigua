# Submission checklist — Ambigua

Status of every required item. Full portal copy lives in [`submission.md`](submission.md).

## Required by the hackathon

- [x] **Project title** — *Ambigua — resolve ambiguous asks with workspace context*
- [x] **Written description** — see [`submission.md`](submission.md)
- [x] **Public GitHub repository** — https://github.com/ArthurzWong/ambigua (public, `main`)
- [x] **Two-minute demonstration video** — recorded → `docs/assets/demo.mp4` (~2 min, narrated)
  - [ ] Host it publicly (YouTube/Loom/Drive) and paste the URL into the portal
- [x] **Social media post** — finalized in [`social-post.md`](social-post.md)
  - [ ] Publish it, tagging the event partners
- [ ] **Portal submission** completed before the deadline
  - [ ] Replace remaining `[ ... ]` placeholders in `submission.md`

## Eligibility (net-new build)

- [x] Core functionality built during the event (engine, LLM layer, UI, tests)
- [x] Only generic building blocks reused (Node stdlib, browser APIs)
- [x] Can explain which parts were created during the hackathon (see `submission.md`)

## Verification (green)

- [x] `npm start` works on a clean machine (Node 18+, no `npm install`)
- [x] `npm run smoke` → four expected engine outcomes (offline)
- [x] `npm run uitest` → **30/30** headless UI checks
- [x] `npm run llmtest` → live provider answers (Ollama `gemma3:12b`)
- [x] Live data verified (`dir:<path>` source resolved real files)

## Nice-to-have for judges

- [x] Screenshots + architecture + value-map diagrams in `docs/assets/`
- [x] Demo video + poster in `docs/assets/`
- [x] Repo description + topics set
