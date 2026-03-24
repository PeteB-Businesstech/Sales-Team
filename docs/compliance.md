# Platform Compliance & Commercial Agreement Guide

This document explains exactly what is needed to operate the Sales Team agent system in a legally compliant way on each platform it touches.

---

## Reddit — Getting the Commercial API Agreement

### Why You Need It
Since July 2023 Reddit classifies **any use of Reddit data by or on behalf of a business** as commercial use, regardless of volume. Identifying sales prospects from Reddit posts to support a revenue-generating business falls squarely in that bucket. Using the API without a commercial agreement at that point violates Reddit's [Data API Terms](https://redditinc.com/policies/data-api-terms) and could result in your API credentials being revoked.

The good news: for a low-volume use case (≈ 2 leads/day ≈ 50–100 API calls/day), the cost is negligible—roughly **$0.24 per 1,000 calls**, so well under $1/month at this scale.

---

### Step-by-Step: Getting Reddit's Commercial Agreement

#### Step 1 — Create a Reddit Developer App (5 minutes)
1. Log in to Reddit with the account that will own the API credentials (ideally a company/bot account, not your personal account).
2. Go to **https://www.reddit.com/prefs/apps** and click **"create another app"**.
3. Choose type **"script"** (for a server-side tool you control).
4. Fill in:
   - **Name**: e.g. `SalesTeam-LeadFinder`
   - **Description**: "Internal tool to browse public subreddits to identify potential B2B clients for cybersecurity/communications solutions."
   - **Redirect URI**: `http://localhost:8080` (required field; not used for script apps).
5. Click **Create app**. Note the **Client ID** (under the app name) and **Client Secret**.

#### Step 2 — Submit a Commercial API Access Request (15–30 minutes)
1. Go to **https://support.reddithelp.com/hc/en-us/requests/new**
2. In the request type dropdown, select **"API Access Request"**.
3. Fill out the form honestly and specifically. Reddit reviews these manually. Include:
   - **Company name**: Your business name / DBA
   - **Use case**: "We are a technology reseller (Telarus/Avant partner) using the Reddit API to monitor public posts in r/cybersecurity, r/sysadmin, and r/VOIP for signals of businesses evaluating phone/VoIP or cybersecurity solutions. We identify post authors as potential sales leads and manually reach out via LinkedIn. No Reddit data is stored beyond 30 days, resold, or used for AI training. Expected volume: ~100 API calls/day."
   - **Projected API volume**: ~3,000 calls/month
   - **Data retention**: State your retention period (e.g., 30 days max)

4. Submit and expect a response within **5–15 business days**.

#### Step 3 — Review and Sign the Data API Terms
Reddit will send you a commercial agreement to review. Key terms to understand:
- You may **not** resell or redistribute the data.
- You may **not** use the data to train AI/ML models (without a separate license).
- You must honor user deletion requests (if a user deletes their post, you must delete your copy).
- Rate limits apply; you must respect `Retry-After` headers.

Sign the agreement (as an authorized representative of your business) and return it.

#### Step 4 — Technical Setup
Once approved, set up OAuth2 authentication using the credentials from Step 1:

```
User-Agent: SalesTeam-LeadFinder/1.0 by <your-reddit-username>
Authorization: Bearer <access_token>
```

All API calls must include a descriptive `User-Agent` per Reddit's rules. The base URL is:
```
https://oauth.reddit.com/r/{subreddit}/search?q={query}&sort=new&limit=10
```

---

### What the Agreement Enables
With a signed commercial agreement you can legally:
- Search and read posts in public subreddits via the official API
- Extract post text, author username, post date, and upvote count
- Store this data (within your retention policy) to identify and qualify leads
- Build an automated pipeline that surfaces posts matching keywords like "phone system", "VoIP migration", "cyber threat", "MFA", etc.

You **cannot** (even with the agreement):
- Log in to Reddit as a user via automation
- Send Reddit DMs programmatically to users
- Harvest email addresses or contact info from Reddit profiles
- Exceed your agreed-upon rate limits

---

## LinkedIn — The Honest Picture

**There is currently no publicly available API for sending LinkedIn connection requests.** LinkedIn's SNAP (Sales Navigator Application Platform) is the only official integration path, and as of 2025–2026 it is **closed to new applicants**. It is reserved for large, pre-approved CRM vendors (Salesforce, HubSpot, Microsoft Dynamics, etc.).

### What This Means for This Tool

| Action | Automation Status |
|--------|------------------|
| Finding a Reddit lead's LinkedIn profile (manual search) | ✅ Legal—done by a human |
| Drafting a personalized connection note (AI-assisted) | ✅ Legal—AI drafts, human reviews |
| Clicking "Connect" and pasting the note on LinkedIn | ✅ Legal—human performs the action |
| Having a script automatically log into LinkedIn and click "Connect" | ❌ Violates LinkedIn ToS Section 8.2 |

### Practical Compliant Workflow for LinkedIn
The Sales Team tool generates a **ready-to-paste outreach note** for each lead. The SDR (human) then:
1. Opens the LinkedIn profile link provided by the tool.
2. Clicks **Connect → Add a note**.
3. Pastes the drafted message (editing as they see fit).
4. Sends.

This keeps the human in the loop for the final action and is fully compliant. The time per lead is 2–3 minutes, well within a human pace.

---

## Summary Checklist

- [ ] **Reddit**: Create developer app at `reddit.com/prefs/apps`
- [ ] **Reddit**: Submit commercial API access request at `support.reddithelp.com/hc/en-us/requests/new`
- [ ] **Reddit**: Review, sign, and return the Data API Terms agreement
- [ ] **Reddit**: Store `CLIENT_ID`, `CLIENT_SECRET`, and `USER_AGENT` securely (never in source code—use environment variables)
- [ ] **LinkedIn**: Subscribe to **Sales Navigator** (Core or Advanced) for manual search features
- [ ] **LinkedIn**: Use tool-generated draft notes; perform all LinkedIn actions manually

---

## Environment Variables Required (After Agreements Are Signed)

```
REDDIT_CLIENT_ID=your_client_id_here
REDDIT_CLIENT_SECRET=your_client_secret_here
REDDIT_USER_AGENT=SalesTeam-LeadFinder/1.0 by your_reddit_username
REDDIT_USERNAME=your_reddit_bot_account_username
REDDIT_PASSWORD=your_reddit_bot_account_password
```

These must be stored in a `.env` file (excluded from Git via `.gitignore`) or in your secrets manager. **Never commit credentials to source control.**
