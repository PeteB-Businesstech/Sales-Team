/**
 * skills/linkedin.js
 *
 * LinkedIn human-like outreach using browser automation.
 *
 * TOS Constraints enforced:
 *   - Manual-like clicks with 5–10 s delays between actions
 *   - No scraping of private profile data
 *   - No bulk messaging — max 1 connection request per lead cycle
 *   - Randomized mouse movements and scroll patterns
 *   - Session stopped immediately on any TOS-risk signal
 *
 * IMPORTANT: Actual connection requests require a live LinkedIn session.
 * In the absence of a valid session cookie the module logs the draft
 * message for human review and halts browser automation (approval flow).
 */

import { logEvent, TOS } from './logger.js';
import {
  launchBrowser,
  navigateTo,
  humanScroll,
  gentleClick,
  slowType,
  actionDelay,
  takeScreenshot,
  closeBrowser,
} from './browser.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasValidSession() {
  const cookie = process.env.LINKEDIN_SESSION_COOKIE;
  return cookie && cookie !== 'your_li_at_cookie_here';
}

/**
 * Inject the li_at session cookie so Playwright reuses an existing session
 * without performing a programmatic login (which would violate TOS).
 */
async function injectSessionCookie(context) {
  await context.addCookies([
    {
      name:     'li_at',
      value:    process.env.LINKEDIN_SESSION_COOKIE,
      domain:   '.linkedin.com',
      path:     '/',
      httpOnly: true,
      secure:   true,
      sameSite: 'None',
    },
  ]);
}

// ─── LinkedIn actions ─────────────────────────────────────────────────────────

/**
 * Search for a LinkedIn profile by name and return the first result URL.
 * Returns null if the session is invalid or the search fails.
 *
 * @param {string} name - Reddit username or real name to look up
 * @returns {Promise<string|null>} LinkedIn profile URL
 */
export async function findLinkedInProfile(name) {
  if (!hasValidSession()) {
    logEvent('warn', 'No LinkedIn session cookie — skipping profile search; queuing for human review', {
      platform: 'LinkedIn',
      tos: TOS.COMPLIANT,
      meta: { name },
    });
    return null;
  }

  logEvent('info', `Searching LinkedIn for "${name}"`, { platform: 'LinkedIn', tos: TOS.COMPLIANT });
  const { browser, context, page } = await launchBrowser();

  try {
    await injectSessionCookie(context);
    await navigateTo(page, 'https://www.linkedin.com/feed/');
    await humanScroll(page, 2);

    // Use LinkedIn's people-search URL (Sales Navigator equivalent for free)
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(name)}`;
    await navigateTo(page, searchUrl);
    await humanScroll(page, 2);
    await takeScreenshot(page, `linkedin_search_${name.replace(/\s/g, '_')}`);

    // Extract first result link
    const profileHref = await page.evaluate(() => {
      const link = document.querySelector('.entity-result__title-text a');
      return link ? link.href : null;
    });

    logEvent('info', `Profile found: ${profileHref ?? 'none'}`, {
      platform: 'LinkedIn',
      tos: TOS.COMPLIANT,
      meta: { name, profileHref },
    });

    return profileHref ?? null;
  } catch (err) {
    logEvent('error', `LinkedIn profile search error: ${err.message}`, {
      platform: 'LinkedIn',
      tos: TOS.CAUTION,
    });
    return null;
  } finally {
    await closeBrowser(browser);
  }
}

/**
 * Send a TOS-compliant Connection Request with a personalized note.
 *
 * Guardrails applied:
 *   - Note is capped at 300 characters (LinkedIn hard limit)
 *   - Only 1 request sent per call (no bulk loops here)
 *   - Halts immediately on any CAPTCHA or "suspicious activity" signal
 *
 * @param {string} profileUrl  - LinkedIn profile URL
 * @param {string} note        - Personalised connection note (≤300 chars)
 * @returns {Promise<boolean>} true if request was sent, false otherwise
 */
export async function sendConnectionRequest(profileUrl, note) {
  if (!hasValidSession()) {
    logEvent('warn', 'No LinkedIn session — connection request queued for human review', {
      platform: 'LinkedIn',
      tos: TOS.COMPLIANT,
      meta: { profileUrl, note },
    });
    return false;
  }

  if (note.length > 300) {
    note = note.slice(0, 297) + '...';
  }

  logEvent('info', `Sending connection request to ${profileUrl}`, {
    platform: 'LinkedIn',
    tos: TOS.COMPLIANT,
    meta: { profileUrl, noteLength: note.length },
  });

  const { browser, context, page } = await launchBrowser();

  try {
    await injectSessionCookie(context);
    await navigateTo(page, profileUrl);
    await humanScroll(page, 2);
    await takeScreenshot(page, 'linkedin_profile_pre_connect');

    // Detect TOS/CAPTCHA risk before proceeding
    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (bodyText.includes('verify') || bodyText.includes('captcha') || bodyText.includes('unusual activity')) {
      logEvent('error', 'TOS risk detected on LinkedIn — HALTING automation immediately', {
        platform: 'LinkedIn',
        tos: TOS.VIOLATION,
      });
      return false;
    }

    // Click "Connect" button
    await gentleClick(page, 'button[aria-label="Connect"]');
    await actionDelay();

    // Click "Add a note"
    await gentleClick(page, 'button[aria-label="Add a note"]');
    await actionDelay();

    // Type the personalized note slowly
    await slowType(page, 'textarea[name="message"]', note);
    await actionDelay();

    // Take screenshot before sending (for audit)
    await takeScreenshot(page, 'linkedin_connection_note');

    // Click "Send"
    await gentleClick(page, 'button[aria-label="Send now"]');
    await actionDelay();

    logEvent('info', 'Connection request sent successfully', {
      platform: 'LinkedIn',
      tos: TOS.COMPLIANT,
      meta: { profileUrl },
    });
    return true;
  } catch (err) {
    logEvent('error', `Connection request failed: ${err.message}`, {
      platform: 'LinkedIn',
      tos: TOS.CAUTION,
      meta: { profileUrl },
    });
    return false;
  } finally {
    await closeBrowser(browser);
  }
}

/**
 * Compose a personalized LinkedIn connection note.
 *
 * @param {object} opts
 * @param {string} opts.redditPostTitle  - Title of the Reddit thread
 * @param {string} opts.subreddit        - Source subreddit
 * @param {string} opts.pain             - Key pain point extracted from the post
 * @param {string} opts.brand            - 'Telarus' | 'Avox'
 * @returns {string} Note text (≤300 chars)
 */
export function composeConnectionNote({ redditPostTitle, subreddit, pain, brand }) {
  const note =
    `Hi! Your r/${subreddit} thread "${redditPostTitle.slice(0, 60)}" resonated with me—` +
    `${pain ? ` especially around ${pain}.` : '.'} ` +
    `${brand} helps teams solve exactly this. Happy to share insights—no pitch, promise.`;

  // Enforce LinkedIn's 300-char hard limit
  return note.length <= 300 ? note : note.slice(0, 297) + '...';
}
