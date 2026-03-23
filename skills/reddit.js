/**
 * skills/reddit.js
 *
 * Reddit interaction layer.
 *
 * Strategy (TOS-compliant, in priority order):
 *   1. Reddit JSON API  — unauthenticated public read (no login required)
 *   2. Reddit OAuth API — authenticated read when credentials are present
 *   3. Browser fallback — public page only, human-like, <1 req/sec
 *
 * Commercial data harvest is PROHIBITED.  We only collect:
 *   - Post title, URL, author (all publicly visible)
 *   - Post body snippet for relevance scoring
 *
 * Rate limit: one API call per second maximum.
 */

import { logEvent, TOS } from './logger.js';
import { launchBrowser, navigateTo, humanScroll, readPause, closeBrowser, takeScreenshot } from './browser.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters to store from a post's self-text body. */
const SELFTEXT_SNIPPET_LEN = 500;

// ─── Reddit OAuth token (optional) ───────────────────────────────────────────

let _oauthToken = null;

async function getOAuthToken() {
  const clientId     = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent    = process.env.REDDIT_USER_AGENT;

  if (!clientId || !clientSecret || clientId === 'your_reddit_client_id_here') {
    return null;
  }

  if (_oauthToken) return _oauthToken;

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'User-Agent': userAgent,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    logEvent('warn', `Reddit OAuth failed (${res.status}) — falling back to public API`, {
      platform: 'Reddit',
      tos: TOS.COMPLIANT,
    });
    return null;
  }

  const data = await res.json();
  _oauthToken = data.access_token;
  return _oauthToken;
}

// ─── Rate limiting (1 req/sec max) ───────────────────────────────────────────

let _lastRequestMs = 0;

async function rateLimitedFetch(url, headers = {}) {
  const now  = Date.now();
  const wait = Math.max(0, 1_000 - (now - _lastRequestMs));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  _lastRequestMs = Date.now();

  const userAgent = process.env.REDDIT_USER_AGENT || 'SalesTeamBot/1.0';
  const res = await fetch(url, { headers: { 'User-Agent': userAgent, ...headers } });
  return res;
}

// ─── Post fetching ────────────────────────────────────────────────────────────

/**
 * Fetch recent posts from a subreddit via Reddit's public JSON endpoint.
 *
 * @param {string} subreddit   - e.g. 'cybersecurity'
 * @param {'hot'|'new'} sort
 * @param {number} limit       - Max posts to retrieve (≤25 per call)
 * @returns {Promise<RedditPost[]>}
 */
export async function fetchSubredditPosts(subreddit, sort = 'hot', limit = 10) {
  logEvent('info', `Fetching r/${subreddit} (${sort}, limit=${limit})`, {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
  });

  const token   = await getOAuthToken();
  const baseUrl = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const url     = `${baseUrl}/r/${subreddit}/${sort}.json?limit=${Math.min(limit, 25)}&raw_json=1`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let res;
  try {
    res = await rateLimitedFetch(url, headers);
  } catch (err) {
    logEvent('error', `Reddit API network error: ${err.message}`, { platform: 'Reddit', tos: TOS.COMPLIANT });
    return [];
  }

  if (!res.ok) {
    logEvent('warn', `Reddit API returned ${res.status} for r/${subreddit}`, {
      platform: 'Reddit',
      tos: TOS.COMPLIANT,
    });
    return [];
  }

  const json = await res.json();
  const posts = (json?.data?.children ?? []).map((c) => ({
    id:       c.data.id,
    title:    c.data.title,
    author:   c.data.author,
    url:      `https://www.reddit.com${c.data.permalink}`,
    selftext: (c.data.selftext || '').slice(0, SELFTEXT_SNIPPET_LEN),
    score:    c.data.score,
    subreddit: c.data.subreddit,
    created:  new Date(c.data.created_utc * 1000).toISOString(),
  }));

  logEvent('info', `Retrieved ${posts.length} posts from r/${subreddit}`, {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { subreddit, sort, count: posts.length },
  });
  return posts;
}

/**
 * Search a subreddit for a keyword using Reddit's public search API.
 *
 * @param {string} subreddit
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<RedditPost[]>}
 */
export async function searchSubreddit(subreddit, query, limit = 10) {
  logEvent('info', `Searching r/${subreddit} for "${query}"`, { platform: 'Reddit', tos: TOS.COMPLIANT });

  const token   = await getOAuthToken();
  const baseUrl = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const encoded = encodeURIComponent(query);
  const url     = `${baseUrl}/r/${subreddit}/search.json?q=${encoded}&restrict_sr=1&sort=relevance&limit=${Math.min(limit, 25)}&raw_json=1`;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  let res;
  try {
    res = await rateLimitedFetch(url, headers);
  } catch (err) {
    logEvent('error', `Reddit search network error: ${err.message}`, { platform: 'Reddit', tos: TOS.COMPLIANT });
    return [];
  }

  if (!res.ok) {
    logEvent('warn', `Reddit search returned ${res.status}`, { platform: 'Reddit', tos: TOS.COMPLIANT });
    return [];
  }

  const json = await res.json();
  const posts = (json?.data?.children ?? []).map((c) => ({
    id:       c.data.id,
    title:    c.data.title,
    author:   c.data.author,
    url:      `https://www.reddit.com${c.data.permalink}`,
    selftext: (c.data.selftext || '').slice(0, SELFTEXT_SNIPPET_LEN),
    score:    c.data.score,
    subreddit: c.data.subreddit,
    created:  new Date(c.data.created_utc * 1000).toISOString(),
  }));

  logEvent('info', `Search returned ${posts.length} posts`, {
    platform: 'Reddit',
    tos: TOS.COMPLIANT,
    meta: { subreddit, query, count: posts.length },
  });
  return posts;
}

/**
 * Browser fallback: visit r/<subreddit> in human-like mode and take a
 * screenshot to document the session.  Returns null — callers should rely on
 * the API paths above for data extraction; this is documentation only.
 *
 * ONLY used when the subreddit requires JS rendering and API returns empty.
 */
export async function browserVisitSubreddit(subreddit) {
  logEvent('info', `Browser visit (fallback) r/${subreddit}`, { platform: 'Reddit', tos: TOS.COMPLIANT });
  const { browser, page } = await launchBrowser();
  try {
    await navigateTo(page, `https://www.reddit.com/r/${subreddit}/`);
    await humanScroll(page, 4);
    await readPause();
    const screenshotPath = await takeScreenshot(page, `reddit_${subreddit}`);
    return screenshotPath;
  } catch (err) {
    logEvent('error', `Browser visit failed: ${err.message}`, { platform: 'Reddit', tos: TOS.CAUTION });
    return null;
  } finally {
    await closeBrowser(browser);
  }
}

/**
 * @typedef {Object} RedditPost
 * @property {string} id
 * @property {string} title
 * @property {string} author
 * @property {string} url
 * @property {string} selftext
 * @property {number} score
 * @property {string} subreddit
 * @property {string} created
 */
