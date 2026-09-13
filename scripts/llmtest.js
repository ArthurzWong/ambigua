'use strict';

/**
 * Live-LLM smoke test. Verifies at least one provider answers and returns JSON.
 * Usage:  npm run llmtest
 */

const llm = require('../src/llm');

(async () => {
  const list = llm.providerList();
  console.log('candidates (priority order):', list.map((p) => `${p.name}${p.key ? '' : ' (no key)'} / ${p.model}`).join('  →  '));
  console.log('calling…\n');
  const t0 = Date.now();
  try {
    const r = await llm.chatJSON([
      { role: 'system', content: 'Reply with JSON only.' },
      { role: 'user', content: 'Return exactly {"ok":true,"agent":"ambigua"}' }
    ]);
    console.log(`✅ success via ${r.provider} / ${r.model}  (${Date.now() - t0} ms)`);
    console.log('   parsed:', JSON.stringify(r.json));
    process.exit(0);
  } catch (e) {
    console.error('❌ no provider answered:', e.message);
    process.exit(1);
  }
})();
