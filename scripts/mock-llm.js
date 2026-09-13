'use strict';

/**
 * Tiny OpenAI-compatible mock LLM (for fast, deterministic tests of Live mode).
 * Usage:  node scripts/mock-llm.js [port]   (default 8799)
 * Then run Ambigua with:
 *   OPENAI_API_KEY=test OPENAI_BASE_URL=http://localhost:8799/v1 OPENAI_MODEL=mock-glm LLM_PROVIDER=openai npm start
 */

const http = require('http');
const PORT = parseInt(process.argv[2] || process.env.MOCK_PORT || '8799', 10);

const RESULT = {
  status: 'resolved',
  confidence: 0.83,
  ambiguityTags: ['referential', 'temporal'],
  question: null,
  options: [],
  answer: {
    headline: 'You mean **Q3 churn numbers**.',
    detail: 'Mock model response (offline test provider).',
    sources: ['#growth · q3-churn-numbers.xlsx', '#growth · Priya N.']
  }
};

const server = http.createServer((req, res) => {
  if (req.method !== 'POST') { res.writeHead(405); return res.end('{}'); }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'mock-1', object: 'chat.completion', model: process.env.OPENAI_MODEL || 'mock-glm',
      choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(RESULT) }, finish_reason: 'stop' }],
      usage: { total_tokens: 42 }
    }));
  });
});
server.listen(PORT, () => console.log('mock LLM listening on http://localhost:' + PORT));
