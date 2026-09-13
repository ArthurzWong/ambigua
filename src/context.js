'use strict';

/**
 * Mock workspace context.
 *
 * This is the "environment" the agent lives in: channels, people, files,
 * recent messages, and calendar events. Swap this out for real Slack / Drive /
 * Calendar connectors during the hackathon — the agent only reads this shape.
 *
 * Key fields the agent uses:
 *   - channel / topic: where things happened (context = relevance)
 *   - hoursAgo: recency (resolves "yesterday", "this morning", ...)
 *   - topic + topicLabel: the interpretation a candidate belongs to
 */

const WORKSPACE = {
  workspace: { name: 'Northwind Robotics', domain: 'northwind.slack.com' },
  viewer: { id: 'u_you', name: 'You', handle: '@you' },

  channels: [
    { id: 'C1', name: 'growth', topic: 'Q3 growth · churn · acquisition funnels' },
    { id: 'C2', name: 'eng-infra', topic: 'deploys · incidents · latency' },
    { id: 'C3', name: 'design', topic: 'brand · marketing site · decks' },
    { id: 'C4', name: 'general', topic: 'company-wide · board' }
  ],

  people: [
    { id: 'u_priya', name: 'Priya N.', role: 'PM', handle: '@priya' },
    { id: 'u_marco', name: 'Marco', role: 'Growth Lead', handle: '@marco' },
    { id: 'u_lena', name: 'Lena', role: 'Designer', handle: '@lena' },
    { id: 'u_sam', name: 'Sam', role: 'Infra Eng', handle: '@sam' }
  ],

  files: [
    {
      id: 'f_churn', name: 'q3-churn-numbers.xlsx', channel: 'growth',
      hoursAgo: 20, updatedLabel: 'yesterday',
      tags: ['churn', 'numbers', 'retention', 'cohort', 'q3'],
      summary: 'Q3 churn & retention numbers by cohort (cohort 4 flagged).',
      topic: 'q3-churn', topicLabel: 'Q3 churn numbers'
    },
    {
      id: 'f_acq', name: 'q3-acquisition-funnel.csv', channel: 'growth',
      hoursAgo: 40, updatedLabel: '2 days ago',
      tags: ['acquisition', 'numbers', 'cac', 'funnel', 'q3'],
      summary: 'Q3 acquisition funnel + CAC broken out by channel.',
      topic: 'q3-acq', topicLabel: 'Q3 acquisition funnel'
    },
    {
      id: 'f_seed', name: 'seed-round-deck-v6.key', channel: 'design',
      hoursAgo: 3, updatedLabel: '3h ago',
      tags: ['deck', 'seed', 'pitch', 'fundraising'],
      summary: 'Seed round pitch deck v6 (working copy).',
      topic: 'seed-deck', topicLabel: 'Seed pitch deck'
    },
    {
      id: 'f_board', name: 'board-update-q3.pptx', channel: 'general',
      hoursAgo: 26, updatedLabel: 'yesterday',
      tags: ['deck', 'board', 'update', 'q3'],
      summary: 'Q3 board update deck (draft awaiting polish).',
      topic: 'board-deck', topicLabel: 'Q3 board update deck'
    },
    {
      id: 'f_infra', name: 'incident-postmortem-0912.md', channel: 'eng-infra',
      hoursAgo: 21, updatedLabel: 'yesterday',
      tags: ['incident', 'postmortem', 'latency', 'cache'],
      summary: 'Postmortem for the 09-12 latency incident (cache stampede).',
      topic: 'incident', topicLabel: '09-12 latency incident'
    },
    {
      id: 'f_brand', name: 'brand-refresh-brief.md', channel: 'design',
      hoursAgo: 96, updatedLabel: '4 days ago',
      tags: ['brand', 'refresh', 'logo', 'brief'],
      summary: 'Brand refresh brief + moodboard pointers.',
      topic: 'brand', topicLabel: 'Brand refresh brief'
    }
  ],

  messages: [
    { id: 'm1', channel: 'growth', author: 'Priya N.', hoursAgo: 20, topic: 'q3-churn', topicLabel: 'Q3 churn numbers',
      text: 'the Q3 churn spike is worrying — numbers are in the churn sheet, can someone sanity-check cohort 4?' },
    { id: 'm2', channel: 'growth', author: 'Marco', hoursAgo: 19, topic: 'q3-acq', topicLabel: 'Q3 acquisition funnel',
      text: 'cohort 4 retention looks off vs the acquisition funnel, i will compare the CAC side' },
    { id: 'm3', channel: 'growth', author: 'Marco', hoursAgo: 40, topic: 'q3-acq', topicLabel: 'Q3 acquisition funnel',
      text: 'acquisition CAC by channel is updated in the funnel csv' },
    { id: 'm4', channel: 'eng-infra', author: 'Sam', hoursAgo: 5, topic: 'deploy', topicLabel: 'v2.31 deploy to prod',
      text: 'deployed v2.31 to prod, latency p99 back under 250ms' },
    { id: 'm5', channel: 'eng-infra', author: 'Sam', hoursAgo: 20, topic: 'incident', topicLabel: '09-12 latency incident',
      text: 'the 09-12 incident was a cache stampede, postmortem incoming' },
    { id: 'm6', channel: 'eng-infra', author: 'Sam', hoursAgo: 3, topic: 'deploy', topicLabel: 'v2.31 deploy to prod',
      text: 'yep v2.31 is live, canary passed, we are good' },
    { id: 'm7', channel: 'design', author: 'Lena', hoursAgo: 3, topic: 'seed-deck', topicLabel: 'Seed pitch deck',
      text: 'seed deck v6 is up — i still need the churn slide numbers from growth' },
    { id: 'm8', channel: 'design', author: 'Lena', hoursAgo: 26, topic: 'board-deck', topicLabel: 'Q3 board update deck',
      text: 'board update deck draft is in #general, want a polish pass before thursday' },
    { id: 'm9', channel: 'general', author: 'Priya N.', hoursAgo: 25, topic: 'board-deck', topicLabel: 'Q3 board update deck',
      text: 'board update deck attached — review before thursday please' },
    { id: 'm10', channel: 'design', author: 'Lena', hoursAgo: 96, topic: 'brand', topicLabel: 'Brand refresh brief',
      text: 'brand refresh brief is written, logos next' },
    { id: 'm11', channel: 'growth', author: 'Priya N.', hoursAgo: 21, topic: 'q3-churn', topicLabel: 'Q3 churn numbers',
      text: 'can someone pull the numbers for the thing we talked about yesterday? 🙏' },
    { id: 'm13', channel: 'design', author: 'Lena', hoursAgo: 4, topic: 'seed-deck', topicLabel: 'Seed pitch deck',
      text: "who's got the deck for the meeting? need it for the sync" }
  ],

  events: [
    { id: 'e1', title: 'Growth standup', hoursAgo: 20, attendees: ['Priya N.', 'Marco', 'You'],
      topic: 'q3-churn', topicLabel: 'Q3 churn numbers' },
    { id: 'e2', title: 'Board review', hoursAgo: 72, attendees: ['Exec team'],
      topic: 'board-deck', topicLabel: 'Q3 board update deck' },
    { id: 'e3', title: 'Seed investor sync', hoursAgo: 96, attendees: ['Priya N.', 'Lena'],
      topic: 'seed-deck', topicLabel: 'Seed pitch deck' }
  ]
};

module.exports = { WORKSPACE };
