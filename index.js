/**
 * index.js — Entry point / Heartbeat runner
 *
 * Usage:
 *   node index.js              # Run one heartbeat immediately
 *   node index.js --heartbeat  # Same (explicit flag)
 *
 * The Sales Manager Agent orchestrates the two sub-agents and logs all leads
 * to stdout (and optionally to a file log if LOG_FILE is set).
 *
 * In production this file is called by Paperclip's scheduler once per day.
 */

import 'dotenv/config';
import { runHeartbeat } from './agents/sales-manager.js';
import { logEvent, TOS } from './skills/logger.js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

async function main() {
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

  // ── Output lead report ────────────────────────────────────────────────────
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

  // ── Persist leads to /tmp (gitignored; for Paperclip DB ingestion) ────────
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

main();
