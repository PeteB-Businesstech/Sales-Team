/**
 * agents/sales-manager.js
 *
 * Sales Manager Agent — Orchestrator
 *
 * Persona: Thoughtful, compliant, patient Sales Manager.
 *
 * Responsibilities:
 *   1. Run the daily heartbeat cycle (called once per day by index.js)
 *   2. Delegate to Cyber LeadFinder and Phone LeadFinder sub-agents
 *   3. Enforce the daily quota (EXACTLY 2 leads per heartbeat)
 *   4. Review each lead for TOS compliance before sending outreach
 *   5. Trigger LinkedIn outreach (or queue for human approval if no session)
 *   6. Log the full session with TOS compliance score
 *   7. Return the two qualified leads as structured output
 *
 * Guardrails:
 *   - <5 actions/day/platform
 *   - 2–5 min per lead-gen cycle
 *   - All browser scripts / drafts reviewed here before execution
 *   - Hard stop on any TOS.VIOLATION signal
 */

import 'dotenv/config';
import { runCyberLeadFinder }  from './cyber-lead-finder.js';
import { runPhoneLeadFinder }  from './phone-lead-finder.js';
import { findLinkedInProfile, sendConnectionRequest } from '../skills/linkedin.js';
import { logEvent, TOS } from '../skills/logger.js';
import { actionDelay } from '../skills/browser.js';

const DAILY_LEAD_QUOTA = Number(process.env.DAILY_LEAD_QUOTA ?? 2);

// ─── TOS compliance check ─────────────────────────────────────────────────────

/**
 * Validate a lead for TOS compliance before any outreach.
 * Returns false (and logs) if the lead should be blocked.
 */
function isTosCompliant(lead) {
  if (!lead) return false;
  if (!lead.tosCompliant) {
    logEvent('error', 'Lead flagged as non-compliant — skipping', {
      platform: 'Internal',
      tos: TOS.VIOLATION,
      meta: { lead },
    });
    return false;
  }
  if (!lead.redditAuthor || lead.redditAuthor === '[deleted]') {
    logEvent('warn', 'Lead author is deleted/unknown — skipping outreach', {
      platform: 'Internal',
      tos: TOS.CAUTION,
    });
    return false;
  }
  return true;
}

// ─── Outreach pipeline ────────────────────────────────────────────────────────

/**
 * For a given lead:
 *   1. Search LinkedIn for the Reddit author's profile
 *   2. Send (or queue) the personalized connection request
 *
 * @param {object} lead
 * @returns {Promise<object>} Updated lead with linkedInProfile populated
 */
async function processOutreach(lead) {
  logEvent('info', `Processing outreach for u/${lead.redditAuthor} (${lead.brand})`, {
    platform: 'LinkedIn',
    tos: TOS.COMPLIANT,
  });

  // Search LinkedIn — may return null if session cookie is absent
  const profileUrl = await findLinkedInProfile(lead.redditAuthor);
  lead.linkedInProfile = profileUrl;

  if (profileUrl) {
    await actionDelay();
    const sent = await sendConnectionRequest(profileUrl, lead.connectionNote);
    lead.connectionRequestSent = sent;
    logEvent('info', `Connection request ${sent ? 'SENT' : 'QUEUED for human review'}`, {
      platform: 'LinkedIn',
      tos: TOS.COMPLIANT,
      meta: { profileUrl, sent },
    });
  } else {
    lead.connectionRequestSent = false;
    logEvent('info', `No LinkedIn profile found — lead queued for human review`, {
      platform: 'LinkedIn',
      tos: TOS.COMPLIANT,
      meta: { redditAuthor: lead.redditAuthor },
    });
  }

  return lead;
}

// ─── Heartbeat cycle ──────────────────────────────────────────────────────────

/**
 * Run the daily heartbeat cycle.
 *
 * Generates EXACTLY DAILY_LEAD_QUOTA (default 2) leads:
 *   - 1 from Cyber LeadFinder (Telarus / NordLayer / Trustwave)
 *   - 1 from Phone LeadFinder (Avox)
 *
 * Returns an array of qualified lead objects.
 *
 * @returns {Promise<object[]>}
 */
export async function runHeartbeat() {
  const cycleStart = Date.now();
  logEvent('info', `Sales Manager: heartbeat started — quota=${DAILY_LEAD_QUOTA}`, {
    platform: 'Internal',
    tos: TOS.COMPLIANT,
  });

  const leads = [];

  // ── 1. Cyber LeadFinder ─────────────────────────────────────────────────────
  logEvent('info', 'Sales Manager: delegating to Cyber LeadFinder', {
    platform: 'Internal',
    tos: TOS.COMPLIANT,
  });

  let cyberLead = null;
  try {
    cyberLead = await runCyberLeadFinder();
  } catch (err) {
    logEvent('error', `Cyber LeadFinder threw: ${err.message}`, {
      platform: 'Internal',
      tos: TOS.CAUTION,
    });
  }

  if (cyberLead && isTosCompliant(cyberLead)) {
    cyberLead = await processOutreach(cyberLead);
    leads.push(cyberLead);
    logEvent('info', 'Sales Manager: Cyber lead accepted', {
      platform: 'Internal',
      tos: TOS.COMPLIANT,
      meta: { icpScore: cyberLead.icpScore, subreddit: cyberLead.subreddit },
    });
  } else {
    logEvent('warn', 'Sales Manager: Cyber LeadFinder returned no qualifying lead today', {
      platform: 'Internal',
      tos: TOS.COMPLIANT,
    });
  }

  // Pause between agent delegations (human pace)
  await actionDelay();

  // ── 2. Phone LeadFinder ─────────────────────────────────────────────────────
  logEvent('info', 'Sales Manager: delegating to Phone LeadFinder', {
    platform: 'Internal',
    tos: TOS.COMPLIANT,
  });

  let phoneLead = null;
  try {
    phoneLead = await runPhoneLeadFinder();
  } catch (err) {
    logEvent('error', `Phone LeadFinder threw: ${err.message}`, {
      platform: 'Internal',
      tos: TOS.CAUTION,
    });
  }

  if (phoneLead && isTosCompliant(phoneLead)) {
    phoneLead = await processOutreach(phoneLead);
    leads.push(phoneLead);
    logEvent('info', 'Sales Manager: Phone lead accepted', {
      platform: 'Internal',
      tos: TOS.COMPLIANT,
      meta: { icpScore: phoneLead.icpScore, subreddit: phoneLead.subreddit },
    });
  } else {
    logEvent('warn', 'Sales Manager: Phone LeadFinder returned no qualifying lead today', {
      platform: 'Internal',
      tos: TOS.COMPLIANT,
    });
  }

  // ── 3. Quota enforcement ────────────────────────────────────────────────────
  const cycleMs = Date.now() - cycleStart;

  if (leads.length === DAILY_LEAD_QUOTA) {
    logEvent('info', `Sales Manager: quota met — ${leads.length}/${DAILY_LEAD_QUOTA} leads generated in ${cycleMs}ms`, {
      platform: 'Internal',
      tos: TOS.COMPLIANT,
      meta: { leads: leads.map((l) => ({ type: l.type, subreddit: l.subreddit, icpScore: l.icpScore })) },
    });
  } else {
    logEvent('warn', `Sales Manager: quota NOT met — ${leads.length}/${DAILY_LEAD_QUOTA} leads generated in ${cycleMs}ms`, {
      platform: 'Internal',
      tos: TOS.CAUTION,
      meta: { reason: 'Insufficient qualifying posts found today — will retry next heartbeat' },
    });
  }

  return leads;
}
