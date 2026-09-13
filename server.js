'use strict';

/**
 * Ambigua server — zero external dependencies (Node's built-in http only).
 *
 *   GET  /                     → the app UI (public/index.html)
 *   GET  /api/workspace        → the mock workspace context
 *   GET  /api/health           → { ok, engine, llmReady }
 *   GET  /api/state            → Team Memory + usage stats (the value meter)
 *   GET  /api/scan?channel=..  → ambiguities the agent spots in recent messages
 *   POST /api/disambiguate     → { message, channel?, mode?, select?, from? }
 *   POST /api/feedback         → { action:'accept'|'reject', topic, topicLabel, channel, from }
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { disambiguate, scan, canonTags, hasKey, llmInfo, setDataset } = require('./src/agent');
const contextSource = require('./src/context-source');
const store = require('./src/store');
const llm = require('./src/llm');

// Active workspace dataset (sample by default; swappable to live sources).
let SOURCE = process.env.CONTEXT_SOURCE || 'sample';
let DATASET = contextSource.load(SOURCE);
setDataset(DATASET);

/* Zero-dependency .env loader (does not override real env vars). */
(function loadEnv() {
  try {
    const txt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m || m[1].startsWith('#')) continue;
      const val = m[2].replace(/^["']|["']$/g, '');
      if (!(m[1] in process.env)) process.env[m[1]] = val;
    }
  } catch (_) { /* no .env */ }
})();

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 4321;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8'
};

function send(res, code, body, type) {
  res.writeHead(code, { 'Content-Type': type || 'application/json; charset=utf-8' });
  res.end(body);
}
function json(res, code, obj) { send(res, code, JSON.stringify(obj)); }

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const safe = path.normalize(urlPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, MIME[path.extname(filePath)] || 'application/octet-stream');
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(d));
    req.on('error', reject);
  });
}

/* ── Team Memory helpers ──────────────────────────────────────────────────── */

function learn(data, { topic, topicLabel, channel, from }) {
  if (!topic || !from) return;
  const tags = [...canonTags(from)];
  let entry = data.phrases.find((p) => p.topic === topic && p.channel === channel);
  if (!entry) {
    entry = { topic, topicLabel: topicLabel || topic, channel, tags, accepts: 0, rejects: 0 };
    data.phrases.push(entry);
  }
  entry.tags = [...new Set([...(entry.tags || []), ...tags])];
  entry.accepts = (entry.accepts || 0) + 1;
  entry.updatedAt = new Date().toISOString();
}

function penalize(data, { topic, topicLabel, channel, from }) {
  const tags = [...canonTags(from || '')];
  let entry = data.phrases.find((p) => p.topic === topic && p.channel === channel);
  if (!entry) {
    entry = { topic, topicLabel: topicLabel || topic, channel, tags, accepts: 0, rejects: 0 };
    data.phrases.push(entry);
  }
  entry.rejects = (entry.rejects || 0) + 1;
  entry.updatedAt = new Date().toISOString();
}

function publicState(data) {
  return {
    stats: data.stats,
    minutesSaved: store.minutesSaved(data.stats),
    phrases: data.phrases.map((p) => ({
      topicLabel: p.topicLabel, channel: p.channel, accepts: p.accepts || 0, rejects: p.rejects || 0
    }))
  };
}

/* ── routing ──────────────────────────────────────────────────────────────── */

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  if (req.method === 'GET' && url.startsWith('/api/health')) {
    const li = llmInfo();
    return json(res, 200, {
      ok: true,
      llmReady: li.ready,
      hostedKey: hasKey(),
      engine: li.ready ? 'llm+heuristic' : 'heuristic',
      llm: li
    });
  }
  if (req.method === 'GET' && url.startsWith('/api/llm')) {
    return json(res, 200, llmInfo());
  }
  if (req.method === 'GET' && url.startsWith('/api/workspace')) {
    return json(res, 200, Object.assign({ __source: SOURCE }, DATASET));
  }
  if (req.method === 'GET' && url.startsWith('/api/context')) {
    return json(res, 200, { source: SOURCE, counts: contextSource.describe(DATASET) });
  }
  if (req.method === 'POST' && url.startsWith('/api/context')) {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const spec = String(body.source || '').trim();
      DATASET = contextSource.load(spec);            // throws on bad dir/json
      SOURCE = spec || 'sample';
      setDataset(DATASET);
      return json(res, 200, { source: SOURCE, counts: contextSource.describe(DATASET) });
    } catch (e) {
      return json(res, 400, { error: 'Could not load source: ' + String((e && e.message) || e) });
    }
  }
  if (req.method === 'GET' && url.startsWith('/api/state')) {
    return json(res, 200, publicState(store.load()));
  }
  if (req.method === 'GET' && url.startsWith('/api/scan')) {
    const q = new URLSearchParams(url.split('?')[1] || '');
    const channel = q.get('channel') || null;
    const data = store.load();
    return json(res, 200, { channel, findings: scan(channel, data.phrases) });
  }

  if (req.method === 'POST' && url.startsWith('/api/disambiguate')) {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const message = String(body.message || (body.select ? body.select : '')).trim();
      if (!message) return json(res, 400, { error: 'message is required' });
      const data = store.load();
      const result = await disambiguate({
        message, channel: body.channel, mode: body.mode || 'auto',
        select: body.select || null, memory: body.memory === false ? null : data.phrases
      });

      // usage stats + learning loop
      data.stats.asks = (data.stats.asks || 0) + 1;
      if (result.status === 'resolved') data.stats.resolved = (data.stats.resolved || 0) + 1;
      else data.stats.clarified = (data.stats.clarified || 0) + 1;

      if (body.select && !/something else/i.test(body.select) && result.status === 'resolved' && result.resolvedTopic) {
        learn(data, {
          topic: result.resolvedTopic, topicLabel: result.resolvedLabel,
          channel: body.channel || null, from: body.from || message
        });
        data.stats.learned = (data.stats.learned || 0) + 1;
      }
      store.save(data);

      return json(res, 200, { ...result, state: publicState(data) });
    } catch (e) {
      return json(res, 500, { error: String((e && e.message) || e) });
    }
  }

  if (req.method === 'POST' && url.startsWith('/api/feedback')) {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const data = store.load();
      const payload = {
        topic: body.topic, topicLabel: body.topicLabel,
        channel: body.channel || null, from: body.from || ''
      };
      if (body.action === 'accept') {
        learn(data, payload);
        data.stats.learned = (data.stats.learned || 0) + 1;
        if (data.stats.resolved) data.stats.resolved = data.stats.resolved; // no-op, kept for clarity
      } else if (body.action === 'reject') {
        penalize(data, payload);
        data.stats.rejected = (data.stats.rejected || 0) + 1;
      } else {
        return json(res, 400, { error: 'action must be accept or reject' });
      }
      store.save(data);
      return json(res, 200, publicState(data));
    } catch (e) {
      return json(res, 500, { error: String((e && e.message) || e) });
    }
  }

  if (req.method === 'GET') return serveStatic(req, res);
  return json(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`\n  Ambigua is running → http://localhost:${PORT}`);
  console.log(`  engine: ${hasKey() ? 'live LLM available (+ offline fallback)' : 'offline heuristic (no API key set)'}\n`);
  // Best-effort warm-up so /api/health reports the provider that actually works.
  llm.warmup().then((i) => {
    if (i.provider) console.log(`  live provider ready: ${i.provider} / ${i.model}\n`);
    else console.log('  no live provider reachable — running on the offline engine\n');
  });
});
