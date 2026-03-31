# SolNuv — Complete Deployment Guide
## Solar Waste Tracking, Recovery & Compliance Platform

> **Who this guide is for:** Anyone — developer or not — who wants to deploy SolNuv live at solnuv.com.  
> **Time needed:** ~60–90 minutes for first-time deployment.  
> **Cost:** ₦0 (all free tiers used)

---

## 📋 BEFORE YOU START — Accounts You Need

Create **free** accounts on each of these platforms (takes ~15 minutes total):

| # | Platform | Link | Purpose |
|---|----------|------|---------|
| 1 | **GitHub** | github.com | Stores your code |
| 2 | **Supabase** | supabase.com | Your database |
| 3 | **Vercel** | vercel.com | Hosts the website (frontend) |
| 4 | **Render** | render.com | Hosts the server (backend) |
| 5 | **Termii** | termii.com | Sends SMS/WhatsApp notifications |
| 6 | **Paystack** | paystack.com | Accepts payments in ₦ |

> ✅ **Tip:** Use the same Google account to sign up on all platforms — it's faster.

---

## PHASE 1 — Set Up GitHub (Code Repository)

**Think of GitHub like a USB drive for your code — it stores everything and connects to all other services.**

### Step 1.1 — Install Git on your computer
- Go to **git-scm.com/downloads**
- Download and install Git for your operating system (Windows/Mac/Linux)
- When installation is done, open your **Terminal** (Mac/Linux) or **Command Prompt** (Windows)
- Type: `git --version` — you should see a version number like `git version 2.39.0`

### Step 1.2 — Install Node.js
- Go to **nodejs.org**
- Download the **LTS version** (the one that says "Recommended for most users")
- Install it
- Confirm by typing in terminal: `node --version` (should show v18 or higher)

### Step 1.3 — Create a new GitHub repository
1. Go to **github.com** and log in
2. Click the **"+"** button (top right) → **"New repository"**
3. Name it: `solnuv`
4. Select: **Private**
5. Do NOT tick "Add README"
6. Click **"Create repository"**

### Step 1.4 — Upload the code to GitHub
Open your terminal. Navigate to the folder where you unzipped this project:

```bash
# Navigate to the solnuv folder (adjust path as needed)
cd /path/to/solnuv

# Initialize git
git init

# Add all files
git add .

# Make your first commit
git commit -m "Initial SolNuv platform commit"

# Connect to your GitHub repository
# (Replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/solnuv.git

# Push the code
git push -u origin main
```

> ✅ **Success check:** Refresh your GitHub repository page — you should see all the project folders (backend, frontend, database, etc.)

---

## PHASE 2 — Set Up Supabase (Database)

**Think of Supabase like the filing cabinet that stores all your data — users, projects, silver calculations.**

### Step 2.1 — Create a project
1. Go to **supabase.com** and log in
2. Click **"New Project"**
3. Fill in:
   - **Name:** SolNuv
   - **Database Password:** Create a strong password — **SAVE THIS SOMEWHERE SAFE**
   - **Region:** Choose "West EU (Ireland)" — closest fast server to Nigeria on free plan
4. Click **"Create new project"** — wait 2 minutes for it to set up

### Step 2.2 — Run the database schema
1. In your Supabase dashboard, click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open the file: `database/migrations/001_initial_schema.sql` from your project folder
4. Copy ALL the contents and paste into the SQL Editor
5. Click **"Run"** (green button)
6. You should see: **"Success. No rows returned"**

### Step 2.3 — Run the platform upgrade migrations
Run these in order (one file per new SQL query):

1. `database/migrations/002_billing_admin_upgrade.sql`
2. `database/migrations/003_africa_engineering_tools.sql`
3. `database/migrations/004_engagement_auth_notifications_upgrade.sql`

> ✅ These add annual billing, promo codes, admin controls, proposal scenarios, battery QR ledger tables, cable compliance records, client feedback, and OTP reset support.

### Step 2.4 — Run the seed data
1. Click **"New query"** again
2. Open: `database/seeds/001_seed_data.sql`
3. Copy ALL the contents and paste into the SQL Editor  
4. Click **"Run"**

### Step 2.5 — Enable Google Auth
1. In Supabase, go to **Authentication** → **Providers**
2. Find **Google** and toggle it ON
3. You'll need Google OAuth credentials:
   - Go to **console.cloud.google.com**
   - Create a new project
   - Go to **APIs & Services** → **Credentials**
   - Click **"Create Credentials"** → **"OAuth Client ID"**
   - Application type: **Web application**
   - Add Authorized redirect URI: `https://your-project.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret** back to Supabase
4. Save changes

### Step 2.6 — Get your API keys
1. Go to **Project Settings** (gear icon, bottom left) → **API**
2. Copy and save these — you'll need them later:
   - **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - **anon/public** key (long string starting with `eyJ...`)
   - **service_role** key (another long string — **keep this SECRET, never share**)

---

## PHASE 3 — Set Up Termii (SMS/WhatsApp Notifications)

**Termii sends OTP and platform alerts: password reset, payment confirmations, and recovery updates.**

### Step 3.1 — Configure Termii
1. Log into **termii.com**
2. Complete sender/profile verification
3. Create a sender ID (example: `SolNuv`)

### Step 3.2 — Get your API credentials
1. Copy your **Termii API Key** from dashboard settings
2. Save your sender ID and API key for deployment env vars

---

## PHASE 4 — Set Up Paystack (Payments)

**Paystack processes your Nigerian ₦ subscription payments.**

### Step 4.1 — Get Paystack keys
1. Log into **paystack.com** (or create account at paystack.com/signup)
2. Complete business verification (upload CAC documents if available)
3. Go to **Settings** → **API Keys & Webhooks**
4. Copy and save:
   - **Test Secret Key** (starts with `sk_test_...`) — use this for testing first
   - **Test Public Key** (starts with `pk_test_...`)
5. When ready to go live: switch to **Live** keys

### Step 4.2 — Set up webhook
1. Still in Paystack **Settings** → **API Keys & Webhooks**
2. Add webhook URL: `https://api.solnuv.com/api/payments/webhook`
3. Save

---

## PHASE 5 — Deploy Backend to Render

**The backend is the engine. It runs all calculations, generates PDFs, talks to the database.**

### Step 5.1 — Connect GitHub to Render
1. Log into **render.com**
2. Click **"New"** → **"Web Service"**
3. Connect your GitHub account when prompted
4. Select your `solnuv` repository
5. Click **"Connect"**

### Step 5.2 — Configure the web service
Fill in these settings:
- **Name:** `solnuv-backend`
- **Root Directory:** `backend`
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** `Free`
- **Region:** Frankfurt (closest to Nigeria on free plan)

### Step 5.3 — Add environment variables
Click **"Advanced"** → **"Add Environment Variable"** and add each one:

```
NODE_ENV                    = production
PORT                        = 5000
FRONTEND_URL                = https://solnuv.com

SUPABASE_URL                = (paste your Supabase Project URL)
SUPABASE_SERVICE_ROLE_KEY   = (paste your service_role key)
SUPABASE_ANON_KEY           = (paste your anon key)

TERMII_API_KEY              = (your Termii API key)
TERMII_SENDER_ID            = SolNuv
TERMII_BASE_URL             = https://api.ng.termii.com/api

PAYSTACK_SECRET_KEY         = (your Paystack secret key)
JWT_SECRET                  = (generate this: open terminal, run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
CRON_SECRET                 = (generate same way as above)

SILVER_PRICE_USD_PER_GRAM   = 0.96
USD_TO_NGN_RATE             = 1620
NESREA_EMAIL                = compliance@nesrea.gov.ng
```

### Step 5.4 — Deploy
1. Click **"Create Web Service"**
2. Render will automatically build and deploy — takes 3–5 minutes
3. When done, you'll get a URL like: `https://solnuv-backend.onrender.com`
4. **SAVE THIS URL** — this is your backend API URL

### Step 5.5 — Verify backend is running
Open your browser and go to: `https://solnuv-backend.onrender.com/api/health`  
You should see: `{"status":"ok","platform":"SolNuv",...}`

> ⚠️ **Important:** Render's free tier "sleeps" after 15 minutes of no activity. The first request after sleep takes ~30 seconds. This is normal on the free tier. Upgrade to Render Starter ($7/month) to remove this.

---

## PHASE 6 — Deploy Frontend to Vercel

**Vercel hosts the website — the beautiful pages your users see at solnuv.com.**

### Step 6.1 — Connect Vercel to GitHub
1. Log into **vercel.com**
2. Click **"Add New"** → **"Project"**
3. Connect your GitHub account
4. Import your `solnuv` repository

### Step 6.2 — Configure the project
- **Framework Preset:** Next.js (Vercel auto-detects this)
- **Root Directory:** Click **"Edit"** → type `frontend`
- **Build Command:** `npm run build` (leave default)
- **Output Directory:** `.next` (leave default)

### Step 6.3 — Add environment variables
Click **"Environment Variables"** and add:

```
NEXT_PUBLIC_SUPABASE_URL          = (your Supabase Project URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY     = (your Supabase anon key)
NEXT_PUBLIC_API_URL               = https://solnuv-backend.onrender.com
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY   = (your Paystack public key)
NEXT_PUBLIC_APP_URL               = https://solnuv.com
```

### Step 6.4 — Deploy
1. Click **"Deploy"**
2. Vercel builds and deploys automatically — takes 2–3 minutes
3. You'll get a preview URL like: `https://solnuv-abc123.vercel.app`
4. Visit it to confirm the site loads correctly

---

## PHASE 7 — Connect Your Domain (solnuv.com)

**This is the final step — pointing solnuv.com to your deployed frontend and api.solnuv.com to your backend.**

### Step 7.1 — Add domain to Vercel (frontend)
1. In your Vercel project, go to **Settings** → **Domains**
2. Add `solnuv.com` and `www.solnuv.com`
3. Vercel will show you DNS records to add

### Step 7.2 — Add domain to Render (backend)
1. In your Render service, go to **Settings** → **Custom Domains**
2. Add `api.solnuv.com`
3. Render will show you a CNAME record to add

### Step 7.3 — Configure Cloudflare DNS
Since you already have solnuv.com on Cloudflare:

1. Log into **Cloudflare** → select `solnuv.com` → **DNS**
2. Add these records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` (or `solnuv.com`) | `cname.vercel-dns.com` | ✅ Proxied |
| CNAME | `www` | `cname.vercel-dns.com` | ✅ Proxied |
| CNAME | `api` | `(your-render-cname-from-step-7.2)` | ☁️ DNS Only |

> ⚠️ **Set the `api` subdomain to DNS Only (grey cloud)** — not proxied. Render handles its own SSL.

3. Wait 5–15 minutes for DNS to propagate worldwide

### Step 7.4 — Update environment variables with real URLs
After DNS is set up, update your Vercel environment:
- `NEXT_PUBLIC_API_URL` → change from `https://solnuv-backend.onrender.com` to `https://api.solnuv.com`

And update Render backend:
- `FRONTEND_URL` → confirm it's `https://solnuv.com`

### Step 7.5 — Update Supabase auth settings
1. Go to Supabase → **Authentication** → **URL Configuration**
2. Set **Site URL** to: `https://solnuv.com`
3. Add to **Redirect URLs**: `https://solnuv.com/auth/callback`
4. Save

---

## PHASE 8 — Final Verification Checklist

Go through each item and confirm:

```
✅ solnuv.com loads the landing page
✅ Calculator works without logging in (test silver calculator)
✅ "Get Started Free" button goes to /register
✅ Google Sign-in works
✅ Onboarding flow completes (3 steps)
✅ Dashboard loads after onboarding
✅ "Add Project" creates a project successfully
✅ Silver value appears on new project
✅ Estimated decommission date shows correctly for Lagos projects
✅ Email arrives when you create an account (check spam)
✅ Leaderboard shows on /leaderboard
✅ /api/health returns {"status":"ok"} at api.solnuv.com/api/health
```

---

## 🔧 Common Problems & Solutions

### "Build failed on Vercel"
- Check that your Root Directory is set to `frontend`
- Confirm all environment variables are added with exact names (no spaces)
- Check the build logs for the specific error message

### "Cannot connect to database"
- Double check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct
- Make sure you ran all SQL migrations in Steps 2.2 and 2.3
- The service_role key is different from the anon key — use service_role for backend

### "OTP / notifications are not sending"
- Verify `TERMII_API_KEY` and `TERMII_SENDER_ID` are set correctly
- Ensure phone numbers are valid and include country code where needed
- Check delivery logs in your Termii dashboard

### "Google Sign-in fails"
- Confirm the redirect URI in Google Console includes: `https://your-project.supabase.co/auth/v1/callback`
- Verify Site URL in Supabase Authentication settings matches your domain exactly

### "Payment fails"
- Start with Paystack TEST keys during development
- Check webhook URL is set in Paystack to: `https://api.solnuv.com/api/payments/webhook`
- Only switch to LIVE keys after testing all payment flows

### "Backend sleeps / slow first load"
- This is normal on Render's free tier
- Add a simple uptime monitor (UptimeRobot is free) to ping `/api/health` every 14 minutes to prevent sleep
- Go to uptimerobot.com → Create monitor → HTTP(s) → URL: `https://api.solnuv.com/api/health`

---

## 🔄 Updating Silver Prices

Silver prices change. Update them monthly:

1. Go to **metals-api.com** or **kitco.com** — check current silver price in USD/gram
2. Go to **xe.com** — check current USD to NGN rate
3. In Supabase SQL Editor, run:
```sql
INSERT INTO silver_prices (price_per_gram_usd, usd_to_ngn_rate, source)
VALUES (0.96, 1620.00, 'manual-update');
```
Replace `0.96` and `1620.00` with current values.

Alternatively, update Render environment variables:
- `SILVER_PRICE_USD_PER_GRAM` and `USD_TO_NGN_RATE`
Then click **"Manual Deploy"** in Render.

---

## 📅 Going from Free to Paid Plans

When you have paying customers, upgrade:

| Service | Free Limit | When to Upgrade | Paid Plan Cost |
|---------|-----------|-----------------|----------------|
| Render | Sleeps after 15min | >10 daily active users | $7/month (Starter) |
| Supabase | 500MB database | Database near 400MB | $25/month (Pro) |
| Termii | Usage-based | Notification volume grows | Termii paid tiers |
| Vercel | Generous | Almost never | $20/month |

---

## 🗂️ Key File Reference

When you need to update something:

| What | Where |
|------|-------|
| Plans/pricing | `frontend/src/pages/index.jsx` + `backend/src/controllers/paymentController.js` |
| Subscription prices (₦) | `backend/src/services/billingService.js` |
| Email templates | `backend/src/services/emailService.js` |
| Silver calculation formula | `backend/src/services/silverService.js` |
| Degradation algorithm | `backend/src/services/degradationService.js` |
| Nigerian states climate data | `database/seeds/001_seed_data.sql` |
| NESREA report PDF layout | `backend/src/services/pdfService.js` |
| Dashboard UI | `frontend/src/pages/dashboard/index.jsx` |

---

## 🆘 Getting Help

- **Platform issues:** Each platform has excellent free support docs
  - Supabase: supabase.com/docs
  - Vercel: vercel.com/docs
  - Render: render.com/docs
- **SolNuv questions:** compliance@solnuv.com

---

*SolNuv v1.0.0 — Built for Nigeria's Solar Sector*  
*Platform: Next.js + Node.js + Supabase + Vercel + Render*  
*Compliance: NESREA EPR Framework · 2024 Battery Control Regulations*
