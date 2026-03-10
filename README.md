# Regional Agent

Turn LinkedIn and YouTube engagement into qualified leads with AI-generated outreach.

---

## What is this?

Regional Agent watches your team's LinkedIn posts and YouTube videos for engagement (likes, comments). When someone interacts with your content, it captures their profile, scores them as a lead, enriches their data (email, title, company), and uses Claude AI to write personalized outreach messages — both LinkedIn DMs and emails.

The end result: a Google Sheet full of scored, enriched leads with ready-to-send messages. Your BDRs just review, tweak if needed, and hit send.

## Features

**Lead Discovery**
- Monitors LinkedIn posts from tracked employees — captures every like and comment
- Scrapes YouTube video comments for additional lead sources
- Auto-discovers company employees via Bright Data
- Bulk CSV import for employee lists

**Lead Intelligence**
- Scores leads 0–100 based on seniority, engagement quality, and ICP fit
- Filters out noise (students, recruiters, competitors) using your ICP rules
- Enriches profiles with email, verified title, and company data
- Three enrichment providers: Apollo.io, ZoomInfo, LeadIQ — pick whichever you have

**AI Outreach**
- Claude generates two message versions per lead: LinkedIn DM + Email
- Personalized based on what they actually engaged with
- Follows your brand voice guidelines
- BDRs can edit drafts inline before sending

**Sales Ops**
- One-click export to Google Sheets
- Track outcomes: Sent → Replied → Connected
- Conversion funnel on the dashboard
- Role-based access (Admin / Viewer)

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** SQLite (local) or Turso (cloud)
- **AI:** Anthropic Claude API
- **Data Collection:** Bright Data Web Scraper API
- **Enrichment:** Apollo.io / ZoomInfo / LeadIQ
- **Export:** Google Sheets API

---

## Getting Started

```bash
git clone https://github.com/iamdvirsharon/outreach-ai.git
cd outreach-ai
npm install
```

Copy the example env file and fill in your keys:

```bash
cp .env.example .env.local
```

Set up the database and start the app:

```bash
npx prisma db push
npm run dev
```

Open http://localhost:3000 and log in with your admin password.

> For local development, set `DATABASE_URL=file:./data/linkedin-outreach.db` in `.env.local` — no cloud database needed.

---

## How to Use (Non-Developer Guide)

Once the app is running, here's how to go from zero to outreach-ready.

### Step 1: Log In

Go to http://localhost:3000. Enter the admin password (whatever you set as `ADMIN_PASSWORD` in `.env.local`).

### Step 2: Configure Settings

Click **Settings** in the sidebar.

**Brand Voice** — Tell the AI how to write. Create a voice profile with your company name, tone guidelines, and do/don't rules. Example: "Be conversational, not salesy. Don't use buzzwords."

**ICP (Ideal Customer Profile)** — Define who's a good lead and who isn't.
- *Target titles:* VP, Director, Head of, CTO, etc. (these get a scoring boost)
- *Exclude titles:* Student, Intern, Recruiter (these get filtered out)
- *Target countries:* Where your sales team operates
- *Min score:* Only generate drafts for leads scoring above this number

### Step 3: Add Companies

Click **Companies** in the sidebar. Hit **Add Company**, paste a LinkedIn company URL, and give it a name.

For each company, add the employees whose posts you want to monitor:
- **Manual:** Click the company → Add Employee → paste their LinkedIn URL
- **Bulk CSV:** Upload a CSV with columns: Name, LinkedIn URL, Role
- **Auto-discover:** Click "Discover Employees" to let Bright Data find them

### Step 4: Run a Scrape

On the Companies page, click **Scrape** next to any company. This kicks off the pipeline:

1. Fetches recent posts from the monitored employees
2. Grabs everyone who liked or commented
3. Pulls their LinkedIn profiles
4. Scores each one against your ICP
5. Generates outreach drafts for qualified leads

You can watch the job progress on the Dashboard.

### Step 5: (Optional) Add YouTube Videos

Click **YouTube** in the sidebar. Paste video URLs — one per line. Hit **Scrape Comments**. The system pulls all commenters and runs them through the same scoring + draft pipeline.

### Step 6: Enrich Leads

Go to **Engagers**. Select the leads you want to enrich (or select all), click **Enrich**, pick a provider (Apollo, ZoomInfo, or LeadIQ), and name the batch. This finds their work emails and verifies titles.

### Step 7: Review Drafts

Click **Outreach Drafts**. Each lead has a LinkedIn DM version and an Email version. You can:
- **Edit** the message if you want to tweak it
- **Copy** to clipboard (auto-marks as "Sent")
- **Track outcomes** — mark as Replied, Connected, or Ignored

### Step 8: Export

Click **Export to Sheets** to push all leads + drafts to your Google Sheet. Share that sheet with your sales team.

---

## Environment Variables

| Variable | Required | What it does |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection. Use `file:./data/linkedin-outreach.db` for local dev |
| `TURSO_AUTH_TOKEN` | Only for Turso | Auth token if using Turso cloud database |
| `ADMIN_PASSWORD` | Yes | Password for full admin access |
| `VIEWER_PASSWORD` | Yes | Password for read-only access |
| `INTERNAL_API_KEY` | Yes | Secret for internal API calls between services |
| `CRON_SECRET` | Yes | Secret for scheduled scrape jobs |
| `BRIGHT_DATA_API_KEY` | Yes | Get from [Bright Data dashboard](https://brightdata.com) |
| `BRIGHT_DATA_POSTS_DATASET` | Yes | Dataset ID for LinkedIn posts |
| `BRIGHT_DATA_COMMENTS_DATASET` | Yes | Dataset ID for LinkedIn comments |
| `BRIGHT_DATA_PROFILES_DATASET` | Yes | Dataset ID for LinkedIn profiles |
| `BRIGHT_DATA_LIKERS_DATASET` | No | Enables capturing post likers (5-10x more leads) |
| `BRIGHT_DATA_COMPANY_DATASET` | No | Enables employee auto-discovery |
| `BRIGHT_DATA_YOUTUBE_COMMENTS_DATASET` | No | Enables YouTube comment scraping |
| `APOLLO_API_KEY` | At least one | [Apollo.io](https://apollo.io) enrichment |
| `ZOOMINFO_CLIENT_ID` | enrichment | [ZoomInfo](https://zoominfo.com) client ID |
| `ZOOMINFO_PRIVATE_KEY` | provider | ZoomInfo private key |
| `LEADIQ_API_KEY` | needed | [LeadIQ](https://leadiq.com) enrichment |
| `ANTHROPIC_API_KEY` | Yes | Get from [Anthropic Console](https://console.anthropic.com) |
| `CLAUDE_MODEL` | No | Defaults to `claude-sonnet-4-6` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | For export | Google Cloud service account email |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | For export | Service account JSON key |
| `GOOGLE_SHEET_ID` | For export | Target spreadsheet ID |

## How it Works

```
LinkedIn Posts & YouTube Videos
        │
        ▼
   Bright Data API ──── scrapes engagements + profiles
        │
        ▼
   Lead Scoring ──────── ICP match, seniority, engagement quality
        │
        ▼
   Enrichment ────────── Apollo / ZoomInfo / LeadIQ (emails, titles)
        │
        ▼
   Claude AI ─────────── Personalized LinkedIn DM + Email drafts
        │
        ▼
   Google Sheets ─────── Export for sales team
```

## License

MIT
