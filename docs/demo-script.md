# 2-Minute Demo Script — Ambigua

**Format:** screen recording of the running app (open `http://localhost:4321`). Keep a terminal tab ready for `npm run smoke` if you need a backup.
**Tone:** calm, confident. Let the product talk.

---

## Beat 1 — The problem (0:00–0:15)
> *"People don't type bug reports to their teammates. They type 'send it to them.' They type 'did we ship it?' An agent that can't handle that ambiguity isn't a teammate — it's a demo. So we built the part everyone skips: figuring out what was even meant."*

**On screen:** the empty Ambigua thread, sidebar of channels visible.

## Beat 2 — The money moment (0:15–0:50)
- Click the chip: **"the numbers for the thing we talked about yesterday"** (this posts into `#growth`).
> *"Watch. It tags the ask — referential, temporal — and reads the context: the channel, the files, yesterday's messages, the standup."*
- The card shows **two** top interpretations: **Q3 churn numbers** vs **Q3 acquisition funnel**, each with a confidence bar and the evidence underneath.
> *"It doesn't guess. It asks one question — and shows you exactly which context made each guess strong."*

## Beat 3 — Commit (0:50–1:15)
- Click **"Q3 churn numbers."**
- The card resolves: **"Locked in — Q3 churn numbers"** with the file and the source messages.
> *"One tap to confirm, and it hands back the artifact with sources — not a paragraph of vibes."*

## Beat 4 — The contrast (1:15–1:40)
- Switch to `#eng-infra`, click **"did we ship it?"**
- It **resolves without asking**: *"You mean v2.31 deploy to prod"* (canary passed, from the channel).
> *"Same agent, different channel. Here the context is strong enough that it just answers. That difference — asking when it should, acting when it can — is the whole product."*

## Beat 5 — Close (1:40–2:00)
> *"Ambigua's bet is simple: an agent's environment isn't decoration. Where you asked, when, with whom, and what's around it — that's the disambiguation engine. Swap our mock workspace for real Slack and Drive, and it's a teammate."*

**On screen:** the `?demo=1` auto-run or the four resolution cards in a row.

---

## Optional extras if time
- Show the **"send it to them"** case → it *refuses to guess* and asks broadly. Sells trustworthiness.
- Flash `npm run smoke` in the terminal to prove the engine is real and testable.
- Mention the **Live LLM** toggle: "same interface, bring your own model."

## Recording tips
- Record at 1440×900 (or 1280×720) so text is crisp.
- Pre-open the browser at `?demo=1` and keep a second window idle.
- Cut dead air; each beat should be one continuous action.
- Caption the four key phrases on-screen: *referential · temporal · clarify · resolved*.
