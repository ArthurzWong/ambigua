'use strict';

/* Ambigua UI logic — every control is wired and gives feedback.
   No build step, no dependencies. */

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const strong = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const truncate = (s, n = 42) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

const state = { workspace: null, channel: 'growth', llmReady: false, hostedKey: false, llmInfo: null, lastAsk: null, stats: null, source: 'sample' };

const PRESETS = [
  { label: '“the numbers for the thing we talked about yesterday”', channel: 'growth',
    text: 'hey can you pull the numbers for the thing we talked about yesterday?' },
  { label: '“prep the deck for the meeting”', channel: 'design',
    text: 'can you prep the deck for the meeting?' },
  { label: '“did we ship it?”', channel: 'eng-infra', text: 'did we ship it?' },
  { label: '“send it to them”', channel: 'general', text: 'send it to them' }
];

/* ───────────────────────────── feedback ───────────────────────────── */

function toast(msg) {
  const box = $('#toast');
  if (!box) return;
  const t = el('div', 'toast', esc(msg));
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2400);
}

function engineLabel(mode) {
  const info = state.llmInfo || {};
  if (mode === 'offline') return 'heuristic';
  if (mode === 'live') return info.provider ? ('live · ' + info.provider + '/' + info.model) : 'live · no provider';
  return state.hostedKey ? ('auto · ' + info.provider + '/' + info.model) : 'auto · heuristic';
}

function applyState(s) {
  if (!s) return;
  state.stats = s.stats || state.stats;
  const pill = $('#metricPill');
  if (pill) pill.textContent = '≈' + (s.minutesSaved || 0) + ' min saved';
  renderMemory(s.phrases || []);
}

async function refreshState() {
  try {
    const r = await fetch('/api/state');
    if (r.ok) applyState(await r.json());
  } catch (_) { /* non-fatal */ }
}

/* ─────────────────────────── bootstrap ─────────────────────────── */

async function boot() {
  try {
    const [wsRes, healthRes] = await Promise.all([
      fetch('/api/workspace'),
      fetch('/api/health').catch(() => null)
    ]);
    state.workspace = await wsRes.json();
    if (healthRes && healthRes.ok) {
      const h = await healthRes.json();
      state.llmReady = !!h.llmReady;
      state.hostedKey = !!h.hostedKey;
      state.llmInfo = h.llm || null;
    }
    $('#healthDot').classList.add('ok');
  } catch (e) {
    $('#healthDot').classList.add('bad');
    pushError('Could not load workspace context. Is the server running? (npm start)');
    return;
  }
  renderChannels();
  renderPeople();
  renderContext();
  renderPresets();
  renderIntro();
  renderDataSource();
  const eng = new URLSearchParams(location.search).get('engine');
  if (eng && ['auto', 'offline', 'live'].includes(eng)) $('#mode').value = eng;
  $('#engineBadge').textContent = engineLabel($('#mode').value);
  refreshState();
  maybeAutoDemo();
}

/* ─────────────────────── live data source control ─────────────────────── */

function renderDataSource() {
  const ws = state.workspace || {};
  const src = ws.__source || state.source || 'sample';
  state.source = src;
  const f = (ws.files || []).length, m = (ws.messages || []).length, e = (ws.events || []).length;
  const badge = $('#dsCount');
  if (badge) badge.textContent = f + ' files';
  const info = $('#dsInfo');
  if (info) info.textContent = 'source: ' + src + ' · ' + f + ' files, ' + m + ' msgs, ' + e + ' events';
  const inp = $('#dsPath');
  if (inp && src !== 'sample') inp.value = src;
}

async function loadSource(spec) {
  try {
    const r = await fetch('/api/context', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: spec })
    });
    const data = await r.json();
    if (!r.ok || data.error) { toast('Source error: ' + (data.error || r.status)); return; }
    const ws = await (await fetch('/api/workspace')).json();
    state.workspace = ws;
    if (!(ws.channels || []).some((c) => c.name === state.channel)) {
      state.channel = (ws.channels[0] && ws.channels[0].name) || 'files';
    }
    renderChannels(); renderPeople(); renderContext(); renderDataSource();
    toast('Loaded ' + data.source + ' · ' + data.counts.files + ' files');
  } catch (e) {
    toast('Could not load source');
  }
}

/* Optional auto-run for demo videos / screenshots:
   open http://localhost:4321/?demo=1  → posts the flagship ask on load. */
function maybeAutoDemo() {
  const demo = new URLSearchParams(location.search).get('demo');
  if (!demo) return;
  const idx = Math.max(0, Math.min(PRESETS.length - 1, (parseInt(demo, 10) || 1) - 1));
  const p = PRESETS[idx];
  state.channel = p.channel;
  renderChannels();
  setTimeout(() => submit(p.text), 250);
}

/* ───────────────────────────── sidebar ───────────────────────────── */

function renderChannels() {
  const box = $('#channels');
  box.innerHTML = '';
  state.workspace.channels.forEach((c) => {
    const b = el('button', 'ch-btn' + (c.name === state.channel ? ' active' : ''),
      `<span class="hash">#</span><span>${esc(c.name)}</span>`);
    b.type = 'button';
    b.title = 'Switch to #' + c.name + ' — ' + c.topic;
    b.setAttribute('aria-pressed', String(c.name === state.channel));
    b.addEventListener('click', () => {
      state.channel = c.name;
      renderChannels();
      $('#channelTitle').textContent = '#' + c.name;
      $('#channelTopic').textContent = c.topic;
      toast('Now asking in #' + c.name);
    });
    box.appendChild(b);
  });
  const active = state.workspace.channels.find((c) => c.name === state.channel);
  if (active) {
    $('#channelTitle').textContent = '#' + active.name;
    $('#channelTopic').textContent = active.topic;
  }
}

function renderPeople() {
  const ul = $('#people');
  ul.innerHTML = '';
  state.workspace.people.forEach((p) => {
    const li = el('li');
    const b = el('button', 'person-btn',
      `<span class="av">${esc(p.name.slice(0, 1))}</span><span>${esc(p.name)} · ${esc(p.role)}</span>`);
    b.type = 'button';
    b.title = 'Mention ' + p.handle + ' in your ask';
    b.addEventListener('click', () => {
      const input = $('#input');
      input.value = (input.value ? input.value + ' ' : '') + p.handle + ' ';
      input.focus();
      toast('Added ' + p.handle + ' to your ask');
    });
    li.appendChild(b);
    ul.appendChild(li);
  });
}

function renderMemory(phrases) {
  const ul = $('#memoryList');
  if (!ul) return;
  ul.innerHTML = '';
  if (!phrases || !phrases.length) {
    ul.appendChild(el('li', 'ctx-item', '<div class="s">Nothing learned yet — confirm a resolution to teach me.</div>'));
    return;
  }
  phrases.slice(0, 6).forEach((p) => {
    ul.appendChild(el('li', 'ctx-item',
      `<div class="t">${esc(p.topicLabel)} <span class="learned-badge">×${esc(p.accepts)}</span></div>
       <div class="s">#${esc(p.channel || 'any')}${p.rejects ? ' · ' + p.rejects + ' corrected' : ''}</div>`));
  });
}

function renderContext() {
  $('#wsName').textContent = state.workspace.workspace.name;
  $('#wsSub').textContent = state.workspace.workspace.domain;

  const files = $('#ctxFiles');
  files.innerHTML = '';
  state.workspace.files.forEach((f) => {
    files.appendChild(ctxItem(
      `<div class="t">${esc(f.name)}</div>
       <div class="s">#${esc(f.channel)} · ${esc(f.updatedLabel)}</div>
       <div class="tags">${f.tags.slice(0, 4).map((t) => `<span>${esc(t)}</span>`).join('')}</div>`,
      `Open “${f.name}”`, f.topicLabel));
  });

  const msgs = $('#ctxMsgs');
  msgs.innerHTML = '';
  state.workspace.messages.slice(0, 6).forEach((m) => {
    msgs.appendChild(ctxItem(
      `<div class="ctx-msg"><b>${esc(m.author)}</b> in #${esc(m.channel)}: ${esc(m.text)}</div>
       <div class="s">${esc(m.topicLabel)}</div>`,
      `Ask about “${truncate(m.topicLabel)}”`, m.topicLabel));
  });

  const evs = $('#ctxEvents');
  evs.innerHTML = '';
  state.workspace.events.forEach((e) => {
    evs.appendChild(ctxItem(
      `<div class="t">${esc(e.title)}</div>
       <div class="s">${e.hoursAgo < 24 ? 'today' : Math.round(e.hoursAgo / 24) + 'd ago'} · ${esc(e.attendees.join(', '))}</div>`,
      `Ask about “${e.title}”`, e.topicLabel));
  });
}

function ctxItem(innerHTML, title, topicLabel) {
  const b = el('button', 'ctx-item clickable', innerHTML);
  b.type = 'button';
  b.title = title + '  (resolves to: ' + topicLabel + ')';
  b.addEventListener('click', () => submit(title, { select: topicLabel, display: title }));
  return b;
}

function renderPresets() {
  const box = $('#presets');
  box.innerHTML = '';
  PRESETS.forEach((p) => {
    const c = el('button', 'chip', esc(p.label));
    c.type = 'button';
    c.title = 'Try this ambiguous ask in #' + p.channel;
    c.addEventListener('click', () => {
      state.channel = p.channel;
      renderChannels();
      $('#input').value = p.text;
      submit(p.text);
    });
    box.appendChild(c);
  });
}

function renderIntro() {
  $('#msgs').appendChild(el('div', 'intro',
    `<h3>Post an ambiguous ask. Watch it get resolved against context.</h3>
     <p>Ambigua reads channels, files, recent messages and the calendar to decide whether to <b>answer</b> or ask one crisp question. Every confirmation is remembered, so it asks less over time. Ambiguity types it detects:</p>
     <div class="legend">
       <span class="tag referential">referential — “it”, “that thing”</span>
       <span class="tag temporal">temporal — “yesterday”, “last week”</span>
       <span class="tag scope">scope — “we”, “them”</span>
       <span class="tag multiple-plausible">multiple plausible</span>
       <span class="tag underspecified">underspecified</span>
       <span class="tag learned">learned</span>
     </div>`));
}

/* ───────────────────────────── thread ───────────────────────────── */

function pushUser(text) {
  const wrap = el('div', 'msg user');
  wrap.appendChild(el('div', 'bubble', esc(text)));
  $('#msgs').appendChild(wrap);
  scrollDown();
}

function pushError(text) {
  $('#msgs').appendChild(el('div', 'err', esc(text)));
  scrollDown();
}

function pushThinking() {
  const t = el('div', 'thinking', '<span class="b"></span><span class="b"></span><span class="b"></span><span>reasoning over workspace context…</span>');
  $('#msgs').appendChild(t);
  scrollDown();
  return t;
}

function scrollDown() {
  const m = $('#msgs');
  m.scrollTop = m.scrollHeight;
}

async function submit(text, opts = {}) {
  const message = (text || '').trim();
  if (!message && !opts.select) return;
  const prior = state.lastAsk;
  state.lastAsk = { message, channel: state.channel };
  $('#sendBtn').disabled = true;
  $('#sendBtn').textContent = 'Thinking…';
  pushUser(opts.display || message);
  $('#input').value = '';
  const thinking = pushThinking();

  try {
    const res = await fetch('/api/disambiguate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message, channel: state.channel, mode: $('#mode').value,
        select: opts.select || null,
        from: opts.select ? (prior ? prior.message : message) : message
      })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    thinking.remove();
    if (data.error) { pushError('Agent error: ' + data.error); return; }
    if (data.state) applyState(data.state);
    renderCard(data, opts.select ? (prior ? prior.message : message) : message);
  } catch (e) {
    thinking.remove();
    pushError('Could not reach the agent (' + e.message + '). Is the server running?');
  } finally {
    $('#sendBtn').disabled = false;
    $('#sendBtn').textContent = 'Ask';
    $('#input').focus();
  }
}

/* ─────────────────────────── agent card ─────────────────────────── */

function renderCard(r, originalAsk) {
  const card = el('div', 'card ' + (r.status === 'resolved' ? 'resolved' : 'clarify'));
  if (r.engine) $('#engineBadge').textContent = engineLabel($('#mode').value);

  const head = el('div', 'card-head');
  head.appendChild(el('span', 'status-pill ' + r.status,
    r.status === 'resolved' ? '✓ Resolved from context' : '? Needs one quick check'));
  (r.ambiguityTags || []).forEach((t) => {
    const key = String(t).split(':')[0];
    head.appendChild(el('span', 'tag ' + key, esc(t)));
  });
  if (r.engine === 'llm' && r.llmProvider) {
    head.appendChild(el('span', 'tag llm', esc(r.llmProvider + '/' + r.llmModel)));
  }
  card.appendChild(head);

  if (r.status === 'resolved' && r.answer) {
    card.appendChild(el('div', 'answer-head', strong(r.answer.headline)));
    if (r.answer.detail) card.appendChild(el('p', 'answer-detail', esc(r.answer.detail)));
    const src = el('div', 'ev');
    (r.answer.sources || []).forEach((s) => src.appendChild(el('div', 'ev-chip',
      `<span class="kind">source</span><span>${esc(s)}</span>`)));
    card.appendChild(src);

    const actions = el('div', 'card-actions');
    const copy = el('button', 'btn-mini copy-btn', 'Copy sources');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      const text = (r.answer.sources || []).join('\n');
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('no clipboard API');
        await Promise.race([
          navigator.clipboard.writeText(text),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 700))
        ]);
        copy.textContent = 'Copied ✓';
        toast('Sources copied to clipboard');
      } catch (_) {
        copy.textContent = 'Copy failed';
        toast('Clipboard blocked — sources are listed above');
      }
      setTimeout(() => { copy.textContent = 'Copy sources'; }, 1800);
    });
    actions.appendChild(copy);

    if (r.resolvedTopic) {
      const yes = el('button', 'btn-mini ok', 'Correct ✓');
      yes.type = 'button';
      yes.title = 'Confirm — remember this for your team';
      const no = el('button', 'btn-mini', 'Not quite');
      no.type = 'button';
      no.title = 'Tell the agent it guessed wrong';
      yes.addEventListener('click', () => sendFeedback('accept', r, originalAsk, yes, no));
      no.addEventListener('click', () => sendFeedback('reject', r, originalAsk, yes, no));
      actions.appendChild(yes);
      actions.appendChild(no);
    }
    card.appendChild(actions);
  } else {
    card.appendChild(el('div', 'q', strong(r.question || 'Could you clarify?')));
    const opts = el('div', 'opts');
    (r.options || []).forEach((o) => {
      const isOther = /something else/i.test(o);
      const b = el('button', 'opt' + (isOther ? ' other' : ''), esc(o));
      b.type = 'button';
      b.addEventListener('click', () => {
        opts.querySelectorAll('.opt').forEach((x) => { x.disabled = true; });
        submit(o, { select: o, display: o });
      });
      opts.appendChild(b);
    });
    card.appendChild(opts);
  }

  if (r.interpretations && r.interpretations.length) {
    const box = el('div', 'interps');
    box.appendChild(el('div', 'side-title', 'How I ranked the possibilities'));
    r.interpretations.forEach((it) => {
      const item = el('div', 'interp');
      item.appendChild(el('div', 'interp-top',
        `<span class="interp-label">${esc(it.label)}${it.learned ? ' <span class="learned-badge">learned</span>' : ''}</span>
         <span class="interp-score">score ${esc(it.score)} · rel ${Math.round(it.confidence * 100)}%</span>`));
      item.appendChild(el('div', 'bar',
        `<span style="width:${Math.max(6, Math.round(it.confidence * 100))}%"></span>`));
      const ev = el('div', 'ev');
      (it.evidence || []).forEach((e) => ev.appendChild(el('div', 'ev-chip',
        `<span class="kind">${esc(e.kind)}</span>
         <span>${esc(e.ref)}${e.why ? ` <span class="why">— ${esc(e.why)}</span>` : ''}</span>`)));
      item.appendChild(ev);
      box.appendChild(item);
    });
    card.appendChild(box);
  }

  const pct = Math.round((r.confidence || 0) * 100);
  const color = r.status === 'resolved' ? 'var(--ok)' : (pct > 45 ? 'var(--warn)' : 'var(--danger)');
  card.appendChild(el('div', 'conf-row',
    `<span>certainty</span>
     <span class="conf-meter"><span style="width:${pct}%;background:${color}"></span></span>
     <span>${pct}%</span>`));

  if (r.engineNote) card.appendChild(el('p', 'hint', esc(r.engineNote)));

  $('#msgs').appendChild(card);
  scrollDown();
  if (originalAsk) card.dataset.q = originalAsk;
}

async function sendFeedback(action, r, from, yesBtn, noBtn) {
  yesBtn.disabled = true; noBtn.disabled = true;
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action, topic: r.resolvedTopic, topicLabel: r.resolvedLabel,
        channel: state.channel, from: from || ''
      })
    });
    const s = await res.json();
    applyState(s);
    if (action === 'accept') { toast('Saved to Team Memory — I\'ll ask less next time'); yesBtn.textContent = 'Remembered ✓'; }
    else { toast('Noted — I\'ll weight that lower'); noBtn.textContent = 'Corrected'; }
  } catch (_) {
    yesBtn.disabled = false; noBtn.disabled = false;
    toast('Could not save feedback');
  }
}

/* ─────────────────────── proactive channel scan ─────────────────────── */

async function runScan() {
  const panel = $('#scanPanel');
  if (!panel) return;
  panel.hidden = false;
  panel.innerHTML = '<div class="thinking"><span class="b"></span><span class="b"></span><span class="b"></span><span>scanning #' + esc(state.channel) + ' for ambiguous asks…</span></div>';
  try {
    const res = await fetch('/api/scan?channel=' + encodeURIComponent(state.channel));
    const data = await res.json();
    const findings = data.findings || [];
    panel.innerHTML = '';
    const head = el('div', 'scan-head');
    head.appendChild(el('span', 'side-title', 'Ambigua spotted ' + findings.length + ' ambiguous ask' + (findings.length === 1 ? '' : 's') + ' in #' + esc(state.channel)));
    const close = el('button', 'btn-mini', 'Hide');
    close.type = 'button';
    close.addEventListener('click', () => { panel.hidden = true; });
    head.appendChild(close);
    panel.appendChild(head);
    if (!findings.length) {
      panel.appendChild(el('div', 's', 'Nothing ambiguous right now. Try another channel.'));
      return;
    }
    findings.forEach((f) => {
      const item = el('div', 'scan-item');
      item.appendChild(el('div', 'scan-txt',
        `<b>${esc(f.author)}</b> · ${f.hoursAgo < 24 ? 'today' : Math.round(f.hoursAgo / 24) + 'd ago'} — “${esc(f.text)}”`));
      item.appendChild(el('div', 's', 'Guessed: ' + esc(f.guess) + ' · certainty ' + Math.round(f.confidence * 100) + '%'));
      const b = el('button', 'btn-mini', 'Resolve this →');
      b.type = 'button';
      b.addEventListener('click', () => {
        state.channel = f.channel;
        renderChannels();
        panel.hidden = true;
        submit(f.text);
      });
      item.appendChild(b);
      panel.appendChild(item);
    });
  } catch (e) {
    panel.innerHTML = '<div class="err">Scan failed — is the server running?</div>';
  }
}

/* ───────────────────────────── wiring ───────────────────────────── */

$('#composer').addEventListener('submit', (e) => { e.preventDefault(); submit($('#input').value); });

$('#resetBtn').addEventListener('click', () => {
  $('#msgs').innerHTML = '';
  renderIntro();
  toast('Thread cleared');
});

$('#scanBtn').addEventListener('click', runScan);

$('#mode').addEventListener('change', () => {
  $('#engineBadge').textContent = engineLabel($('#mode').value);
  const m = $('#mode').value;
  if (m === 'live' && !state.llmReady) toast('No LLM provider reachable — will fall back to the offline engine');
  else toast('Engine set to ' + engineLabel(m));
});

$('#input').addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#input').value = ''; });

// Data-source controls
$('#dsSample').addEventListener('click', () => loadSource('sample'));
$('#dsReload').addEventListener('click', () => loadSource(state.source || 'sample'));
$('#dsUse').addEventListener('click', () => {
  const v = ($('#dsPath').value || '').trim();
  if (!v) { toast('Enter dir:/path or json:/path'); return; }
  loadSource(v);
});

boot();
