# Submission Checklist — Ambigua

Every team must submit the items below. Tick them off in order; the repo and video take the longest.

## Required by the hackathon

- [ ] **Project title** — *Ambigua — resolve ambiguous asks with workspace context*
- [ ] **Written description** — reuse §1–§3 of `BLUEPRINT.md` (one-liner, why, insight)
- [ ] **Public GitHub repository**
  - [ ] `README.md` with run instructions (`npm start` → http://localhost:4321)
  - [ ] `BLUEPRINT.md` committed
  - [ ] `LICENSE` (MIT included)
  - [ ] No secrets committed (`.env` is gitignored; `.env.example` only)
- [ ] **2-minute demonstration video** — follow `docs/demo-script.md`
- [ ] **Social media post** tagging the event partners — draft in `docs/social-post.md`
- [ ] **Portal submission** completed before the deadline

## Eligibility (net-new build)

- [ ] Core functionality (engine + UI + context model) built **during** the event — all net-new
- [ ] Reused items are only generic building blocks (Node's stdlib, browser APIs). None were submitted before.
- [ ] You can explain, on request, **which parts were created during the hackathon**: `src/agent.js`, `src/context.js`, `server.js`, `public/*`, `scripts/smoke.js`

## Pre-flight (5 minutes before submitting)

- [ ] `cd ambigua && npm start` works on a clean machine (Node 18+, no `npm install` needed)
- [ ] `npm run smoke` prints four sensible resolutions
- [ ] `?demo=1` auto-runs the flagship ask
- [ ] Repo is **public** and the link opens logged-out
- [ ] Video is ≤ 2:00 and viewable without a login
- [ ] Social post includes the partner handles

## Nice-to-have proof for judges

- [ ] Screenshot of a resolution card in the README (`docs/assets/screenshot-desktop.png`)
- [ ] A line in the description like: *"the scoring is explainable — every interpretation shows its evidence"*
