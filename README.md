# Sales-Team — AI-Assisted Lead Generation for Telarus / Avant Partners

An agentic sales tool that monitors public Reddit discussions to surface mid-market IT decision-makers showing buying signals for cybersecurity and communications solutions (VoIP, UCaaS, NordLayer, Trustwave, etc.), then generates personalized LinkedIn outreach drafts for a human SDR to send manually.

## How It Works

1. **Cyber LeadFinder** and **Phone LeadFinder** agents query the Reddit API (official, commercial-licensed) for recent posts in relevant subreddits.
2. A **Lead Qualifier** scores each post against the target ICP (US mid-market IT deciders with active pain).
3. A **Draft Generator** creates a personalized ≤ 300-character LinkedIn connection note quoting the post.
4. A **Sales Manager Agent** selects exactly 2 leads/day and produces a daily report.
5. The human SDR reviews, finds the LinkedIn profile manually, and sends the note.

## Before You Start — Required Reading

| Document | Purpose |
|----------|---------|
| [docs/compliance.md](docs/compliance.md) | How to obtain Reddit's commercial API agreement (step-by-step), LinkedIn constraints, required environment variables |
| [docs/architecture.md](docs/architecture.md) | System design, data flow, what is/isn't automated |

## Quick Compliance Summary

- **Reddit**: Requires a signed commercial Data API agreement before use. See [docs/compliance.md](docs/compliance.md) for the exact steps. Cost is negligible at this scale (~$0.004/day).
- **LinkedIn**: No automation. The tool drafts the message; a human clicks send. LinkedIn's SNAP API program is closed to new applicants and does not expose connection-request endpoints anyway.

## Environment Variables

Copy `.env.example` to `.env` and fill in your Reddit API credentials **after** your commercial agreement is approved. Never commit `.env` to source control.

## Vendors Supported

Built for resellers of [Telarus](https://www.telarus.com/suppliers/) and [Avant](https://goavant.net/providers/) vendor portfolios, including NordLayer, Trustwave, RingCentral, Lumen, and others.
