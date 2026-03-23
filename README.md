# Sales Team — Paperclip-Orchestrated Lead Generation

Automated, TOS-compliant sales-lead generation for **Telarus** (NordLayer, Trustwave) and **Avox** cybersecurity and phone-systems solutions.

## Architecture

```
index.js  (heartbeat runner)
  └── agents/sales-manager.js   ← Orchestrator / Sales Manager Agent
        ├── agents/cyber-lead-finder.js   ← Sub-agent: r/cybersecurity, r/ITManagers
        └── agents/phone-lead-finder.js   ← Sub-agent: r/VOIP, r/sysadmin
              │
              ├── skills/reddit.js    (Reddit API + TOS-safe browser fallback)
              ├── skills/linkedin.js  (Human-like outreach, TOS-compliant)
              ├── skills/browser.js   (Stealth Playwright, human simulation)
              └── skills/logger.js    (Structured logging + TOS compliance score)
```

## Daily Workflow (Human-Like)

1. **Heartbeat** — `node index.js` runs once per day (scheduled by Paperclip)
2. **Cyber LeadFinder** searches r/cybersecurity & r/ITManagers via Reddit API; reads posts with human delays (30–120 s); scores each for ICP relevance
3. **Phone LeadFinder** searches r/VOIP & r/sysadmin similarly; focuses on migration/UCaaS pain points
4. **Sales Manager** reviews both leads for TOS compliance, then triggers personalised LinkedIn outreach (or queues for human approval if no session cookie is present)
5. **Quota** — exactly **2 leads per day** (1 cyber, 1 phone)

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env — add Reddit API keys and LinkedIn session cookie

# 3. Run heartbeat
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
