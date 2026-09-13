# Ambigua — Portal submission package

Copy-paste ready. Fill the bracketed `[ ... ]` items, then submit before the deadline.

---

## Project title

**Ambigua — resolve ambiguous asks with workspace context**

## Written description

Ambigua is an agent that turns ambiguous workplace requests into resolved, grounded actions by reasoning over the workspace context around them — the channel a request was made in, when it was made, the files nearby, the recent messages, and the calendar.

Most AI agents fail in the real world because people don't type specs; they type *"send it to them,"* *"the numbers for the thing we talked about yesterday,"* or *"did we ship it?"* Ambigua treats that ambiguity as the core problem. It extracts ambiguity signals (referential, temporal, scope), ranks the plausible interpretations with **visible evidence and explainable scores**, and then either **answers with sources** or asks **exactly one** clarifying question with the top interpretations as quick-pick options. It never acts on a guess.

Beyond the core loop, Ambigua adds the things that make it a product rather than a demo:
- **Team Memory** — confirm an interpretation once and it's remembered per channel, so the agent asks fewer questions over time and learns the team's private vocabulary.
- **Value meter** — tracks ambiguities resolved and clarifications that prevented rework, reporting an estimated time saved.
- **Proactive scan** — finds ambiguous asks already sitting in a channel and offers to resolve them.
- **Live model + live data** — a provider-agnostic LLM layer (local Ollama by default; OpenAI/Anthropic/OpenRouter/Z.ai optional, with graceful offline fallback) and a swappable context source (sample dataset, a real folder, or a JSON export from Slack/Drive/Gmail/Calendar).

Built as a zero-dependency Node server with a vanilla-JS UI. Includes an offline deterministic engine, an automated headless UI test (30/30 checks), and a live-LLM test.

## Public GitHub repository

https://github.com/ArthurzWong/ambigua

## Two-minute demonstration video

- Local file: `docs/assets/demo.mp4` (1440×810, narrated, ~2 min)
- Hosted URL: **[ upload to YouTube/Loom/Drive and paste the link here ]**

The video shows: an ambiguous ask in `#growth` → the agent asking one question with evidence → confirming → a resolved card with sources → Team Memory + value meter → a strong-context ask that resolves without asking → proactive scan → switching to live data → the architecture and the value map.

## Social media post

See `docs/social-post.md`. Short version:

> People don't type specs — they type *"send it to them."* Built **Ambigua** for the *Best Use of Ambiguous AI* track: an agent that resolves vague asks from workspace context — then answers, or asks **one** good question. Live model + live data. https://github.com/ArthurzWong/ambigua @partner @partner @partner #AI #Hackathon

## Eligibility — what was built during the hackathon

All first-party code is net-new and written during the event:
- `src/agent.js` — ambiguity engine (signals, ranking, confidence gate, Team Memory, scan)
- `src/llm.js` — provider-agnostic LLM layer
- `src/context-source.js`, `src/context.js`, `src/store.js` — data + memory
- `server.js` — zero-dependency HTTP API
- `public/*` — UI (cards, context panel, scan, feedback, value meter, data-source control)
- `scripts/*` — smoke test, headless UI test, LLM test, mock provider, demo builder

Reused building blocks only: Node's standard library and browser APIs. No pre-existing project was extended or resubmitted.

## Tech stack

Node.js (built-in `http`/`fetch`, zero npm dependencies) · vanilla HTML/CSS/JS · provider-agnostic LLM (Ollama / OpenAI / Anthropic / OpenRouter / Z.ai). Tests: `npm run smoke`, `npm run uitest`, `npm run llmtest`.

## How to run

```bash
git clone https://github.com/ArthurzWong/ambigua.git
cd ambigua
npm start          # → http://localhost:4321   (Node 18+, no npm install needed)
```

## Team

- **[ Your name ]** — [ role ]

## Pre-submit checklist

- [ ] Repo is public and opens logged-out
- [ ] Demo video hosted at a public URL (not just the file)
- [ ] Social post published with partner handles
- [ ] Description pasted into the portal
- [ ] Submitted before the portal deadline
