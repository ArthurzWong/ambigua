'use strict';

/**
 * Context sources — the workspace data the agent reasons over can be swapped at
 * runtime, so Ambigua is not limited to the sample dataset.
 *
 *   sample            → built-in demo workspace (src/context.js)
 *   dir:/abs/path     → LIVE: real files from a folder on disk
 *   json:/abs/path    → LIVE: an export with { workspace, channels, files, messages, events }
 *                       (the shape you'd produce from Slack/Drive/Gmail/Calendar exports
 *                        or a real connector)
 *
 * Real connector adapters (Slack/Google/Microsoft) just need to return the same
 * shape as `blank()` below — the engine is already dataset-agnostic.
 */

const fs = require('fs');
const path = require('path');
const { WORKSPACE } = require('./context');

function blank(name, domain) {
  return {
    workspace: { name, domain },
    viewer: { id: 'u_you', name: 'You', handle: '@you' },
    channels: [], people: [], files: [], messages: [], events: []
  };
}

function fromDir(dir) {
  const base = path.resolve(dir);
  const out = blank(path.basename(base) || 'folder', base);
  out.channels = [{ id: 'C1', name: 'files', topic: 'local files under ' + base }];
  const files = [];
  const walk = (d, depth) => {
    if (depth > 2) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p, depth + 1); continue; }
      let st;
      try { st = fs.statSync(p); } catch (_) { continue; }
      if (st.size > 5_000_000) continue;
      const ext = (e.name.split('.').pop() || '').toLowerCase();
      files.push({
        id: p, name: e.name, channel: 'files',
        hoursAgo: +(((Date.now() - st.mtimeMs) / 3.6e6).toFixed(1)),
        updatedLabel: new Date(st.mtimeMs).toISOString().slice(0, 10),
        tags: [ext],
        summary: `Local file (${Math.round(st.size / 1024)} KB): ${path.relative(base, p)}`,
        topic: 'file:' + path.relative(base, p),
        topicLabel: e.name
      });
    }
  };
  walk(base, 0);
  out.files = files.slice(0, 150);
  return out;
}

function fromJson(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    workspace: raw.workspace || { name: 'Imported workspace', domain: String(file) },
    viewer: raw.viewer || { id: 'u_you', name: 'You', handle: '@you' },
    channels: raw.channels || [], people: raw.people || [],
    files: raw.files || [], messages: raw.messages || [], events: raw.events || []
  };
}

function load(spec) {
  const s = String(spec == null || spec === '' ? 'sample' : spec).trim();
  if (s.startsWith('dir:')) return fromDir(s.slice(4));
  if (s.startsWith('json:')) return fromJson(s.slice(5));
  return WORKSPACE;
}

function describe(dataset) {
  const d = dataset || {};
  return {
    workspace: (d.workspace && d.workspace.name) || 'unknown',
    files: (d.files || []).length,
    messages: (d.messages || []).length,
    events: (d.events || []).length,
    channels: (d.channels || []).length
  };
}

module.exports = { load, describe, fromDir, fromJson, blank, WORKSPACE };
