'use strict';

/**
 * Smoke test — runs the offline engine against the four demo scenarios.
 * Usage: node scripts/smoke.js
 */

const { disambiguate } = require('../src/agent');

const SCENARIOS = [
  { name: 'A · "the numbers ... yesterday"  (channel: growth)', channel: 'growth', msg: 'hey can you pull the numbers for the thing we talked about yesterday?' },
  { name: 'B · "prep the deck for the meeting"  (channel: design)', channel: 'design', msg: 'can you prep the deck for the meeting?' },
  { name: 'C · "did we ship it?"  (channel: eng-infra)', channel: 'eng-infra', msg: 'did we ship it?' },
  { name: 'D · "send it to them"  (channel: general)', channel: 'general', msg: 'send it to them' }
];

(async () => {
  for (const s of SCENARIOS) {
    const r = await disambiguate({ message: s.msg, channel: s.channel, mode: 'offline' });
    console.log('\n============================================================');
    console.log(s.name);
    console.log(`  status: ${r.status}   confidence: ${r.confidence}   engine: ${r.engine}`);
    console.log(`  tags: ${r.ambiguityTags.join(', ')}`);
    (r.interpretations || []).forEach((it) => {
      console.log(`   - ${it.label}  [score ${it.score} · rel ${it.confidence}]`);
      (it.evidence || []).slice(0, 2).forEach((e) => console.log(`        · ${e.ref}  (${e.why})`));
    });
    if (r.question) console.log(`  Q: ${r.question.replace(/\*\*/g, '')}\n     options: ${r.options.join(' | ')}`);
    if (r.answer) console.log(`  A: ${r.answer.headline.replace(/\*\*/g, '')}  sources: ${r.answer.sources.join(', ')}`);
  }
  console.log('\n============================================================\n');
})();
