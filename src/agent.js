'use strict';

/**
 * Ambigua — ambiguity resolution engine.
 *
 * Input : a raw, ambiguous workplace ask + the workspace context it lives in
 *         (+ optional Team Memory learned from past resolutions).
 * Output: a grounded answer, or ONE best clarifying question with options —
 *         plus the ranked interpretations and the evidence behind each one.
 *
 * Engines:
 *   - heuristic (default, offline, deterministic)
 *   - llm (optional) — set OPENAI_API_KEY / OPENROUTER_API_KEY and toggle Live mode
 *
 * Team Memory: accepted resolutions are stored per channel as {topic, tags}.
 * Ranking applies a "learned" bonus, so the agent asks fewer questions about
 * things this specific team has already clarified. That's the stickiness.
 */

const { WORKSPACE } = require('./context');

// The active workspace dataset is swappable at runtime (sample → live sources).
let _ds = WORKSPACE;
function setDataset(next) { _ds = next && Array.isArray(next.files) ? next : WORKSPACE; }
function ds() { return _ds; }

/* ────────────────────────────── text utilities ───────────────────────────── */

const STOP = new Set((
  'a an the and or but if then than to of for in on at by with from as is are was were be been ' +
  'being do does did doing can could should would will shall may might must i you we they he she ' +
  'it its this that these those my our your their me us them thing things stuff hey hi hello please ' +
  'thanks thank ok okay yeah yep nope sure really just also too very so up out over down again here ' +
  'there when where why how all any both each few more most other some such no nor not only own same ' +
  'before after today tonight yesterday send sent pull push make made give got prep prepare need want ' +
  'let lets well about into'
).split(/\s+/));

const SYN = {
  ship: ['ship', 'shipped', 'shipping', 'deploy', 'deployed', 'deploys', 'deployment', 'release',
    'released', 'launch', 'launched', 'live', 'prod', 'production', 'canary', 'merge', 'merged'],
  deck: ['deck', 'decks', 'slides', 'slide', 'presentation', 'pitch', 'pptx', 'keynote'],
  numbers: ['numbers', 'number', 'metrics', 'stats', 'figures', 'data', 'sheet', 'csv', 'xlsx'],
  meeting: ['meeting', 'meet', 'standup', 'sync', 'review', 'retro', 'call'],
  incident: ['incident', 'outage', 'downtime', 'postmortem', 'error', 'errors', 'latency', 'stampede', 'cache'],
  churn: ['churn', 'retention', 'cohort', 'cohorts'],
  acquisition: ['acquisition', 'cac', 'funnel', 'acquire', 'conversion']
};

function canonTags(text) {
  const raw = String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const set = new Set();
  for (const t of raw) {
    if (STOP.has(t)) continue;
    let mapped = false;
    for (const [key, list] of Object.entries(SYN)) {
      if (list.includes(t)) { set.add('#' + key); mapped = true; }
    }
    if (!mapped) set.add(t);
  }
  return set;
}

function tagOverlap(a, b) {
  const A = new Set(a), B = new Set(b);
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n;
}

const TEMPORAL_CUES = [
  { re: /\bthis morning\b/i, hours: 10, label: 'this morning', weight: 1 },
  { re: /\byesterday\b/i, hours: 24, label: 'yesterday', weight: 1 },
  { re: /\btoday\b/i, hours: 14, label: 'today', weight: 0.9 },
  { re: /\btonight\b/i, hours: 10, label: 'tonight', weight: 0.8 },
  { re: /\blast week\b/i, hours: 120, label: 'last week', weight: 0.9 },
  { re: /\bthis week\b/i, hours: 84, label: 'this week', weight: 0.7 },
  { re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, hours: 120, label: 'a weekday', weight: 0.5 }
];

const REFERENTIAL_RE = /\b(it|that|this|those|them|they|the thing|the stuff|the one|the file|the doc|the deck|the numbers|the sheet)\b/i;
const SCOPE_RE = /\b(we|they|them|everyone|the team|you guys|people)\b/i;

function detectTemporal(msg) {
  for (const c of TEMPORAL_CUES) if (c.re.test(msg)) return c;
  return null;
}
function detectReferential(msg) { return REFERENTIAL_RE.test(msg); }
function detectScope(msg) { return SCOPE_RE.test(msg); }

/* ──────────────────────────── candidate building ─────────────────────────── */

function buildCandidates() {
  const out = [];
  for (const f of ds().files) {
    out.push({
      kind: 'file', ref: `#${f.channel} · ${f.name}`, snippet: f.summary,
      hoursAgo: f.hoursAgo, channel: f.channel, topic: f.topic, topicLabel: f.topicLabel,
      text: `${f.name} ${f.tags.join(' ')} ${f.summary} ${f.channel}`
    });
  }
  for (const m of ds().messages) {
    out.push({
      kind: 'message', ref: `#${m.channel} · ${m.author}`, snippet: m.text,
      hoursAgo: m.hoursAgo, channel: m.channel, topic: m.topic, topicLabel: m.topicLabel,
      text: m.text
    });
  }
  for (const e of ds().events) {
    out.push({
      kind: 'event', ref: `Calendar · ${e.title}`, snippet: e.title,
      hoursAgo: e.hoursAgo, channel: null, topic: e.topic, topicLabel: e.topicLabel,
      text: `${e.title} ${(e.attendees || []).join(' ')}`
    });
  }
  return out;
}

function scoreCandidate(cand, msgTags, temporal, activeChannel) {
  const cTags = canonTags(cand.text);
  let overlap = 0;
  const matched = [];
  for (const t of msgTags) if (cTags.has(t)) { overlap++; matched.push(t.replace(/^#/, '')); }

  let score = overlap;
  let recency = 0;
  if (temporal) {
    const target = temporal.hours;
    const dist = Math.abs(cand.hoursAgo - target);
    if (dist < target) { recency = 1.2 * (1 - dist / target) * temporal.weight; score += recency; }
  }
  const channelBonus = activeChannel && cand.channel === activeChannel ? 0.5 : 0;
  score += channelBonus;

  return { cand, overlap, recency, channelBonus, matched, score };
}

function buildWhy(m) {
  const bits = [];
  if (m.matched.length) bits.push(`matches “${m.matched.slice(0, 3).join(', ')}”`);
  if (m.recency > 0) bits.push('fits the time window');
  if (m.channelBonus > 0) bits.push('same channel');
  return bits.join(' · ') || 'related context';
}

function cluster(scored) {
  const map = new Map();
  for (const s of scored) {
    if (s.score <= 0) continue;
    const k = s.cand.topic;
    if (!map.has(k)) map.set(k, { topic: k, label: s.cand.topicLabel, members: [] });
    map.get(k).members.push(s);
  }
  const clusters = [];
  for (const c of map.values()) {
    c.members.sort((a, b) => b.score - a.score);
    c.score = c.members.reduce((t, m) => t + m.score, 0);
    c.evidence = c.members.slice(0, 3).map((m) => ({
      kind: m.cand.kind, ref: m.cand.ref, snippet: m.cand.snippet,
      why: buildWhy(m), weight: +m.score.toFixed(2)
    }));
    clusters.push(c);
  }
  clusters.sort((a, b) => b.score - a.score);
  return clusters;
}

/** Apply Team Memory: give a confidence boost to topics this team already confirmed. */
function applyMemory(clusters, memory, channel, msgTagsArr) {
  if (!memory || !memory.length) return;
  for (const c of clusters) {
    let best = null;
    for (const entry of memory) {
      if (entry.topic !== c.topic) continue;
      if (channel && entry.channel && entry.channel !== channel) continue;
      const ov = tagOverlap(msgTagsArr, entry.tags || []);
      if (ov > 0 && (!best || ov > best.ov)) best = { entry, ov };
    }
    if (best) {
      const net = Math.max(0, (best.entry.accepts || 0) - (best.entry.rejects || 0));
      if (net > 0) {
        c.score += Math.min(2.0, net * 1.2);
        c.learned = true;
        c.learnedNet = net;
      }
    }
  }
  clusters.sort((a, b) => b.score - a.score);
}

function toInterpretations(clusters, top) {
  return clusters.slice(0, 4).map((c) => ({
    label: c.label,
    topic: c.topic,
    score: +c.score.toFixed(2),
    confidence: +(c.score / top.score).toFixed(2),
    learned: !!c.learned,
    evidence: c.evidence
  }));
}

/* ──────────────────────────── ranking pipeline ───────────────────────────── */

function rank(message, channelName, memory) {
  const msgTags = canonTags(message);
  const msgTagsArr = [...msgTags];
  const temporal = detectTemporal(message);
  const referential = detectReferential(message);
  const scope = detectScope(message);
  const activeChannel = channelName
    || (ds().channels.find((c) => message.toLowerCase().includes(c.name)) || {}).name
    || null;

  const scored = buildCandidates().map((c) => scoreCandidate(c, msgTags, temporal, activeChannel));
  const clusters = cluster(scored);
  applyMemory(clusters, memory, activeChannel, msgTagsArr);

  const tags = [];
  if (referential) tags.push('referential');
  if (scope) tags.push('scope');
  if (temporal) tags.push('temporal');
  if (activeChannel) tags.push('channel:' + activeChannel);

  return { message, msgTags, msgTagsArr, temporal, referential, scope, activeChannel, clusters, tags };
}

/* ─────────────────────────────── the decision ────────────────────────────── */

function recentFallbackOptions() {
  return ds().files.slice().sort((a, b) => a.hoursAgo - b.hoursAgo).slice(0, 3).map((f) => f.topicLabel);
}

function decide(message, channelName, memory) {
  const R = rank(message, channelName, memory);
  const clusters = R.clusters;
  const tags = [...R.tags];

  if (clusters.length === 0 || clusters[0].score < 2) {
    tags.push('underspecified');
    return {
      status: 'clarify', confidence: 0.16, engine: 'heuristic', ambiguityTags: tags,
      interpretations: [], question: 'This one is wide open — what should I pull, and who is it for?',
      options: [...recentFallbackOptions(), 'Something else…'], answer: null
    };
  }

  const top = clusters[0];
  const second = clusters[1];
  // Certainty reflects how far ahead the leader is — NOT dragged down by
  // unrelated low-signal clusters further down the list.
  const dominance = second ? top.score / (top.score + second.score) : 1;
  const strength = Math.min(1, top.score / 3);
  let confidence = dominance * (0.6 + 0.4 * strength);
  confidence = Math.min(0.96, +confidence.toFixed(2));

  const interpretations = toInterpretations(clusters, top);

  // Team Memory earns a lower bar to commit: we've seen this team's meaning before.
  const ratioNeeded = (R.referential ? 1.9 : 1.8) * (top.learned ? 0.7 : 1);
  const clear = confidence >= 0.55 && top.score >= 2 && (!second || top.score >= ratioNeeded * second.score);

  if (clear) {
    const ev = top.evidence[0];
    if (top.learned) tags.push('learned');
    return {
      status: 'resolved', confidence: +confidence.toFixed(2), engine: 'heuristic', ambiguityTags: tags,
      interpretations, question: null, options: [],
      resolvedTopic: top.topic, resolvedLabel: top.label,
      answer: {
        headline: `You mean **${top.label}**.`,
        detail: ev ? ev.snippet : '',
        sources: top.evidence.map((e) => e.ref),
        confidenceNote: top.learned
          ? 'boosted by Team Memory — your team already clarified this'
          : `resolved from ${top.members.length} context signal${top.members.length === 1 ? '' : 's'}`
      }
    };
  }

  tags.push('multiple-plausible');
  const opts = [...new Set([top.label, second ? second.label : null, clusters[2] ? clusters[2].label : null]
    .filter(Boolean))].slice(0, 3);
  opts.push('Something else…');

  const question = second
    ? `Quick check — when you say that, do you mean **${top.label}** or **${second.label}**?`
    : `I can make a guess, but I want to be sure — are you asking about **${top.label}**?`;

  return {
    status: 'clarify', confidence: +confidence.toFixed(2), engine: 'heuristic', ambiguityTags: tags,
    interpretations, question, options: opts, answer: null
  };
}

function confirm(label, channelName, memory) {
  const clean = String(label || '').replace(/\s*…$/, '').trim();
  if (/^something else/i.test(clean)) {
    return {
      status: 'clarify', confidence: 0.2, engine: 'heuristic', ambiguityTags: ['awaiting-detail'],
      interpretations: [], options: [], answer: null,
      question: 'No problem — tell me a bit more: what exactly do you need, and who is it for?'
    };
  }
  const R = rank(clean, channelName, memory);
  const match = R.clusters.find((c) => c.label.toLowerCase() === clean.toLowerCase())
    || R.clusters.find((c) => c.label.toLowerCase().includes(clean.toLowerCase()));
  if (!match) return decide(clean, channelName, memory);

  const ev = match.evidence[0];
  return {
    status: 'resolved', confidence: Math.min(0.93, +(0.55 + match.score / 10).toFixed(2)),
    engine: 'heuristic', ambiguityTags: [...R.tags, 'confirmed'],
    interpretations: toInterpretations(R.clusters, R.clusters[0]),
    question: null, options: [],
    resolvedTopic: match.topic, resolvedLabel: match.label,
    answer: {
      headline: `Locked in — **${match.label}**.`,
      detail: ev ? ev.snippet : '',
      sources: match.evidence.map((e) => e.ref),
      confidenceNote: 'you confirmed this interpretation'
    }
  };
}

/* ──────────────────────── proactive channel scan ─────────────────────────── */

const ASK_HINT = /(\?|\b(can|could|who|what|when|where|did|please|need|anyone|someone)\b)/i;

function scan(channelName, memory) {
  const out = [];
  for (const m of ds().messages) {
    if (channelName && m.channel !== channelName) continue;
    const r = decide(m.text, m.channel, memory);
    const looksLikeAsk = ASK_HINT.test(m.text);
    if (r.status === 'clarify' && r.interpretations && r.interpretations.length && looksLikeAsk) {
      out.push({
        id: m.id, channel: m.channel, author: m.author, hoursAgo: m.hoursAgo, text: m.text,
        tags: r.ambiguityTags, guess: r.interpretations[0].label, confidence: r.confidence,
        options: r.options
      });
    }
  }
  out.sort((a, b) => a.confidence - b.confidence); // most ambiguous first
  return out;
}

/* ───────────────────────────── optional LLM mode ─────────────────────────── */

const llm = require('./llm');

// 'auto' mode uses the LLM only when a hosted (keyed) provider is configured, so
// the out-of-the-box demo stays fast. Local Ollama is opt-in via 'live' mode.
function hasKey() {
  return llm.providerList().some((p) => !!p.key);
}

function compactContext(memory) {
  return {
    channels: ds().channels.map((c) => ({ name: c.name, topic: c.topic })),
    files: ds().files.map((f) => ({ name: f.name, channel: f.channel, hoursAgo: f.hoursAgo, tags: f.tags, summary: f.summary })),
    recentMessages: ds().messages.map((m) => ({ channel: m.channel, author: m.author, hoursAgo: m.hoursAgo, text: m.text })),
    events: ds().events.map((e) => ({ title: e.title, hoursAgo: e.hoursAgo, attendees: e.attendees })),
    teamMemory: (memory || []).map((p) => ({ topic: p.topicLabel, channel: p.channel, confirmed: p.accepts || 0 }))
  };
}

const LLM_SYSTEM = 'You are Ambigua, an agent that resolves ambiguous workplace requests using workspace context. ' +
  'Return STRICT JSON only, shape: {"status":"resolved|clarify","confidence":0..1,' +
  '"ambiguityTags":["referential","temporal","scope","underspecified","multiple-plausible"],' +
  '"question":string|null,"options":[string],"answer":{"headline":string,"detail":string,"sources":[string]}|null}. ' +
  'Resolve only when the context clearly supports ONE interpretation; otherwise ask ONE crisp clarifying question with at most 3 options. ' +
  'Prefer topics confirmed in teamMemory. Output the JSON object only, no prose.';

async function callLLM(message, memory) {
  const messages = [
    { role: 'system', content: LLM_SYSTEM },
    { role: 'user', content: `Ambiguous request: "${message}"\n\nWorkspace context (JSON):\n${JSON.stringify(compactContext(memory))}` }
  ];
  return llm.chatJSON(messages); // → { json, provider, model }
}

/* ──────────────────────────────── public API ─────────────────────────────── */

async function disambiguate({ message, channel = null, mode = 'auto', select = null, memory = null } = {}) {
  if (select) return confirm(select, channel, memory);

  const base = decide(message, channel, memory);
  const wantLLM = (mode === 'live') || (mode === 'auto' && hasKey());
  if (!wantLLM) return base;

  try {
    const { json: out, provider, model } = await callLLM(message, memory);
    if (!out || !out.status) return base;
    return {
      ...base,
      status: out.status === 'resolved' ? 'resolved' : 'clarify',
      confidence: typeof out.confidence === 'number' ? +out.confidence.toFixed(2) : base.confidence,
      ambiguityTags: Array.isArray(out.ambiguityTags) && out.ambiguityTags.length ? out.ambiguityTags : base.ambiguityTags,
      question: out.status === 'resolved' ? null : (out.question || base.question),
      options: Array.isArray(out.options) && out.options.length ? out.options.slice(0, 4) : base.options,
      answer: out.answer || base.answer,
      engine: 'llm', llmProvider: provider, llmModel: model
    };
  } catch (err) {
    return { ...base, engine: 'heuristic', engineNote: 'live mode unavailable (' + err.message + ') — used offline engine' };
  }
}

module.exports = { disambiguate, canonTags, detectTemporal, decide, rank, confirm, scan, hasKey, setDataset, getDataset: ds, llmInfo: llm.info };
