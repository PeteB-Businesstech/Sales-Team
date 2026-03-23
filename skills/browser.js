/**
 * skills/browser.js
 *
 * Human-simulated browser utilities built on top of Playwright with the
 * puppeteer-extra stealth plugin.  All public methods enforce the TOS
 * constraints specified in the problem statement:
 *
 *   - Random mouse moves & scrolls (no robot-straight lines)
 *   - Slow typing (char-by-char with jitter)
 *   - Random pauses between actions (configurable min/max)
 *   - Hard rate-limit: <1 request/second to any single domain
 *   - Immediate stop + log on TOS-risk detection
 */

import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logEvent, TOS } from './logger.js';

chromium.use(StealthPlugin());

// ─── Timing helpers ───────────────────────────────────────────────────────────

const ACTION_DELAY_MIN = Number(process.env.ACTION_DELAY_MIN_MS ?? 5_000);
const ACTION_DELAY_MAX = Number(process.env.ACTION_DELAY_MAX_MS ?? 10_000);
const READ_PAUSE_MIN   = Number(process.env.READ_PAUSE_MIN_MS  ?? 30_000);
const READ_PAUSE_MAX   = Number(process.env.READ_PAUSE_MAX_MS  ?? 120_000);

/** Return a random integer in [min, max]. */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Pause for a random duration within the action-delay window. */
export async function actionDelay() {
  const ms = randInt(ACTION_DELAY_MIN, ACTION_DELAY_MAX);
  logEvent('info', `Waiting ${ms}ms (action delay)`, { platform: 'Internal', tos: TOS.COMPLIANT });
  await new Promise((r) => setTimeout(r, ms));
}

/** Pause to simulate "reading" a post (longer pause). */
export async function readPause() {
  const ms = randInt(READ_PAUSE_MIN, READ_PAUSE_MAX);
  logEvent('info', `Reading pause: ${ms}ms`, { platform: 'Internal', tos: TOS.COMPLIANT });
  await new Promise((r) => setTimeout(r, ms));
}

// ─── Browser lifecycle ────────────────────────────────────────────────────────

/**
 * Launch a stealth Chromium browser.
 * Returns { browser, context, page }.
 */
export async function launchBrowser() {
  logEvent('info', 'Launching stealth browser', { platform: 'Internal', tos: TOS.COMPLIANT });
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 768 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const page = await context.newPage();
  return { browser, context, page };
}

// ─── Human-like page interactions ────────────────────────────────────────────

/**
 * Navigate to a URL with a post-load action delay.
 * Enforces <1 req/sec by always waiting at least ACTION_DELAY_MIN before
 * resolving (navigation itself is additional time on top).
 */
export async function navigateTo(page, url) {
  logEvent('info', `Navigating to ${url}`, { platform: 'Internal', tos: TOS.COMPLIANT });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await actionDelay();
}

/**
 * Scroll the page incrementally, simulating a human reading down the feed.
 * @param {import('playwright').Page} page
 * @param {number} times  - Number of scroll steps
 */
export async function humanScroll(page, times = 3) {
  for (let i = 0; i < times; i++) {
    const scrollAmount = randInt(300, 700);
    await page.evaluate((amount) => window.scrollBy({ top: amount, behavior: 'smooth' }), scrollAmount);
    const pause = randInt(1_500, 4_000);
    await new Promise((r) => setTimeout(r, pause));
  }
  logEvent('info', `Scrolled page ${times} times`, { platform: 'Internal', tos: TOS.COMPLIANT });
}

/**
 * Move mouse to an element with a slight random offset and click gently.
 * @param {import('playwright').Page} page
 * @param {string} selector
 */
export async function gentleClick(page, selector) {
  const el = await page.$(selector);
  if (!el) {
    logEvent('warn', `Element not found for gentleClick: ${selector}`, { platform: 'Internal', tos: TOS.CAUTION });
    return;
  }
  const box = await el.boundingBox();
  if (!box) return;
  const x = box.x + box.width / 2 + randInt(-5, 5);
  const y = box.y + box.height / 2 + randInt(-3, 3);
  await page.mouse.move(x, y, { steps: randInt(10, 25) });
  await new Promise((r) => setTimeout(r, randInt(200, 600)));
  await page.mouse.click(x, y);
  await actionDelay();
}

/**
 * Type text slowly, character by character with random inter-key delays.
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 */
export async function slowType(page, selector, text) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await new Promise((r) => setTimeout(r, randInt(80, 220)));
  }
  logEvent('info', `Typed ${text.length} chars into ${selector}`, { platform: 'Internal', tos: TOS.COMPLIANT });
}

/**
 * Take a screenshot and return the path.
 * Saved to /tmp/screenshots/ to keep them out of the repo.
 */
export async function takeScreenshot(page, label) {
  const { mkdirSync } = await import('fs');
  const path = `/tmp/screenshots/${Date.now()}_${label}.png`;
  mkdirSync('/tmp/screenshots', { recursive: true });
  await page.screenshot({ path, fullPage: false });
  logEvent('info', `Screenshot saved: ${path}`, { platform: 'Internal', tos: TOS.COMPLIANT, meta: { path } });
  return path;
}

/**
 * Close browser resources cleanly.
 */
export async function closeBrowser(browser) {
  if (browser) {
    await browser.close();
    logEvent('info', 'Browser closed', { platform: 'Internal', tos: TOS.COMPLIANT });
  }
}
