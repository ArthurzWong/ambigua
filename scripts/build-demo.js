'use strict';

/**
 * Builds a narrated demo video (MP4) of the running app.
 *
 * - drives the real UI over Chrome DevTools Protocol (Node's built-in WebSocket)
 * - captures a frame per demo beat
 * - synthesizes narration with macOS `say`
 * - assembles with ffmpeg
 *
 * Prereqs: the Ambigua server running on PORT (default 4321), ffmpeg, and macOS `say`.
 * Output: docs/assets/demo.mp4   (frames/narration kept in .openclaw/reel/)
 */

const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REEL = path.join(ROOT, '.openclaw', 'reel');
const OUT = path.join(ROOT, 'docs', 'assets', 'demo.mp4');
const PORT = process.env.PORT || 4321;
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const VOICE = process.env.VOICE || 'Samantha';
const W = 1440, H = 810, DEBUG_PORT = 9333;
const SKIP_CAPTURE = process.argv.includes('--assemble'); // reuse existing frames, just rebuild audio+video
const log = (...a) => console.log(...a);

fs.mkdirSync(REEL, { recursive: true });
try { fs.unlinkSync(path.join(ROOT, '.data', 'memory.json')); } catch (_) {}

const BEATS = [
  { frame: '00-title.png', text: 'Ambigua turns ambiguous workplace asks into resolved, grounded action — using the context of where your team already works.' },
  { frame: '01-intro.png', text: 'This is a real team workspace. People do not type specifications — they type things like, pull the numbers for the thing we talked about yesterday.' },
  { frame: '02-clarify.png', text: 'Most agents guess. Ambigua reads the channel, the files, yesterday’s messages and the calendar, then asks exactly one question — and shows the evidence behind every interpretation it ranked.' },
  { frame: '03-resolved.png', text: 'One tap, and it commits: the right artifact, with the sources that justify it. No wrong starts, no guesswork.' },
  { frame: '04-learned.png', text: 'Confirm once, and Team Memory remembers it for that channel. Next time it just knows — so it asks fewer questions the longer your team uses it, and the value meter tracks the time saved.' },
  { frame: '05-engresolved.png', text: 'And when the context is strong, it does not ask at all. Did we ship it? Yes — version two point three one is live, canary passed.' },
  { frame: '06-scan.png', text: 'It also watches a channel and flags ambiguous asks before anyone spends a day on the wrong work — catching the ambiguity tax before it is paid.' },
  { frame: '07-livedata.png', text: 'All of this runs on a live model and live data — not mock data. The workspace can be swapped for a real folder or a Slack export.' },
  { frame: '09-architecture.png', text: 'Under the hood: the ask enters a context layer, a ranking engine scores interpretations by token match, time window and channel affinity, and a confidence gate either resolves with sources or asks one question — while your confirmations feed back into Team Memory.' },
  { frame: '10-valuemap.png', text: 'The value is simple. Fewer wrong-work cycles, fewer interruptions, faster decisions, and institutional memory that compounds. It is built for cross-functional teams, for ops and support, and for any platform that needs a disambiguation layer.' },
  { frame: '08-end.png', text: 'Ambigua. The environment is the disambiguation engine. Zero-dependency Node, live model, live data. Open on GitHub. Built for the Best Use of Ambiguous AI track.' }
];

/* ── minimal CDP client over Node's built-in WebSocket ── */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0; const pending = new Map();
  const opened = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', () => rej(new Error('ws error')));
  });
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { opened, send, close: () => ws.close() };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (SKIP_CAPTURE) { log('· --assemble: reusing existing frames'); return; }
  // 0. health check
  try {
    const r = await fetch(`http://localhost:${PORT}/api/health`);
    if (!r.ok) throw new Error('bad health');
  } catch (_) {
    console.error(`Ambigua server not reachable on :${PORT}. Start it with: npm start`);
    process.exit(2);
  }

  // 1. title + end cards via one-shot screenshots
  log('· rendering title/end cards');
  const card = (title, sub, accent) => `<!doctype html><meta charset=utf-8><body style="margin:0;width:${W}px;height:${H}px;background:radial-gradient(1200px 600px at 20% -10%,rgba(124,92,255,.28),transparent 60%),#0a0e17;color:#e7ecf6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 120px">
    <div style="font-size:20px;letter-spacing:3px;color:${accent};text-transform:uppercase">${sub}</div>
    <div style="font-size:92px;font-weight:800;margin-top:18px;line-height:1.05">${title}</div>
    <div style="width:120px;height:6px;background:linear-gradient(90deg,#7c5cff,#22d3ee);border-radius:99px;margin-top:34px"></div></body>`;
  fs.writeFileSync(path.join(REEL, 'title.html'), card('Ambigua', 'Best Use of Ambiguous AI', '#c4b5fd'));
  fs.writeFileSync(path.join(REEL, 'end.html'), card('github.com/ArthurzWong/ambigua', 'Ambigua — resolve ambiguous asks', '#7dd3fc'));
  for (const n of ['title', 'end']) {
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${W},${H}`,
      `--default-background-color=0a0e17ff`, `--screenshot=${path.join(REEL, n === 'title' ? '00-title.png' : '08-end.png')}`,
      'file://' + path.join(REEL, n + '.html')], { stdio: 'ignore' });
  }

  // 2. launch Chrome with remote debugging (isolated profile)
  log('· launching headless Chrome');
  const profile = path.join(REEL, 'chrome-profile');
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, `--remote-debugging-port=${DEBUG_PORT}`,
    `--window-size=${W},${H}`, 'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch (_) { /* not up yet */ }
    await sleep(250);
  }
  if (!wsUrl) { chrome.kill(); throw new Error('could not reach Chrome debugging endpoint'); }

  const cdp = connect(wsUrl);
  await cdp.opened;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  const evalJS = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return r && r.result ? r.result.value : undefined;
  };
  const waitFor = async (expr, ms = 30000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await evalJS(expr)) return true; await sleep(250); }
    return false;
  };
  const shot = async (name) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(REEL, name), Buffer.from(r.data, 'base64'));
    log('   captured', name);
  };

  log('· driving the app (live engine)');
  await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/?engine=live` });
  await waitFor(`!!document.querySelector('#channels .ch-btn')`, 15000);
  await sleep(1200);
  await shot('01-intro.png');

  // beat: clarify
  await evalJS(`document.querySelectorAll('#presets .chip')[0].click(); true`);
  await waitFor(`!!document.querySelector('.card .opt')`, 60000);   // live model may take a few seconds
  await sleep(600);
  await shot('02-clarify.png');

  // beat: resolved (pick an option)
  await evalJS(`(document.querySelector('.card .opt:not(.other)')||{click(){}}).click(); true`);
  await waitFor(`!!document.querySelector('.card.resolved')`, 30000);
  await sleep(600);
  await shot('03-resolved.png');

  // beat: learned (Correct → Team Memory + value meter)
  await evalJS(`(document.querySelector('.card.resolved .btn-mini.ok')||{click(){}}).click(); true`);
  await sleep(1200);
  await shot('04-learned.png');

  // beat: strong context → resolves without asking (eng-infra)
  await evalJS(`document.querySelectorAll('#channels .ch-btn')[1].click(); true`);
  await evalJS(`document.querySelectorAll('#presets .chip')[2].click(); true`);
  await waitFor(`!!document.querySelector('.card')`, 60000);
  await sleep(1500);
  await shot('05-engresolved.png');

  // beat: scan (design has ambiguous asks)
  await evalJS(`document.querySelectorAll('#channels .ch-btn')[2].click(); true`);
  await evalJS(`document.querySelector('#scanBtn').click(); true`);
  await waitFor(`!!document.querySelector('#scanPanel .scan-head')`, 15000);
  await sleep(600);
  await shot('06-scan.png');

  // beat: live data source (real files from this repo)
  await evalJS(`document.querySelector('#dsPath').value = 'dir:${path.join(ROOT, 'src')}'; true`);
  await evalJS(`document.querySelector('#dsUse').click(); true`);
  await waitFor(`/source: dir:/.test(document.querySelector('#dsInfo').textContent)`, 15000);
  await sleep(700);
  await shot('07-livedata.png');

  cdp.close();
  chrome.kill();
  console.log('· frames done');
}

/* ── narration + ffmpeg assembly ── */
function ensureDiagramFrames() {
  const pairs = [
    ['architecture.png', '09-architecture.png'],
    ['value-map.png', '10-valuemap.png']
  ];
  for (const [src, dst] of pairs) {
    const from = path.join(ROOT, 'docs', 'assets', src);
    const to = path.join(REEL, dst);
    if (fs.existsSync(from) && !fs.existsSync(to)) { fs.copyFileSync(from, to); log('· copied', src, '→', dst); }
  }
}
function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, Object.assign({ stdio: 'ignore' }, opts));
}

function assemble() {
  log('· synthesizing narration');
  const audioParts = [];
  BEATS.forEach((b, i) => {
    const aiff = path.join(REEL, `b${i}.aiff`);
    const m4a = path.join(REEL, `a${i}.m4a`);
    run('/usr/bin/say', ['-v', VOICE, '-o', aiff, '--', b.text]);
    // pad 0.5s of silence so frames and narration stay aligned
    run('ffmpeg', ['-y', '-i', aiff, '-af', 'apad=pad_dur=0.5', '-c:a', 'aac', '-b:a', '128k', m4a]);
    audioParts.push(m4a);
    const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', m4a], { encoding: 'utf8' }).trim());
    b.dur = dur + 0.6; // hold each frame a touch longer than the voice
  });

  // audio concat list
  const alist = path.join(REEL, 'audio.txt');
  fs.writeFileSync(alist, audioParts.map((p) => `file '${p}'`).join('\n'));
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', alist, '-c:a', 'aac', '-b:a', '128k', path.join(REEL, 'audio.m4a')]);

  // image concat list (with per-beat durations)
  const vlist = path.join(REEL, 'video.txt');
  const lines = [];
  BEATS.forEach((b) => {
    lines.push(`file '${path.join(REEL, b.frame)}'`);
    lines.push(`duration ${b.dur.toFixed(2)}`);
  });
  lines.push(`file '${path.join(REEL, BEATS[BEATS.length - 1].frame)}'`); // trailing frame
  fs.writeFileSync(vlist, lines.join('\n'));
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', vlist,
    '-vf', `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0a0e17,format=yuv420p`,
    '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(REEL, 'video.mp4')]);

  log('· muxing');
  run('ffmpeg', ['-y', '-i', path.join(REEL, 'video.mp4'), '-i', path.join(REEL, 'audio.m4a'),
    '-c:v', 'copy', '-c:a', 'aac', '-shortest', OUT]);
}

(async () => {
  await main();
  ensureDiagramFrames();
  assemble();
  const size = (fs.statSync(OUT).size / 1024 / 1024).toFixed(1);
  let dur = 0;
  try { dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT], { encoding: 'utf8' }).trim()); } catch (_) {}
  log(`\n✅ demo video → ${path.relative(ROOT, OUT)}  (${size} MB, ${dur.toFixed(1)}s)`);
})().catch((e) => { console.error('build failed:', e.message); process.exit(1); });
