# Sales Team — Paperclip-Orchestrated Lead Generation

Automated, TOS-compliant sales-lead generation for **Telarus** (NordLayer, Trustwave) and **Avox** cybersecurity and phone-systems solutions.

## Architecture

```
index.js  (entry point — heartbeat OR review)
  ├── --heartbeat  →  agents/sales-manager.js   ← Orchestrator / Sales Manager Agent
  │                     ├── agents/cyber-lead-finder.js   ← Sub-agent: r/cybersecurity, r/ITManagers
  │                     └── agents/phone-lead-finder.js   ← Sub-agent: r/VOIP, r/sysadmin
  │
  └── --review     →  agents/thread-reviewer.js  ← Reviews threads & drafts posts
                         └── skills/post-composer.js  ← Reddit post drafts for manual posting
                         │
                         (shared skills)
                         ├── skills/reddit.js    (Reddit API + TOS-safe browser fallback)
                         ├── skills/linkedin.js  (Human-like outreach, TOS-compliant)
                         ├── skills/browser.js   (Stealth Playwright, human simulation)
                         └── skills/logger.js    (Structured logging + TOS compliance score)
```

## Commands

| Command | Description |
|---|---|
| `npm start` / `node index.js` | Run daily lead-generation heartbeat (2 leads) |
| `npm run heartbeat` | Same as above (explicit flag) |
| `npm run review` | **Review Reddit threads + produce post drafts for manual posting** |

## Thread Review (`npm run review`)

The `--review` command scans the target subreddits, surfaces the most relevant recent threads, and writes two ready-to-post Reddit drafts that **you copy and post yourself**.

### What it produces

1. **Top 5 cyber threads** — links from r/cybersecurity, r/ITManagers, r/netsec, r/sysadmin
2. **Top 5 phone/VoIP threads** — links from r/VOIP, r/sysadmin, r/ITManagers, r/MSP
3. **Draft cyber post** — a genuine community question/discussion starter for r/cybersecurity
4. **Draft phone post** — same for r/VOIP

### Sample output

```
════════════════════════════════════════════════════════════
  CYBERSECURITY THREADS  (Mon Mar 23 2026)
════════════════════════════════════════════════════════════

  #1 [r/cybersecurity]  ↑1243  3h ago  (relevance: 84)
  Title : Is VoIP being overlooked in zero-trust rollouts?
  Link  : https://www.reddit.com/r/cybersecurity/comments/abc123/...
  By    : u/some_it_manager

  #2 [r/ITManagers]  ↑87  18h ago  (relevance: 68)
  Title : Compliance audit flagged our phone system — anyone else?
  Link  : https://www.reddit.com/r/ITManagers/comments/xyz789/...
  By    : u/another_user
  Snip  : → "We just got hit by an audit and our SIP trunks weren't even in scope..."

...

════════════════════════════════════════════════════════════
  DRAFT POST — CYBERSECURITY  →  r/cybersecurity
════════════════════════════════════════════════════════════

  ┌─ TITLE (copy this) ──────────────────────────────────────────
  │ Is anyone else struggling to secure their VoIP/phone stack alongside the rest of their infrastructure?
  └──────────────────────────────────────────────────────────────

  ┌─ BODY (copy this — Markdown) ───────────────────────────────
  │ **After reading through a bunch of recent threads here:** ...
  └──────────────────────────────────────────────────────────────
```

The drafts include a disclosure line ("I work in the cybersecurity/UCaaS channel space") to stay TOS-compliant and community-appropriate.

## Daily Workflow (Human-Like)

1. **Heartbeat** — `node index.js` runs once per day (scheduled by Paperclip)
2. **Cyber LeadFinder** searches r/cybersecurity & r/ITManagers via Reddit API; reads posts with human delays (30–120 s); scores each for ICP relevance
3. **Phone LeadFinder** searches r/VOIP & r/sysadmin similarly; focuses on migration/UCaaS pain points
4. **Sales Manager** reviews both leads for TOS compliance, then triggers personalized LinkedIn outreach (or queues for human approval if no session cookie is present)
5. **Quota** — exactly **2 leads per day** (1 cyber, 1 phone)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env — add Reddit API keys and LinkedIn session cookie

# 3. Run thread review (no credentials needed — uses public Reddit API)
npm run review

# 4. Run lead-generation heartbeat
npm start
```

## Environment Variables

See `.env.example` for all required variables.

| Variable | Description |
|---|---|
| `REDDIT_CLIENT_ID` | Reddit script-app client ID |
| `REDDIT_CLIENT_SECRET` | Reddit app secret |
| `REDDIT_USER_AGENT` | Bot user-agent string |
| `LINKEDIN_SESSION_COOKIE` | `li_at` cookie from an active LinkedIn session |
| `DAILY_LEAD_QUOTA` | Leads per heartbeat (default: `2`) |
| `REVIEW_THREAD_LIMIT` | Threads per category in `--review` mode (default: `5`) |
| `ACTION_DELAY_MIN_MS` | Min ms between browser actions (default: `5000`) |
| `ACTION_DELAY_MAX_MS` | Max ms between browser actions (default: `10000`) |
| `READ_PAUSE_MIN_MS` | Min ms "reading" a post (default: `30000`) |
| `READ_PAUSE_MAX_MS` | Max ms "reading" a post (default: `120000`) |

## TOS Compliance

All automation strictly adheres to platform Terms of Service:

- **Reddit** — Uses official JSON/OAuth API; browser fallback for public pages only; <1 req/sec; no commercial data harvest; no login bypass
- **LinkedIn** — Session cookie injection only (no programmatic login); manual-like clicks with 5–10 s delays; max 1 connection request per lead; immediate halt on CAPTCHA/unusual-activity detection
- **Human Simulation** — Random mouse moves, incremental scrolls, slow char-by-char typing, 30–120 s read pauses between posts
- **Hard Limits** — <5 browser actions/day/platform; TOS.VIOLATION triggers immediate stop + log + human alert

## Output

Each lead record contains:

```json
{
  "type": "cyber | phone",
  "brand": "Telarus | Avox",
  "redditPostUrl": "https://reddit.com/r/...",
  "redditAuthor": "username",
  "subreddit": "cybersecurity",
  "postTitle": "...",
  "postSnippet": "...",
  "icpScore": 75,
  "pain": "ransomware and breach risks",
  "connectionNote": "Personalised LinkedIn note (≤300 chars)",
  "linkedInProfile": "https://linkedin.com/in/...",
  "connectionRequestSent": true,
  "discoveredAt": "2026-03-23T23:00:00.000Z",
  "tosCompliant": true
}
```

Lead data is written to `/tmp/sales-team-leads/` (gitignored) for Paperclip DB ingestion.

## ICP — Ideal Customer Profile

Mid-market US IT decision-makers (IT Managers, IT Directors, CTOs) actively discussing:
- Phone/VoIP system migrations or pain points
- Cybersecurity threats, compliance, zero-trust architecture
- Vendor evaluations or RFPs

Target communities: r/cybersecurity · r/ITManagers · r/VOIP · r/sysadmin · r/netsec · r/MSP
