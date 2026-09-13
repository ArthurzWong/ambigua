'use strict';

/**
 * Tiny JSON store for Team Memory + usage stats.
 * Kept on disk (./.data/memory.json) so the learning loop persists across
 * restarts — the seed of the "it gets smarter for YOUR team" moat.
 */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '.data');
const FILE = path.join(DIR, 'memory.json');

const DEFAULTS = {
  phrases: [], // { topic, topicLabel, channel, tags:[..], accepts, rejects, updatedAt }
  stats: { asks: 0, clarified: 0, resolved: 0, learned: 0, rejected: 0 }
};

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return {
      phrases: Array.isArray(raw.phrases) ? raw.phrases : [],
      stats: Object.assign({ ...DEFAULTS.stats }, raw.stats || {})
    };
  } catch (_) {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

function save(data) {
  try {
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, FILE);
  } catch (_) { /* non-fatal: memory is an enhancement */ }
}

/** Estimated minutes saved. Deliberately simple + labelled as an estimate. */
function minutesSaved(stats) {
  return (stats.resolved || 0) * 4 + (stats.clarified || 0) * 6;
}

module.exports = { load, save, minutesSaved, FILE };
