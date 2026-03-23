/**
 * agents/phone-lead-finder.js
 *
 * Phone LeadFinder — Sub-Agent
 *
 * Persona: Human SDR focused on phone-system / UCaaS / VoIP solutions (Avox).
 * Searches r/sysadmin and r/VOIP for ICP signals (mid-market IT admins
 * discussing phone migrations, VoIP pain points, or UCaaS evaluations) and
 * returns a qualified lead object for the Sales Manager to review.
 *
 * Workflow:
 *   1. Use Reddit API (preferred) to fetch & search relevant posts
 *   2. Simulate "reading" each post (random delay)
 *   3. Score each post for ICP relevance
 *   4. Select the highest-scoring post as the lead signal
 *   5. Draft a TOS-safe LinkedIn connection note referencing Avox
 *   6. Return lead object — Sales Manager decides whether to send
 */

import { fetchSubredditPosts, searchSubreddit } from '../skills/reddit.js';
import { composeConnectionNote } from '../skills/linkedin.js';
import { logEvent, TOS } from '../skills/logger.js';
import { readPause } from '../skills/browser.js';

// ─── ICP Keywords ─────────────────────────────────────────────────────────────

const PHONE_KEYWORDS = [
  'voip', 'pbx', 'sip', 'ucaas', 'ccaas', 'phone system', 'phone migration',
  'teams phone', 'ring central', 'ringcentral', '8x8', 'zoom phone',
  'hosted pbx', 'on-prem phone', 'desk phone', 'softphone', 'call center',
  'unified communications', 'uc', 'pots', 'analog', 'pstn', 'trunk',
  'avox', 'telarus',
];

const ICP_SIGNALS = [
  'looking for', 'recommend', 'best solution', 'vendor', 'budget', 'rfp',
  'evaluation', 'migrating', 'switching', 'help', 'advice', 'suggestion',
  'what do you use', 'our company', 'our team', 'we are', 'we need',
  'replacing', 'upgrade', 'transition', 'move to cloud',
];

const SUBREDDITS = ['VOIP', 'sysadmin', 'ITManagers', 'MSP'];
const SEARCH_QUERIES = ['phone migration cloud', 'voip replacement options', 'ucaas recommendation'];

// ─── Relevance scoring ────────────────────────────────────────────────────────

/**
 * Score a post for ICP relevance (0–100).
 */
function scorePost(post) {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  let score = 0;

  for (const kw of PHONE_KEYWORDS) { if (text.includes(kw)) score += 5; }
  for (const sig of ICP_SIGNALS)   { if (text.includes(sig)) score += 10; }

  if (post.score > 10) score += 5;
  if (post.score > 50) score += 10;

  const ageHours = (Date.now() - new Date(post.created).getTime()) / 3_600_000;
  if (ageHours < 24) score += 15;
  else if (ageHours < 48) score += 8;

  return Math.min(score, 100);
}

/**
 * Extract the dominant pain point for personalisation.
 */
function extractPain(post) {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  if (text.includes('cost') || text.includes('expensive') || text.includes('bill'))
    return 'reducing phone system costs';
  if (text.includes('migration') || text.includes('replacing') || text.includes('upgrade'))
    return 'phone system migration';
  if (text.includes('teams') || text.includes('zoom') || text.includes('integration'))
    return 'unified-communications integration';
  if (text.includes('reliability') || text.includes('downtime') || text.includes('outage'))
    return 'call reliability and uptime';
  if (text.includes('remote') || text.includes('work from home') || text.includes('hybrid'))
    return 'supporting remote/hybrid workers';
  return 'phone system modernisation';
}

// ─── Main agent function ──────────────────────────────────────────────────────

/**
 * Run the Phone LeadFinder agent and return one qualified lead.
 *
 * @returns {Promise<Lead|null>}
 */
export async function runPhoneLeadFinder() {
  logEvent('info', '=== Phone LeadFinder started ===', { platform: 'Internal', tos: TOS.COMPLIANT });

  const allPosts = [];

  // Gather posts from each target subreddit
  for (const subreddit of SUBREDDITS) {
    const hotPosts = await fetchSubredditPosts(subreddit, 'hot', 10);
    allPosts.push(...hotPosts);

    // Rotate through search queries, one per subreddit to stay under rate limits
    const query = SEARCH_QUERIES[SUBREDDITS.indexOf(subreddit) % SEARCH_QUERIES.length];
    const searchPosts = await searchSubreddit(subreddit, query, 5);
    allPosts.push(...searchPosts);

    // Human-like pause between subreddit reads
    await readPause();
  }

  if (allPosts.length === 0) {
    logEvent('warn', 'Phone LeadFinder: no posts retrieved — check Reddit API credentials', {
      platform: 'Reddit',
      tos: TOS.COMPLIANT,
    });
    return null;
  }

  // Deduplicate
  const seen = new Set();
  const unique = allPosts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Score and sort
  const scored = unique
    .map((p) => ({ ...p, icpScore: scorePost(p) }))
    .filter((p) => p.icpScore >= 15)
    .sort((a, b) => b.icpScore - a.icpScore);

  logEvent('info', `Phone LeadFinder: ${scored.length} relevant posts found`, {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { total: unique.length, relevant: scored.length },
  });

  if (scored.length === 0) {
    logEvent('info', 'Phone LeadFinder: no ICP posts met threshold today', {
      platform: 'Internal',
      tos: TOS.COMPLIANT,
    });
    return null;
  }

  const best = scored[0];
  const pain = extractPain(best);

  const connectionNote = composeConnectionNote({
    redditPostTitle: best.title,
    subreddit: best.subreddit,
    pain,
    brand: 'Avox',
  });

  const lead = {
    type:           'phone',
    brand:          'Avox',
    redditPostUrl:  best.url,
    redditAuthor:   best.author,
    subreddit:      best.subreddit,
    postTitle:      best.title,
    postSnippet:    best.selftext.slice(0, 200),
    icpScore:       best.icpScore,
    pain,
    connectionNote,
    linkedInProfile: null,   // Populated by Sales Manager after human approval
    discoveredAt:   new Date().toISOString(),
    tosCompliant:   true,
  };

  logEvent('info', `Phone LeadFinder: lead selected — r/${lead.subreddit} by u/${lead.redditAuthor}`, {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { icpScore: lead.icpScore, url: lead.redditPostUrl },
  });

  return lead;
}

/**
 * @typedef {Object} Lead
 * @property {'cyber'|'phone'} type
 * @property {string} brand
 * @property {string} redditPostUrl
 * @property {string} redditAuthor
 * @property {string} subreddit
 * @property {string} postTitle
 * @property {string} postSnippet
 * @property {number} icpScore
 * @property {string} pain
 * @property {string} connectionNote
 * @property {string|null} linkedInProfile
 * @property {string} discoveredAt
 * @property {boolean} tosCompliant
 */
