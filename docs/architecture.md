# System Architecture — Compliant Lead Generation Tool

This document describes the design of the Sales Team agent system in a way that is compliant with Reddit's Data API Terms and LinkedIn's User Agreement.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Sales Manager Agent                         │
│  (Orchestrator — schedules, reviews, logs, triggers heartbeat)  │
└────────────────────────┬────────────────────────────────────────┘
                         │
           ┌─────────────┴──────────────┐
           │                            │
           ▼                            ▼
┌──────────────────┐          ┌──────────────────────┐
│  Cyber LeadFinder│          │  Phone LeadFinder     │
│  (Reddit API)    │          │  (Reddit API)         │
│  r/cybersecurity │          │  r/sysadmin, r/VOIP   │
│  r/ITManagers    │          │  r/networking         │
└────────┬─────────┘          └──────────┬────────────┘
         │                               │
         └──────────────┬────────────────┘
                        │
                        ▼
          ┌─────────────────────────┐
          │   Lead Qualifier        │
          │  (ICP scoring, dedup)   │
          └─────────────────────────┘
                        │
                        ▼
          ┌─────────────────────────┐
          │   Draft Generator       │
          │  (personalized notes    │
          │   quoting the post)     │
          └─────────────────────────┘
                        │
                        ▼
          ┌─────────────────────────────────────┐
          │   Daily Lead Report                  │
          │   - Reddit post link                 │
          │   - Author username                  │
          │   - Pain signal summary              │
          │   - LinkedIn search URL (manual)     │
          │   - Ready-to-paste outreach note     │
          │   - TOS compliance checklist         │
          └─────────────────────────────────────┘
                        │
                        ▼
          ┌─────────────────────────┐
          │  SDR (Human)            │
          │  Reviews report,        │
          │  performs LinkedIn      │
          │  actions manually       │
          └─────────────────────────┘
```

---

## Component Responsibilities

### Sales Manager Agent
- Triggers the heartbeat cycle once per day
- Delegates to Cyber LeadFinder and Phone LeadFinder
- Reviews returned leads for ICP fit before approving the report
- Enforces quota (exactly 2 leads/day)
- Logs all actions with timestamps and compliance notes

### Cyber LeadFinder
- Calls Reddit API (OAuth2 script flow) to search recent posts
- Target subreddits: `r/cybersecurity`, `r/ITManagers`, `r/netsec`
- Keywords: `"phone system"`, `"VoIP threats"`, `"cyber attack"`, `"MFA"`, `"zero trust"`, `"NordLayer"`, `"firewall"`
- Returns: post title, body excerpt, author, URL, date, upvote count
- Strictly uses the official Reddit API — no browser automation

### Phone LeadFinder
- Calls Reddit API (same credentials, same rate limits)
- Target subreddits: `r/sysadmin`, `r/VOIP`, `r/networking`, `r/msp`
- Keywords: `"phone migration"`, `"VoIP upgrade"`, `"UCaaS"`, `"Teams Phone"`, `"RingCentral"`, `"moving off PBX"`
- Returns: same structure as above

### Lead Qualifier
- Scores each post against the ICP:
  - ✅ US-based (profile/post signals)
  - ✅ Decision-maker role signals (IT manager, CTO, sysadmin)
  - ✅ Mid-market signals (50–2000 employees)
  - ✅ Active pain (not just curiosity — explicit frustration or RFP signal)
- Deduplicates against previous 30 days of leads
- Selects top 2 leads for the day

### Draft Generator
- Uses the post text to construct a personalized connection note
- Template pattern: `"Your [subreddit] post about [topic] resonated — [vendor] addresses exactly that by [brief value prop]. Would love to connect."`
- Note is ≤ 300 characters (LinkedIn connection note limit)
- Flags for human review before use

---

## Data Flow & Retention

```
Reddit API response → in-memory only during processing
                    → qualifying data written to leads log (30-day TTL)
                    → no raw post content stored beyond processing
```

Post author usernames are stored only as long as needed to avoid duplicating outreach. They are never shared, sold, or used for any purpose other than this tool's lead generation function.

---

## Rate Limiting Strategy

Reddit's API terms require staying under the agreed-upon call rate. For this tool:

| Action | Calls | Frequency |
|--------|-------|-----------|
| Auth token refresh | 1 | Once/hour (token cached) |
| Subreddit search (Cyber) | 2–3 | Once/day |
| Subreddit search (Phone) | 2–3 | Once/day |
| Post detail fetch | ≤ 10 | Once/day |
| **Total** | **≤ 17** | **Per day** |

This is far below any commercial rate limit tier and costs approximately **$0.004/day** at Reddit's published rates.

A minimum **1-second delay** is enforced between every API call, with exponential backoff on `429 Too Many Requests` responses.

---

## What Is NOT Automated

The following actions are performed **manually by the SDR** (not automated):

1. Searching LinkedIn for the Reddit author's profile
2. Reviewing the AI-drafted connection note
3. Clicking "Connect" on LinkedIn
4. Pasting and (optionally editing) the connection note
5. Any follow-up messaging on LinkedIn

This keeps all LinkedIn interactions fully within LinkedIn's ToS and gives the human SDR full control over what is sent.

---

## File Structure (Planned)

```
Sales-Team/
├── README.md
├── .env.example           # Template for credentials (no real values)
├── .gitignore
├── docs/
│   ├── compliance.md      # Commercial agreement steps (this repo)
│   └── architecture.md    # This file
├── agents/
│   ├── sales_manager.py   # Orchestrator / heartbeat
│   ├── cyber_leadfinder.py
│   └── phone_leadfinder.py
├── lib/
│   ├── reddit_client.py   # Reddit OAuth2 API wrapper
│   ├── lead_qualifier.py  # ICP scoring
│   └── draft_generator.py # Personalized note creation
├── logs/
│   └── .gitkeep
└── tests/
    └── .gitkeep
```
