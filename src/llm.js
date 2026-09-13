'use strict';

/**
 * LLM layer — provider-agnostic, zero-dependency, with graceful fall-through.
 *
 * Ambigua works fully offline (the heuristic engine). When Live mode is on,
 * this module calls a real model. It tries providers in priority order and
 * uses the first that answers, so a missing/expired key never breaks the app.
 *
 * Supported out of the box:
 *   - Ollama (local, no key)          → OLLAMA_BASE_URL, OLLAMA_MODEL   (default here)
 *   - OpenAI-compatible               → OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL
 *   - OpenRouter                      → OPENROUTER_API_KEY, OPENROUTER_MODEL
 *   - Z.ai / GLM (OpenAI-compatible)  → ZAI_API_KEY, ZAI_BASE_URL, ZAI_MODEL
 *   - Anthropic                       → ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ANTHROPIC_MODEL
 *
 * Override selection with LLM_PROVIDER=<name>.
 */

const env = (k) => process.env[k];
const timeoutMs = () => parseInt(env('LLM_TIMEOUT_MS') || '45000', 10);

function providerList() {
  const list = [];

  if (env('OPENAI_API_KEY')) list.push({
    name: 'openai', kind: 'openai',
    base: env('OPENAI_BASE_URL') || 'https://api.openai.com/v1',
    key: env('OPENAI_API_KEY'), model: env('OPENAI_MODEL') || 'gpt-4o-mini'
  });
  if (env('ANTHROPIC_API_KEY')) list.push({
    name: 'anthropic', kind: 'anthropic',
    base: env('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com',
    key: env('ANTHROPIC_API_KEY'), model: env('ANTHROPIC_MODEL') || 'claude-3-5-haiku-20241022'
  });
  if (env('OPENROUTER_API_KEY')) list.push({
    name: 'openrouter', kind: 'openai',
    base: env('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1',
    key: env('OPENROUTER_API_KEY'), model: env('OPENROUTER_MODEL') || 'openai/gpt-4o-mini'
  });
  if (env('ZAI_API_KEY')) list.push({
    name: 'zai', kind: 'openai',
    base: env('ZAI_BASE_URL') || 'https://api.z.ai/api/paas/v4',
    key: env('ZAI_API_KEY'), model: env('ZAI_MODEL') || 'glm-4-flash'
  });

  // Local Ollama is always a candidate (also our default fallback).
  list.push({
    name: 'ollama', kind: 'openai', noJsonFormat: true,
    base: env('OLLAMA_BASE_URL') || 'http://localhost:11434/v1',
    key: null, model: env('OLLAMA_MODEL') || 'gemma3:12b'
  });

  const prefer = env('LLM_PROVIDER');
  if (prefer) list.sort((a, b) => (a.name === prefer ? -1 : 0) - (b.name === prefer ? -1 : 0));
  return list;
}

/** Strip ```json fences / prose and pull out the first JSON object. */
function extractJson(text) {
  let s = String(text || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

async function callProvider(p, messages, { temperature = 0.2, json = false } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs());
  try {
    let url, headers, body;
    if (p.kind === 'anthropic') {
      url = p.base.replace(/\/$/, '') + '/v1/messages';
      headers = { 'Content-Type': 'application/json', 'x-api-key': p.key, 'anthropic-version': '2023-06-01' };
      const sys = messages.find((m) => m.role === 'system');
      const rest = messages.filter((m) => m.role !== 'system');
      body = { model: p.model, max_tokens: 1024, temperature, system: sys ? sys.content : undefined, messages: rest };
    } else {
      url = p.base.replace(/\/$/, '') + '/chat/completions';
      headers = { 'Content-Type': 'application/json' };
      if (p.key) headers.Authorization = 'Bearer ' + p.key;
      body = { model: p.model, messages, temperature, stream: false };
      if (json && !p.noJsonFormat) body.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`${p.name} HTTP ${res.status} ${txt.slice(0, 120)}`);
    }
    const data = await res.json();
    const text = p.kind === 'anthropic'
      ? (data.content && data.content[0] && data.content[0].text)
      : (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
    if (!text) throw new Error(p.name + ' returned no text');
    return text;
  } finally {
    clearTimeout(t);
  }
}

let active = null; // remember the last provider that worked

/** Ordered candidates, preferring the provider that last succeeded. */
function ordered() {
  const list = providerList();
  if (active) {
    const i = list.findIndex((p) => p.name === active.name);
    if (i > 0) list.unshift(list.splice(i, 1)[0]);
  }
  return list;
}

/** Raw text completion; throws if every provider fails. */
async function chat(messages, opts) {
  const list = ordered();
  if (!list.length) throw new Error('no LLM providers configured');
  let lastErr;
  for (const p of list) {
    try {
      const text = await callProvider(p, messages, opts);
      active = { name: p.name, model: p.model };
      return { text, provider: p.name, model: p.model };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('all LLM providers failed');
}

/** Convenience: ask for JSON and parse it (fence-tolerant). */
async function chatJSON(messages) {
  const { text, provider, model } = await chat(messages, { json: true });
  return { json: extractJson(text), provider, model };
}

/** Non-blocking provider info for the UI (does not call the model). */
function info() {
  const list = providerList();
  return {
    ready: list.length > 0,
    provider: active ? active.name : (list[0] ? list[0].name : null),
    model: active ? active.model : (list[0] ? list[0].model : null),
    candidates: list.map((p) => p.name)
  };
}

/** Best-effort warm-up: finds and remembers the first provider that actually
 *  answers, so info() reports a WORKING provider rather than a dead key. */
async function warmup() {
  try {
    await chat([{ role: 'user', content: 'ping' }], { temperature: 0 });
  } catch (_) { /* no provider reachable — heuristic mode still works */ }
  return info();
}

module.exports = { chat, chatJSON, info, warmup, extractJson, providerList };
