# Ambigua — Hackathon Blueprint
### Track: *Best Use of Ambiguous AI*
**Deliverable:** an agent for a place people already work, talk, or live, that is *meaningfully more useful because of that context.*

---

## 1. The one-liner

**Ambigua** is an agent that lives where your team already talks (Slack-style channels) and turns **ambiguous asks into resolved, grounded actions** by reasoning over the workspace context around the request.

> *"hey can you pull the numbers for the thing we talked about yesterday?"*
> → Ambigua: *"Did you mean **Q3 churn numbers** or **Q3 acquisition funnel**?"* — then, once you pick, it returns the file + the exact messages that justify the choice.

## 2. Why this wins the track (and the day)

- **It is literally about ambiguity.** The track is *Best Use of Ambiguous AI*; most teams will show a clever tool. This shows the *hard part* — deciding what a human even meant — and makes it the visible product.
- **The environment is load-bearing, not decorative.** Remove the channel, the timestamps, the folder, the calendar, and the agent has nothing to reason on. That's exactly the "meaningfully more useful because of that context" bar.
- **It demos in 30 seconds.** One vague sentence → a ranked, explainable resolution. No setup, no data entry.
- **It's honest about uncertainty.** It asks *one* good question instead of hallucinating — the single most trustworthy behavior an agent can show.
- **It's feasible in a day.** The engine is deterministic and readable; the UI is one page. (The starter in this repo already works.)

## 3. The insight

Agents fail in the real world because **people are vague**, and vague requests are only resolvable *in context*. The signals that resolve ambiguity are already sitting around the request:

| Signal | Resolves |
|---|---|
| Which **channel** it was asked in | topic domain |
| **When** it was asked ("yesterday") | which items are relevant |
| **What files/docs** exist nearby | "the numbers", "the deck" |
| **Recent messages** in the thread | "the thing we talked about" |
| **Calendar** + attendees | "the meeting" |
| **Who** was involved ("we", "them") | scope / audience |

Ambigua's job is to turn those signals into a **ranked set of interpretations**, and to *know when it doesn't know*.

## 4. The core interaction (the "money moment")

1. A user posts an ambiguous ask in a channel.
2. Ambigua returns a **resolution card** containing:
   - the detected **ambiguity tags** (referential / temporal / scope / multiple-plausible / underspecified),
   - the **ranked interpretations** with a confidence bar and, for each, the **evidence** that supports it ("matches *numbers* · fits the time window · same channel"),
   - either a **grounded answer with sources**, or **one crisp question** with the top interpretations as quick-pick buttons.
3. The user taps an option → the agent **commits** and returns the artifact with sources.

The card is the pitch: you can *see the agent think*, and you can *see the context win*.

## 5. Scope

**In scope (must ship):**
- Workspace context model (channels, people, files, messages, calendar).
- Signal extraction (referential / temporal / scope).
- Ranking engine with explainable scores + confidence gate.
- Two outcomes: grounded answer *or* single clarifying question.
- Confirmation → commit flow.
- **Team Memory** learning loop + **value meter** + **proactive channel scan**.
- Polished single-page UI with a live "context in view" panel.

**Out of scope (say no in the pitch):**
- Real OAuth/Slack install (mock the context shape instead).
- Multi-user auth, persistence, background jobs.
- Perfect NLU — the heuristic engine is intentionally legible; the LLM path is a drop-in comparison.

## 6. Architecture

```
┌──────────────┐   ┌──────────────────────┐   ┌───────────────────┐   ┌──────────────┐
│ Ambiguous    │──▶│ Context layer        │──▶│ Ranking engine    │──▶│ Confidence   │
│ ask (text)   │   │ channels/files/msgs/ │   │ token match +     │   │ gate         │
└──────────────┘   │ calendar             │   │ recency + channel │   └──────┬───────┘
                   └──────────────────────┘   └───────────────────┘          │
                                                              ┌──────────────┴──────────────┐
                                                              ▼                             ▼
                                                   ┌────────────────────┐        ┌────────────────────┐
                                                   │ Resolved: answer   │        │ Clarify: 1 question│
                                                   │ + sources          │        │ + option buttons   │
                                                   └────────────────────┘        └─────────┬──────────┘
                                                                                            ▼
                                                                                  user confirms → commit
```

- **Backend**: `server.js` (Node's built-in `http`, zero deps) exposes `/api/workspace`, `/api/disambiguate`, `/api/health`.
- **Engine**: `src/agent.js` — `rank()` → `decide()` → `confirm()`.
- **Frontend**: `public/` — vanilla JS, no build step.
- **Context**: `src/context.js` — the single file you swap for real connectors.

## 7. Context model & ambiguity taxonomy

**Context item shape** (one record type the engine scores):

```js
{ kind: 'file'|'message'|'event', ref, snippet, hoursAgo, channel, topic, topicLabel }
```

**Scoring** (all traceable — this is what makes the demo credible):

| Component | Weight | Meaning |
|---|---|---|
| token overlap (synonym-expanded) | +1 per tag | "numbers" matches "numbers", "csv", "data" |
| recency bump (window-centered) | up to +1.2 | "yesterday" peaks at ~24h old, fades both ways |
| channel affinity | +0.5 | item lives in the channel where the ask happened |

**Decision**: if the top topic's score clears an absolute floor **and** clearly dominates the runner-up (wider margin for referential asks) → resolve; otherwise ask.

**Ambiguity tags**: `referential`, `temporal`, `scope`, `multiple-plausible`, `underspecified`.

## 8. Build plan (one day)

| Time | Milestone | Output |
|---|---|---|
| 0:00–0:45 | Environment | Context connector shape + mock workspace (`src/context.js`) |
| 0:45–2:30 | Engine | `rank()` scoring + synonym map + confidence gate |
| 2:30–3:15 | API + smoke test | `/api/disambiguate` + `npm run smoke` green on 4 scenarios |
| 3:15–5:30 | UI | Resolution cards, context panel, option-confirm flow |
| 5:30–6:30 | Polish | Responsive, empty/loading/error states, copy, chips |
| 6:30–7:30 | **Video + repo** | 2-min script recorded, GitHub pushed, social post out |

(Add ~2h buffer for the video — it always takes longer.)

## 9. Tech stack

- **Node.js** (built-in `http`, `fetch`) — zero dependencies, no install friction on build day.
- **Vanilla HTML/CSS/JS** — no build step, trivial to deploy and to record.
- **Provider-agnostic LLM layer** (`src/llm.js`) — tries Ollama (local), OpenAI, Anthropic, OpenRouter and Z.ai in priority order, using the first that answers. Defaults to local **Ollama** so live AI works with no key; the offline engine is the guaranteed fallback.

Why no framework: on a one-day clock, **time spent on tooling is time not spent on the interaction.** The engine is the differentiator; the stack should disappear.

## 10. Two-minute demo script

See `docs/demo-script.md` for the shot-by-shot. Beats:

1. **(0:00–0:15)** Problem: "People don't type specs. They type *'send it to them'*."
2. **(0:15–0:45)** Post *"the numbers for the thing we talked about yesterday"* in `#growth`. Watch the tags light up. It asks: **churn or acquisition?** — and shows why.
3. **(0:45–1:15)** Tap an option → it commits and returns the file + the exact messages.
4. **(1:15–1:40)** Post *"did we ship it?"* in `#eng-infra` → it **resolves without asking** ("v2.31, canary passed"). Contrast = the point.
5. **(1:40–2:00)** Close: "The environment isn't decoration — it's the disambiguation engine. Swap the mock context for real Slack and it's a teammate."

## 11. Submission checklist

Full checklist in `docs/submission-checklist.md`. Must-haves:

- [ ] Project title + written description
- [ ] **Public GitHub repo** (with README + run instructions)
- [ ] **2-minute demo video**
- [ ] **Social post** tagging the event partners
- [ ] Submission completed in the portal before the deadline
- [ ] Be ready to explain **what was built during the hackathon** (the engine, the UI, the context model — all net-new)

## 12. Judging alignment

| Likely criterion | Ambigua's answer |
|---|---|
| Use of ambiguity | ambiguity handling *is* the product, with a visible taxonomy |
| "Ambiguous AI" fit | every decision is probabilistic + explainable, not a black box |
| Environment centrality | scoring is meaningless without the workspace context |
| Working prototype | `npm start`, four scripted scenarios, offline-safe |
| Craft | responsive, accessible, live context panel, real states |
| Originality | "ask the right question" beats "hallucinate an answer" |

## 13. Stretch goals (if time)

- Real Slack connector (Bolt) + interactive option buttons.
- Multi-turn memory: remember what "the numbers" meant last time in this channel.
- Learn weights from accept/reject feedback.
- A "why not?" line: show the *runner-up* interpretation and why it lost.
- Voice: same engine behind a phone line for "live" environments.

## 14. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Demo data feels toy | Keep it plausible (real file names, real channel chatter); narrate "swap for real connectors" |
| LLM rate/limit on stage | Offline engine is the default; LLM is opt-in comparison |
| Video overruns 2:00 | Record the 5 beats separately, hard-cut; script is pre-written |
| "Is it just search?" | Show the **question-asking** and the **explainability** — search doesn't know when it doesn't know |
| Over-scoping | Ship the 5 in-scope items; everything else is roadmap |

## 15. What makes this worth paying for (commercial thesis)

A demo resolves one ambiguous sentence. A **product** has to clear the "would I put my card down?" bar. Four things move it there — and the first three are now built into this repo.

| Lever | Why it creates willingness to pay | Status |
|---|---|---|
| **Team Memory** (the moat) | Confirm once that "the numbers" means Q3 churn; next time it just answers. The agent learns the team's private vocabulary, asks fewer questions over time, and becomes a switching cost no generic agent can copy. | ✅ built (`src/store.js`, learning loop) |
| **Value meter** (the ROI) | Tracks ambiguities resolved and rework prevented, and reports *estimated minutes saved*. That's the number a manager approves budget against. | ✅ built (header meter + `/api/state`) |
| **Proactive scan** (the install reason) | "Scan channel" finds vague asks already sitting in a channel and offers to resolve them — catching wrong work *before* a day is spent on it. Nobody installs a box they must remember to open. | ✅ built (`/api/scan`) |
| **Close the loop** (the habit) | Resolve → *do the thing*: pull the file, draft the reply, create the task, book the meeting. An agent that ends in a link is a toy; one that completes the action is a habit. | 🔜 roadmap |

**The safety feature that makes it sellable:** it never acts on a guess. When context is unclear it asks exactly one question and shows its reasoning and sources. In a paid setting, "it knows when it doesn't know" is the whole trust story.

**Go-to-market sketch:** land on one painful, recurring workflow (e.g. "the Monday metrics ask"), prove the hours-saved number, then expand per channel. Price per seat (or per resolved ambiguity) once the value meter shows the payback. The learned vocabulary per team is the retention mechanism.

## 16. Repo layout

```
ambigua/
├── server.js · src/agent.js · src/context.js
├── public/ (index.html · styles.css · app.js)
├── scripts/smoke.js
├── docs/ (demo-script.md · submission-checklist.md · social-post.md · assets/)
├── BLUEPRINT.md · README.md · LICENSE · .env.example
```
