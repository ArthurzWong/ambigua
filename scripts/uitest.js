'use strict';

/**
 * UI self-test runner (headless Chrome).
 * Starts nothing itself — it expects `npm start` already running on PORT (default 4321).
 * Usage:  node server.js &   then   npm run uitest
 *
 * Set CHROME=/path/to/chrome to override the browser binary.
 */

const { execFileSync } = require('child_process');

const PORT = process.env.PORT || 4321;
const CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  'google-chrome', 'chromium', 'chromium-browser'
].filter(Boolean);

function findChrome() {
  const fs = require('fs');
  for (const c of CANDIDATES) {
    try { if (c.includes('/') ? fs.existsSync(c) : true) return c; } catch (_) { /* keep looking */ }
  }
  return null;
}

const chrome = findChrome();
if (!chrome) {
  console.error('No Chrome/Chromium found. Set CHROME=/path/to/chrome and retry.');
  process.exit(2);
}

const fs = require('fs');
const path = require('path');

// Start from a clean learning state so the clarify→confirm→resolve path is exercised.
try { fs.unlinkSync(path.join(__dirname, '..', '.data', 'memory.json')); } catch (_) { /* none yet */ }

let dom = '';
try {
  dom = execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--window-size=' + (process.env.WINDOW || '1440,900'),
    '--virtual-time-budget=9000', '--dump-dom',
    `http://localhost:${PORT}/?selftest=1`
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 });
} catch (e) {
  console.error('Failed to run headless Chrome. Is the server up on port ' + PORT + '?');
  console.error(String(e.message || e));
  process.exit(2);
}

const m = dom.match(/SELFTEST\s+(\d+)\/(\d+)/);
if (!m) {
  console.error('Self-test did not report. (page may not have loaded, or JS blocked)');
  process.exit(1);
}

const [, pass, total] = m;
const detail = (dom.match(/<pre id="selftest-out"[^>]*>([\s\S]*?)<\/pre>/) || [])[1] || '';
console.log('\n' + detail.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim() + '\n');
if (pass === total) {
  console.log(`✅ UI self-test passed ${pass}/${total}\n`);
  process.exit(0);
} else {
  console.error(`❌ UI self-test failed ${pass}/${total}\n`);
  process.exit(1);
}
