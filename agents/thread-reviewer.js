/**
 * agents/thread-reviewer.js
 *
 * Thread Reviewer Agent
 *
 * Reviews multiple Reddit threads across all target subreddits and returns:
 *   1. A curated list of relevant thread links with summaries
 *   2. Ready-to-post Reddit post drafts (one cyber, one phone)
 *
 * Unlike the LeadFinder agents (which pick ONE best post for LinkedIn outreach),
 * this agent surfaces the top N most relevant threads per category so the user
 * can read them and decide which to engage with — plus it drafts a post they
 * can manually submit to join the conversation.
 *
 * Usage: called via `node index.js --review`
 */

import { fetchSubredditPosts, searchSubreddit } from '../skills/reddit.js';
import { composeCyberPost, composePhonePost } from '../skills/post-composer.js';
import { logEvent, TOS } from '../skills/logger.js';

/** Maximum characters to display for a thread snippet in terminal output. */
const SNIPPET_DISPLAY_LEN = 120;

// ─── Config ───────────────────────────────────────────────────────────────────

const THREADS_PER_CATEGORY = Number(process.env.REVIEW_THREAD_LIMIT ?? 5);

const CYBER_SUBREDDITS  = ['cybersecurity', 'ITManagers', 'netsec', 'sysadmin'];
const CYBER_KEYWORDS    = [
  'phone', 'voip', 'ucaas', 'sip', 'pbx', 'cybersecurity', 'threat', 'zero trust',
  'firewall', 'endpoint', 'ransomware', 'compliance', 'soc', 'mdr', 'sase',
  'network security', 'data breach', 'phishing', 'mfa', 'identity', 'cloud security',
];

const PHONE_SUBREDDITS  = ['VOIP', 'sysadmin', 'ITManagers', 'MSP'];
const PHONE_KEYWORDS    = [
  'voip', 'pbx', 'sip', 'ucaas', 'ccaas', 'phone system', 'phone migration',
  'teams phone', 'ringcentral', '8x8', 'zoom phone', 'hosted pbx',
  'desk phone', 'softphone', 'call center', 'unified communications',
  'pots', 'analog', 'pstn', 'trunk',
];

const BUYING_SIGNALS = [
  'looking for', 'recommend', 'best solution', 'vendor', 'budget',
  'evaluation', 'migrating', 'switching', 'help', 'advice',
  'what do you use', 'we need', 'replacing', 'upgrade', 'transition',
];

const CYBER_SEARCH_QUERY = 'phone system security threats voip';
const PHONE_SEARCH_QUERY = 'phone migration cloud ucaas voip replacement';

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreThread(post, keywords) {
  const text = `${post.title} ${post.selftext}`.toLowerCase();
  let score = 0;
  for (const kw of keywords)      { if (text.includes(kw)) score += 4; }
  for (const sig of BUYING_SIGNALS) { if (text.includes(sig)) score += 8; }
  if (post.score > 5)  score += 4;
  if (post.score > 25) score += 8;
  if (post.score > 100) score += 12;
  const ageHours = (Date.now() - new Date(post.created).getTime()) / 3_600_000;
  if (ageHours < 24)  score += 12;
  else if (ageHours < 72) score += 6;
  else if (ageHours < 168) score += 2;
  return Math.min(score, 100);
}

function extractPainPoints(posts) {
  const pains = new Set();
  for (const post of posts) {
    const text = `${post.title} ${post.selftext}`.toLowerCase();
    if (text.includes('ransomware') || text.includes('breach'))  pains.add('ransomware and breach risk');
    if (text.includes('compliance') || text.includes('audit'))   pains.add('compliance and audit pressure');
    if (text.includes('voip') || text.includes('phone'))         pains.add('securing VoIP/phone communications');
    if (text.includes('zero trust') || text.includes('sase'))    pains.add('zero-trust architecture adoption');
    if (text.includes('phishing') || text.includes('mfa'))       pains.add('phishing and identity protection');
    if (text.includes('migration') || text.includes('replacing')) pains.add('phone system migration complexity');
    if (text.includes('cost') || text.includes('expensive'))     pains.add('cost and vendor lock-in');
    if (text.includes('remote') || text.includes('hybrid'))      pains.add('supporting remote/hybrid workers');
    if (text.includes('reliability') || text.includes('outage')) pains.add('call reliability and uptime');
    if (text.includes('integration') || text.includes('teams'))  pains.add('UCaaS platform integration');
  }
  return [...pains];
}

// ─── Data collection ──────────────────────────────────────────────────────────

async function collectPosts(subreddits, searchQuery, keywords) {
  const all = [];
  for (const subreddit of subreddits) {
    const hot    = await fetchSubredditPosts(subreddit, 'hot', 15);
    const search = await searchSubreddit(subreddit, searchQuery, 10);
    all.push(...hot, ...search);
  }

  // Deduplicate
  const seen   = new Set();
  const unique = all.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Score and sort — no minimum threshold here so we always return something
  return unique
    .map((p) => ({ ...p, relevanceScore: scoreThread(p, keywords) }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ─── Thread summary formatter ─────────────────────────────────────────────────

function formatThreadSummary(post, rank) {
  const ageHours = Math.round((Date.now() - new Date(post.created).getTime()) / 3_600_000);
  const age = ageHours < 24
    ? `${ageHours}h ago`
    : `${Math.round(ageHours / 24)}d ago`;

  const snippet = post.selftext
    ? `  → "${post.selftext.slice(0, SNIPPET_DISPLAY_LEN).replace(/\n/g, ' ')}..."`
    : '';

  return {
    rank,
    title:          post.title,
    url:            post.url,
    subreddit:      `r/${post.subreddit}`,
    author:         `u/${post.author}`,
    upvotes:        post.score,
    age,
    relevanceScore: post.relevanceScore,
    snippet:        snippet || null,
  };
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Run the Thread Reviewer and return:
 *  - cyberThreads: top N cyber-relevant thread summaries with links
 *  - phoneThreads: top N phone-relevant thread summaries with links
 *  - cyberPost:    Reddit post draft for cyber subreddits (manual posting)
 *  - phonePost:    Reddit post draft for phone subreddits (manual posting)
 *
 * @returns {Promise<ThreadReviewResult>}
 */
export async function runThreadReviewer() {
  logEvent('info', '=== Thread Reviewer started ===', { platform: 'Internal', tos: TOS.COMPLIANT });

  // ── Cyber threads ──────────────────────────────────────────────────────────
  logEvent('info', 'Thread Reviewer: collecting cyber threads', {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { subreddits: CYBER_SUBREDDITS },
  });

  const cyberRaw    = await collectPosts(CYBER_SUBREDDITS, CYBER_SEARCH_QUERY, CYBER_KEYWORDS);
  const cyberTop    = cyberRaw.slice(0, THREADS_PER_CATEGORY);
  const cyberPains  = extractPainPoints(cyberTop);
  const cyberThreads = cyberTop.map((p, i) => formatThreadSummary(p, i + 1));

  logEvent('info', `Thread Reviewer: ${cyberThreads.length} cyber threads selected`, {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { count: cyberThreads.length, pains: cyberPains },
  });

  // ── Phone threads ──────────────────────────────────────────────────────────
  logEvent('info', 'Thread Reviewer: collecting phone threads', {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { subreddits: PHONE_SUBREDDITS },
  });

  const phoneRaw    = await collectPosts(PHONE_SUBREDDITS, PHONE_SEARCH_QUERY, PHONE_KEYWORDS);
  const phoneTop    = phoneRaw.slice(0, THREADS_PER_CATEGORY);
  const phonePains  = extractPainPoints(phoneTop);
  const phoneThreads = phoneTop.map((p, i) => formatThreadSummary(p, i + 1));

  logEvent('info', `Thread Reviewer: ${phoneThreads.length} phone threads selected`, {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { count: phoneThreads.length, pains: phonePains },
  });

  // ── Compose post drafts ────────────────────────────────────────────────────
  const cyberPost = composeCyberPost({
    painPoints:   cyberPains,
    subreddit:    'cybersecurity',
    threadTitles: cyberTop.map((p) => p.title),
  });

  const phonePost = composePhonePost({
    painPoints:   phonePains,
    subreddit:    'VOIP',
    threadTitles: phoneTop.map((p) => p.title),
  });

  logEvent('info', '=== Thread Reviewer complete ===', {
    platform: 'Internal',
    tos: TOS.COMPLIANT,
    meta: {
      cyberThreadCount: cyberThreads.length,
      phoneThreadCount: phoneThreads.length,
      postsComposed: 2,
    },
  });

  return { cyberThreads, phoneThreads, cyberPost, phonePost };
}

/**
 * @typedef {Object} ThreadSummary
 * @property {number} rank
 * @property {string} title
 * @property {string} url
 * @property {string} subreddit
 * @property {string} author
 * @property {number} upvotes
 * @property {string} age
 * @property {number} relevanceScore
 * @property {string|null} snippet
 */

/**
 * @typedef {Object} ThreadReviewResult
 * @property {ThreadSummary[]} cyberThreads
 * @property {ThreadSummary[]} phoneThreads
 * @property {import('../skills/post-composer.js').RedditPostDraft} cyberPost
 * @property {import('../skills/post-composer.js').RedditPostDraft} phonePost
 */
