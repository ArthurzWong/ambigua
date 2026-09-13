# Ambigua

**An agent that turns ambiguous workplace asks into resolved, grounded actions — using the place your team already works.**

Track: **Best Use of Ambiguous AI**. Built as a one-day-viable hackathon starter.

> "hey can you pull the numbers for the thing we talked about yesterday?"
> → Ambigua reads the channel, the files, yesterday's messages and the calendar, then either **answers**, asks **one** crisp question, or — because your team already taught it — just knows.

## Demo

▶️ Narrated walkthrough (~2 min): [`docs/assets/demo.mp4`](docs/assets/demo.mp4) · poster: [`docs/assets/demo-poster.png`](docs/assets/demo-poster.png)

Submission kit: [`docs/submission.md`](docs/submission.md) (portal copy) · [`docs/social-post.md`](docs/social-post.md) · [`docs/demo-script.md`](docs/demo-script.md).

---

## Why this exists

Most "AI agents" fail in the real world for one reason: humans ask for things ambiguously. *"Send it to them." "Did we ship it?" "Prep the deck for the meeting."* An agent that can't handle ambiguity is a demo, not a teammate.

Ambigua's bet: **an agent's environment is not decoration — it's the disambiguation engine.** Where the request happened, when, who else was there, and what artifacts exist are exactly the signals that resolve the ambiguity. The context *is* the product.

## What makes it worth paying for

A demo resolves one ambiguous sentence. A **product** does three extra things — and this build does all three:

1. **It learns your team's language (the moat).** Every confirmation is stored as *Team Memory* (per channel). Confirm once that "the numbers" means Q3 churn, and the next time someone asks, Ambigua just answers. The longer a team uses it, the fewer questions it asks and the more it sounds like an insider — a switching cost no generic agent can copy.
2. **It shows the money (the ROI).** A value meter tracks ambiguities resolved and clarifications that prevented rework, and reports an estimated time saved. That number is what a manager buys.
3. **It works without being asked (the install reason).** "Scan channel" proactively finds vague asks already sitting in a channel and offers to resolve them — catching the wrong work *before* someone spends a day on it.

Plus the trust feature that makes all of it safe: **it never acts on a guess.** When context isn't clear, it asks exactly one question and shows its reasoning.

---

## Quick start

Requires **Node.js 18+**. Zero npm dependencies — it runs out of the box.

```bash
cd ambigua
npm start
# → Ambigua is running → http://localhost:4321
```

Open <http://localhost:4321>. Then either:
- click a **prompt chip** (e.g. *"the numbers for the thing we talked about yesterday"*), or
- click **Scan channel** to see ambiguities Ambigua spots in the channel, or
- type any vague ask and press **Ask**.

The engine defaults to **Live LLM** (local Ollama here); switch it to *Offline (heuristic)* or *Auto* in the top bar. The **Data source** panel in the sidebar swaps the workspace between the sample dataset and real data (see below).

For an auto-run demo (handy for a video recording): <http://localhost:4321/?demo=1>

`npm run smoke` — runs the engine against the four demo scenarios in the terminal (no browser).
`npm run uitest` — drives **every control** in headless Chrome and asserts the interactions (needs the server running).
`npm run llmtest` — verifies a live LLM provider actually answers.
`npm run mockllm` — a tiny OpenAI-compatible mock model for fast, offline tests of Live mode.

### Live data (not mock)

The workspace context is **swappable at runtime** — the engine is dataset-agnostic. Use the **Data source** panel (sidebar) or the API:

| Source | Meaning |
|---|---|
| `sample` | the built-in demo workspace (default) |
| `dir:/abs/path` | **live**: real files from a folder on disk |
| `json:/abs/path` | **live**: an export `{ workspace, channels, files, messages, events }` (from Slack/Drive/Gmail/Calendar) |

```bash
curl -X POST localhost:4321/api/context -H 'Content-Type: application/json' \
  -d '{"source":"dir:/Users/me/projects/acme"}'
```

Real connector adapters (Slack/Google/Microsoft) only need to return that same shape — see `src/context-source.js`. Gmail/Drive/Calendar connectors in this environment are not connected, so real Slack/Google data requires an OAuth handshake or an export.

### Live LLM mode

Ambigua works fully offline (deterministic engine) so the demo never breaks. For real model reasoning, it ships a **provider-agnostic LLM layer** (`src/llm.js`) that tries providers in priority order and uses the first that answers — a missing or expired key simply falls through:

| Provider | Env | Key needed |
|---|---|---|
| **Ollama** (local) | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | no — **default** |
| OpenAI-compatible | `OPENAI_*` | yes |
| Anthropic | `ANTHROPIC_*` | yes |
| OpenRouter | `OPENROUTER_*` | yes |
| Z.ai / GLM | `ZAI_*` | yes |

Out of the box it uses **local Ollama** (`gemma3:12b` here). To use a hosted model:

```bash
cp .env.example .env
# add OPENAI_API_KEY=*** (or ANTHROPIC/OPENROUTER/ZAI), then:
npm start
```

Then pick an engine in the top bar:

- **Offline reasoning** — heuristic only (fast, deterministic).
- **Auto** — uses a hosted model *if a keyed provider is configured*, else heuristic.
- **Live LLM** — always calls a real model (including local Ollama). The badge shows `live · provider/model`.

On startup Ambigua warms up the provider list and reports the **working** provider via `/api/health` (`llm.provider`). If the live call fails, the card shows a note and falls back to the offline engine.

---

## How it works

```
Ambiguous ask ─▶ Context layer ─▶ Ranking engine ─▶ Confidence gate ─┬─▶ Resolved answer + sources
                 (workspace)      (+ Team Memory)                    └─▶ One clarifying question + options
                                                                          └─▶ confirm ─▶ commit ─▶ learn
```

1. **Context layer** loads the environment: channels, files, recent messages, calendar (`src/context.js`).
2. **Signal extraction** tags the ask: *referential* ("it"), *temporal* ("yesterday"), *scope* ("we/them").
3. **Ranking engine** scores every context item by **token overlap** (synonym-expanded), a **window-centered recency bump** ("yesterday" peaks at ~24h old), and **channel affinity**.
4. **Team Memory** gives a boost to topics this team already confirmed, and lowers the bar to commit on a repeat ask.
5. **Confidence gate**: one interpretation clearly wins → answer with sources; otherwise ask **one** question with the top interpretations as options.
6. **Learning loop**: confirming an option (or hitting *Correct*) stores the mapping for that channel; hitting *Not quite* down-weights it.

Every interpretation shows *why* it scored — which words matched, how it fit the time window, whether it was in-channel, and whether Team Memory boosted it.

### API

| Route | Purpose |
|---|---|
| `GET /api/workspace` | the mock workspace context |
| `GET /api/health` | provider + engine status (`llm.provider`) |
| `GET /api/llm` | active provider + candidate list |
| `GET /api/context` / `POST /api/context` | read / switch the data source (`sample`, `dir:`, `json:`) |
| `GET /api/state` | Team Memory + usage stats (value meter) |
| `GET /api/scan?channel=` | ambiguities the agent spots in recent messages |
| `POST /api/disambiguate` | `{ message, channel?, mode?, select?, from? }` |
| `POST /api/feedback` | `{ action:'accept'\|'reject', topic, topicLabel, channel, from }` |

### Ambiguity taxonomy the agent detects

| Tag | Example trigger | What it means |
|-----|-----------------|---------------|
| `referential` | "it", "that thing", "them" | pronoun with no antecedent |
| `temporal` | "yesterday", "last week" | needs a time window |
| `scope` | "we", "the team", "you guys" | who is the audience/actor |
| `multiple-plausible` | two similarly-scored topics | genuine ambiguity → ask |
| `underspecified` | "send it to them" | no resolvable signal → ask broadly |
| `learned` | seen & confirmed before | Team Memory is boosting this |

---

## Project structure

```
ambigua/
├── server.js              # zero-dep HTTP server + /api routes
├── src/
│   ├── agent.js           # ambiguity engine (heuristic + optional LLM + memory + scan)
│   ├── llm.js             # provider-agnostic LLM layer (Ollama/OpenAI/Anthropic/OpenRouter/Z.ai)
│   ├── context.js         # the sample workspace (channels/files/messages/events)
│   ├── context-source.js  # swappable data: sample / dir:<path> / json:<path>
│   └── store.js           # Team Memory + stats persistence (./.data/memory.json)
├── public/
│   ├── index.html         # app shell
│   ├── styles.css         # dark console theme + responsive layout
│   ├── app.js             # UI logic, renders resolution cards
│   └── selftest.js        # headless UI self-test (?selftest=1)
├── scripts/
│   ├── smoke.js           # terminal test of the 4 demo scenarios
│   ├── uitest.js          # headless-Chrome UI test runner
│   ├── llmtest.js         # verifies a live LLM provider answers
│   └── mock-llm.js        # OpenAI-compatible mock model for fast Live-mode tests
├── docs/                  # demo script, submission checklist, social post, assets
├── BLUEPRINT.md           # the full hackathon + commercial blueprint
└── .env.example           # optional live-LLM keys
```

---

## Where to change things

| You want to… | Edit |
|---|---|
| Change the workspace data (files, messages, calendar) | `src/context.js` |
| Add synonyms so the matcher is smarter | `SYN` object in `src/agent.js` |
| Change when it resolves vs asks | thresholds in `decide()` in `src/agent.js` |
| Change what gets learned | `learn()` / `penalize()` in `server.js` |
| Change colors / theme | `:root` variables in `public/styles.css` |
| Change copy, presets, or chips | `PRESETS` + strings in `public/app.js`, `index.html` |
| Reset Team Memory | delete `.data/memory.json` |
| Wire **real** Slack / Drive / Calendar | replace `src/context.js` with connector calls that return the same shape |

---

## Controls (all interactive)

Every affordance does something and gives feedback (hover, active, focus ring, or a toast):

| Control | Action | Feedback |
|---|---|---|
| Channel buttons | switch the channel the agent reasons in | active highlight + toast |
| People buttons | append `@handle` to your ask | composer focus + toast |
| Context items (files / messages / events) | click to ask about it (resolves to that topic) | hover reveal + resolution card |
| **Scan channel** | find ambiguous asks in the channel | scan panel with findings |
| Engine select | Auto / Offline / Live LLM | badge updates + toast |
| Ask button | submit (disabled + "Thinking…" while running) | inline loading dots |
| Option buttons | confirm an interpretation | options disable → resolved card → **learned** |
| **Correct ✓ / Not quite** | feed the learning loop | "Remembered ✓" + value meter updates |
| Copy sources | copy the source list | "Copied ✓" + toast |
| Reset thread | clear the conversation | intro restored + toast |
| Esc in composer | clear the input | — |

## Quality & verification

- **Responsive**: 3-column desktop → 2-column ≤1080px → single column ≤720px.
- **States**: loading, error (server down / missing key), empty (underspecified), resolved, clarify, confirmed, learned, scan-empty.
- **A11y**: `role="log"` + `aria-live` thread, labelled controls, focus rings, `sr-only` label, keyboard-operable options, skip link.
- **No remote assets**: all icons/MIME local or inline SVG.
- **Verified**: `node --check` on every JS file; engine outputs via `npm run smoke`; **`npm run uitest` passes 30/30** interaction checks in headless Chrome (run at 1440×900, 430×860, 380×800, incl. layout + no-overflow + data-source controls); learning loop verified (ask → confirm → repeat **resolves**); **live LLM verified** — `npm run llmtest` and a live call via `ollama / gemma3:12b`; **live data verified** — switched the source to `dir:<repo>/src` and the agent resolved real files; **live UI verified** — a headless browser click in Live mode rendered a card tagged `openai/mock-glm`. Screenshots in `docs/assets/`.

---

## Roadmap (post-hackathon)

- Replace mock context with real **Slack + Google Drive + Calendar** connectors.
- Ship as a **Slack app**: auto-watch chosen channels, interactive option buttons, thread-native memory.
- Per-user and per-team vocabularies; "explain why" panel for auditors.
- **Act, don't just answer**: pull the file, draft the reply, create the task.
- Manager dashboard: rework prevented, hours saved, top ambiguous phrases.
