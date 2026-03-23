/**
 * index.js — Entry point / Heartbeat runner + Thread Reviewer
 *
 * Usage:
 *   node index.js              # Run one heartbeat (lead generation)
 *   node index.js --heartbeat  # Same (explicit flag)
 *   node index.js --review     # Thread review: list relevant Reddit threads
 *                              #   and produce a post draft for manual posting
 *
 * The Sales Manager Agent orchestrates the two sub-agents and logs all leads
 * to stdout (and optionally to a file log if LOG_FILE is set).
 *
 * In production this file is called by Paperclip's scheduler once per day.
 */

import 'dotenv/config';
import { runHeartbeat } from './agents/sales-manager.js';
import { runThreadReviewer } from './agents/thread-reviewer.js';
import { logEvent, TOS } from './skills/logger.js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// ─── Heartbeat (lead generation) ──────────────────────────────────────────────

async function heartbeat() {
  logEvent('info', '🚀 Sales Team heartbeat starting', { platform: 'Internal', tos: TOS.COMPLIANT });

  let leads = [];

  try {
    leads = await runHeartbeat();
  } catch (err) {
    logEvent('error', `Fatal error in heartbeat: ${err.message}`, {
      platform: 'Internal',
      tos: TOS.VIOLATION,
      meta: { stack: err.stack },
    });
    process.exit(1);
  }

  // ── Output lead report ──────────────────────────────────────────────────
  logEvent('info', `\n${'─'.repeat(60)}\n  DAILY LEAD REPORT — ${new Date().toDateString()}\n${'─'.repeat(60)}`, {
    platform: 'Internal',
    tos: TOS.COMPLIANT,
  });

  if (leads.length === 0) {
    logEvent('warn', 'No leads generated today. Check API credentials and try again.', {
      platform: 'Internal',
      tos: TOS.CAUTION,
    });
  }

  leads.forEach((lead, idx) => {
    logEvent('info', `\nLead ${idx + 1} of ${leads.length}:`, {
      platform: 'Internal',
      tos: TOS.COMPLIANT,
      meta: {
        type:           lead.type,
        brand:          lead.brand,
        subreddit:      `r/${lead.subreddit}`,
        author:         `u/${lead.redditAuthor}`,
        postTitle:      lead.postTitle,
        postUrl:        lead.redditPostUrl,
        icpScore:       lead.icpScore,
        pain:           lead.pain,
        linkedIn:       lead.linkedInProfile ?? 'pending human review',
        requestSent:    lead.connectionRequestSent ?? false,
        connectionNote: lead.connectionNote,
        discoveredAt:   lead.discoveredAt,
      },
    });
  });

  // ── Persist leads to /tmp (gitignored; for Paperclip DB ingestion) ──────
  if (leads.length > 0) {
    try {
      mkdirSync('/tmp/sales-team-leads', { recursive: true });
      const outPath = resolve(`/tmp/sales-team-leads/leads_${Date.now()}.json`);
      writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), leads }, null, 2));
      logEvent('info', `Lead data saved to ${outPath}`, { platform: 'Internal', tos: TOS.COMPLIANT });
    } catch (err) {
      logEvent('warn', `Could not persist leads: ${err.message}`, { platform: 'Internal', tos: TOS.CAUTION });
    }
  }

  logEvent('info', '✅ Heartbeat complete', { platform: 'Internal', tos: TOS.COMPLIANT });
}

// ─── Thread review + post draft ───────────────────────────────────────────────

// Box-drawing constants used in the formatted review output
const BOX_WIDTH        = 58;
const TITLE_PAD_WIDTH  = 38;
const BODY_PAD_WIDTH   = 27;

/**
 * Print a section divider with a label.
 */
function divider(label) {
  const line = '═'.repeat(60);
  console.log(`\n${line}\n  ${label}\n${line}`);
}

async function review() {
  logEvent('info', '🔍 Thread Review starting', { platform: 'Internal', tos: TOS.COMPLIANT });

  let result;
  try {
    result = await runThreadReviewer();
  } catch (err) {
    logEvent('error', `Fatal error in thread review: ${err.message}`, {
      platform: 'Internal',
      tos: TOS.VIOLATION,
      meta: { stack: err.stack },
    });
    process.exit(1);
  }

  const { cyberThreads, phoneThreads, cyberPost, phonePost } = result;

  // ── Cyber threads ────────────────────────────────────────────────────────
  divider(`CYBERSECURITY THREADS  (${new Date().toDateString()})`);
  if (cyberThreads.length === 0) {
    console.log('  No relevant threads found. Check API credentials.\n');
  } else {
    cyberThreads.forEach((t) => {
      console.log(`\n  #${t.rank} [${t.subreddit}]  ↑${t.upvotes}  ${t.age}  (relevance: ${t.relevanceScore})`);
      console.log(`  Title : ${t.title}`);
      console.log(`  Link  : ${t.url}`);
      console.log(`  By    : ${t.author}`);
      if (t.snippet) console.log(`  Snip  : ${t.snippet}`);
    });
  }

  // ── Phone threads ────────────────────────────────────────────────────────
  divider(`PHONE / VoIP THREADS  (${new Date().toDateString()})`);
  if (phoneThreads.length === 0) {
    console.log('  No relevant threads found. Check API credentials.\n');
  } else {
    phoneThreads.forEach((t) => {
      console.log(`\n  #${t.rank} [${t.subreddit}]  ↑${t.upvotes}  ${t.age}  (relevance: ${t.relevanceScore})`);
      console.log(`  Title : ${t.title}`);
      console.log(`  Link  : ${t.url}`);
      console.log(`  By    : ${t.author}`);
      if (t.snippet) console.log(`  Snip  : ${t.snippet}`);
    });
  }

  // ── Cyber post draft ─────────────────────────────────────────────────────
  divider(`DRAFT POST — CYBERSECURITY  →  r/${cyberPost.subreddit}`);
  console.log(`\n  ${cyberPost.note}\n`);
  console.log(`  ┌─ TITLE (copy this) ${'─'.repeat(TITLE_PAD_WIDTH)}`);
  console.log(`  │ ${cyberPost.title}`);
  console.log(`  └${'─'.repeat(BOX_WIDTH)}\n`);
  console.log(`  ┌─ BODY (copy this — Markdown) ${'─'.repeat(BODY_PAD_WIDTH)}`);
  cyberPost.body.split('\n').forEach((line) => console.log(`  │ ${line}`));
  console.log(`  └${'─'.repeat(BOX_WIDTH)}`);
  console.log(`\n  Character count: ${cyberPost.charCount} / ~40,000 Reddit max\n`);

  // ── Phone post draft ─────────────────────────────────────────────────────
  divider(`DRAFT POST — PHONE / VoIP  →  r/${phonePost.subreddit}`);
  console.log(`\n  ${phonePost.note}\n`);
  console.log(`  ┌─ TITLE (copy this) ${'─'.repeat(TITLE_PAD_WIDTH)}`);
  console.log(`  │ ${phonePost.title}`);
  console.log(`  └${'─'.repeat(BOX_WIDTH)}\n`);
  console.log(`  ┌─ BODY (copy this — Markdown) ${'─'.repeat(BODY_PAD_WIDTH)}`);
  phonePost.body.split('\n').forEach((line) => console.log(`  │ ${line}`));
  console.log(`  └${'─'.repeat(BOX_WIDTH)}`);
  console.log(`\n  Character count: ${phonePost.charCount} / ~40,000 Reddit max\n`);

  // ── Persist review to /tmp ────────────────────────────────────────────────
  try {
    mkdirSync('/tmp/sales-team-leads', { recursive: true });
    const outPath = resolve(`/tmp/sales-team-leads/review_${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      cyberThreads,
      phoneThreads,
      cyberPost,
      phonePost,
    }, null, 2));
    logEvent('info', `Review saved to ${outPath}`, { platform: 'Internal', tos: TOS.COMPLIANT });
  } catch (err) {
    logEvent('warn', `Could not persist review: ${err.message}`, { platform: 'Internal', tos: TOS.CAUTION });
  }

  logEvent('info', '✅ Thread review complete', { platform: 'Internal', tos: TOS.COMPLIANT });
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--review')) {
  review();
} else {
  heartbeat();
}
