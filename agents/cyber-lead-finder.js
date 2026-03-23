/**
 * agents/cyber-lead-finder.js
 *
 * Cyber LeadFinder — Sub-Agent
 *
 * Persona: Human SDR focused on cybersecurity solutions (Telarus / NordLayer /
 * Trustwave).  Searches r/cybersecurity and r/ITManagers for ICP signals
 * (mid-market IT decision-makers discussing phone/VoIP + cyber threats) and
 * returns a qualified lead object for the Sales Manager to review.
 *
 * Workflow:
 *   1. Use Reddit API (preferred) to fetch & search relevant posts
 *   2. Simulate "reading" each post (random delay)
 *   3. Score each post for ICP relevance
 *   4. Select the highest-scoring post as the lead signal
 *   5. Draft a TOS-safe LinkedIn connection note
 *   6. Return lead object — Sales Manager decides whether to send
 */

import { fetchSubredditPosts, searchSubreddit } from '../skills/reddit.js';
import { composeConnectionNote } from '../skills/linkedin.js';
import { logEvent, TOS } from '../skills/logger.js';
import { readPause } from '../skills/browser.js';

// ─── ICP Keywords ─────────────────────────────────────────────────────────────

const CYBER_KEYWORDS = [
  'phone', 'voip', 'ucaas', 'sip', 'pbx', 'cybersecurity', 'threat', 'zero trust',
  'firewall', 'endpoint', 'ransomware', 'compliance', 'soc', 'mdr', 'sase',
  'network security', 'data breach', 'phishing', 'mfa', 'identity', 'cloud security',
];

const ICP_SIGNALS = [
  'looking for', 'recommend', 'best solution', 'vendor', 'budget', 'rfp',
  'evaluation', 'migrating', 'switching', 'help', 'advice', 'suggestion',
  'what do you use', 'our company', 'our team', 'we are', 'we need',
];

const SUBREDDITS = ['cybersecurity', 'ITManagers', 'netsec', 'sysadmin'];
const SEARCH_QUERY = 'phone system cyber threats security';

// ─── Relevance scoring ────────────────────────────────────────────────────────

/**
 * Score a post for ICP relevance (0–100).
 * Higher = stronger buying signal.
 */
function scorePost(post) {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  let score = 0;

  for (const kw of CYBER_KEYWORDS)  { if (text.includes(kw)) score += 5; }
  for (const sig of ICP_SIGNALS)    { if (text.includes(sig)) score += 10; }

  // Boost for engagement
  if (post.score > 10) score += 5;
  if (post.score > 50) score += 10;

  // Recency boost (posts in last 48 h)
  const ageHours = (Date.now() - new Date(post.created).getTime()) / 3_600_000;
  if (ageHours < 24) score += 15;
  else if (ageHours < 48) score += 8;

  return Math.min(score, 100);
}

/**
 * Extract the dominant pain point from a post for personalisation.
 */
function extractPain(post) {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  if (text.includes('ransomware') || text.includes('breach'))  return 'ransomware and breach risks';
  if (text.includes('compliance') || text.includes('audit'))   return 'compliance requirements';
  if (text.includes('voip') || text.includes('phone'))         return 'VoIP/phone security gaps';
  if (text.includes('zero trust') || text.includes('sase'))    return 'zero-trust architecture';
  if (text.includes('phishing') || text.includes('mfa'))       return 'phishing and identity protection';
  return 'cybersecurity posture';
}

// ─── Main agent function ──────────────────────────────────────────────────────

/**
 * Run the Cyber LeadFinder agent and return one qualified lead.
 *
 * @returns {Promise<Lead|null>}
 */
export async function runCyberLeadFinder() {
  logEvent('info', '=== Cyber LeadFinder started ===', { platform: 'Internal', tos: TOS.COMPLIANT });

  const allPosts = [];

  // Gather posts from each target subreddit
  for (const subreddit of SUBREDDITS) {
    const hotPosts    = await fetchSubredditPosts(subreddit, 'hot', 10);
    const searchPosts = await searchSubreddit(subreddit, SEARCH_QUERY, 5);
    allPosts.push(...hotPosts, ...searchPosts);

    // Human-like pause between subreddit reads
    await readPause();
  }

  if (allPosts.length === 0) {
    logEvent('warn', 'Cyber LeadFinder: no posts retrieved — check Reddit API credentials', {
      platform: 'Reddit',
      tos: TOS.COMPLIANT,
    });
    return null;
  }

  // Deduplicate by post id
  const seen = new Set();
  const unique = allPosts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Score and sort
  const scored = unique
    .map((p) => ({ ...p, icpScore: scorePost(p) }))
    .filter((p) => p.icpScore >= 15)            // Minimum relevance threshold
    .sort((a, b) => b.icpScore - a.icpScore);

  logEvent('info', `Cyber LeadFinder: ${scored.length} relevant posts found`, {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { total: unique.length, relevant: scored.length },
  });

  if (scored.length === 0) {
    logEvent('info', 'Cyber LeadFinder: no ICP posts met threshold today', {
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
    brand: 'Telarus',
  });

  const lead = {
    type:           'cyber',
    brand:          'Telarus',
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

  logEvent('info', `Cyber LeadFinder: lead selected — r/${lead.subreddit} by u/${lead.redditAuthor}`, {
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
