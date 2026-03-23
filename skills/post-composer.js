/**
 * skills/post-composer.js
 *
 * Drafts genuine, value-adding Reddit posts for manual posting by the user.
 *
 * Philosophy:
 *   - Posts are written as helpful community contributions, NOT sales pitches.
 *   - They reference real pain points discovered in the thread review.
 *   - The user copies the draft verbatim (or edits it) and posts it themselves.
 *   - Brand mentions (Telarus / Avox) are used only where naturally relevant
 *     and clearly disclosed.
 *
 * Two post types are generated per review cycle:
 *   1. Cyber post — targeted at r/cybersecurity or r/ITManagers
 *   2. Phone post — targeted at r/VOIP or r/sysadmin
 */

// ─── Template helpers ─────────────────────────────────────────────────────────

/**
 * Choose a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Cyber post ───────────────────────────────────────────────────────────────

const CYBER_OPENERS = [
  "Something I've been seeing a lot in this sub lately",
  "Sharing a pattern we've noticed working with mid-market IT teams",
  "After reading through a bunch of recent threads here",
  "A recurring theme in discussions here caught my attention",
];

const CYBER_CLOSERS = [
  "Curious what approaches others here are taking — happy to share what's worked in our experience too.",
  "Would love to hear how your teams are handling this. Happy to compare notes.",
  "What solutions or vendors have actually moved the needle for you? Not looking to sell anything — genuinely comparing notes.",
  "Drop a comment if you've tackled this — this community always has the best real-world takes.",
];

/**
 * Compose a cyber-focused Reddit post draft based on observed thread themes.
 *
 * @param {object} opts
 * @param {string[]} opts.painPoints   — Pain points extracted from reviewed threads
 * @param {string}   opts.subreddit    — Target subreddit (e.g. 'cybersecurity')
 * @param {string[]} opts.threadTitles — Sample thread titles for context
 * @returns {RedditPostDraft}
 */
export function composeCyberPost({ painPoints, subreddit, threadTitles }) {
  const primaryPain = painPoints[0] ?? 'securing phone and communication systems';
  const secondPain  = painPoints[1] ?? 'endpoint and network visibility';

  const opener  = pick(CYBER_OPENERS);
  const closer  = pick(CYBER_CLOSERS);

  const title = pick([
    `Is anyone else struggling to secure their VoIP/phone stack alongside the rest of their infrastructure?`,
    `How are mid-market IT teams handling the gap between phone security and cyber policy?`,
    `Practical question: how do you enforce zero-trust policies across your UCaaS/VoIP systems?`,
    `Phone systems as an attack vector — underrated risk or overblown?`,
  ]);

  const body = `**${opener}:** a lot of teams are talking about ${primaryPain} and ${secondPain}, but the conversation often stalls at "we need a better solution" without a clear next step.

A few threads I've found helpful recently:
${threadTitles.slice(0, 3).map((t, i) => `${i + 1}. "${t}"`).join('\n')}

What I've noticed is that the hardest part isn't identifying the risk — it's getting phone/UCaaS into the same security conversation as endpoint and network. They often live in different silos (IT vs. ops vs. finance).

**The question I'm putting to this community:**
How are you actually enforcing consistent security policies across your phone systems and the rest of your stack? Are you treating UCaaS/VoIP as a first-class threat surface, or is it still an afterthought?

${closer}

---
*Disclosure: I work in the cybersecurity/UCaaS channel space. Happy to share vendor-neutral insights but not here to pitch anything.*`;

  return {
    type: 'cyber',
    subreddit,
    title,
    body,
    charCount: (title + body).length,
    note: `Copy the title and body above and post it manually to r/${subreddit}. Edit as needed to match your voice.`,
  };
}

// ─── Phone / VoIP post ────────────────────────────────────────────────────────

const PHONE_OPENERS = [
  "A pattern I keep seeing in threads here",
  "Synthesizing what I've read in this community recently",
  "Genuine question after lurking threads here for a while",
  "After reading a lot of migration discussions here",
];

const PHONE_CLOSERS = [
  "What did your migration actually look like? The more specific the better — this community deserves real answers, not vendor marketing.",
  "Happy to compare notes — not selling anything, just interested in what's actually worked.",
  "Drop your experience below. The horror stories are just as useful as the success stories.",
  "What would you do differently? Real-world takes only please.",
];

/**
 * Compose a phone/VoIP-focused Reddit post draft based on observed thread themes.
 *
 * @param {object} opts
 * @param {string[]} opts.painPoints   — Pain points extracted from reviewed threads
 * @param {string}   opts.subreddit    — Target subreddit (e.g. 'VOIP')
 * @param {string[]} opts.threadTitles — Sample thread titles for context
 * @returns {RedditPostDraft}
 */
export function composePhonePost({ painPoints, subreddit, threadTitles }) {
  const primaryPain = painPoints[0] ?? 'phone system migration complexity';
  const secondPain  = painPoints[1] ?? 'cost and vendor lock-in';

  const opener = pick(PHONE_OPENERS);
  const closer = pick(PHONE_CLOSERS);

  const title = pick([
    `Honest question: what actually made your UCaaS/VoIP migration worth it (or not)?`,
    `Post-migration regrets: what do you wish you knew before switching phone systems?`,
    `Real talk — is hosted VoIP actually cheaper long-term, or does the math only work for certain org sizes?`,
    `What's the most underrated feature to prioritize in a phone system RFP?`,
  ]);

  const body = `**${opener}:** teams are consistently hitting the same walls — ${primaryPain} and ${secondPain}. The vendor demos look great, but the real-world experience is all over the map.

Some recent threads that got me thinking:
${threadTitles.slice(0, 3).map((t, i) => `${i + 1}. "${t}"`).join('\n')}

**What I'm trying to understand:**
For teams that have already gone through a phone-system overhaul (on-prem PBX → UCaaS, or swapping providers), what were the factors that actually determined success vs. regret?

Specifically curious about:
- How did you handle number porting headaches?
- Did the promised cost savings materialize, and over what timeframe?
- How did your team handle the learning curve / change management?
- Any security or compliance surprises you didn't anticipate?

${closer}

---
*Disclosure: I work in the UCaaS/phone-systems channel space. Here to learn from real practitioners, not to sell.*`;

  return {
    type: 'phone',
    subreddit,
    title,
    body,
    charCount: (title + body).length,
    note: `Copy the title and body above and post it manually to r/${subreddit}. Edit as needed to match your voice.`,
  };
}

/**
 * @typedef {Object} RedditPostDraft
 * @property {'cyber'|'phone'} type
 * @property {string} subreddit      — Recommended target subreddit
 * @property {string} title          — Post title (copy this)
 * @property {string} body           — Post body in Markdown (copy this)
 * @property {number} charCount      — Total character count (Reddit limit: ~40,000)
 * @property {string} note           — Instructions for the user
 */
