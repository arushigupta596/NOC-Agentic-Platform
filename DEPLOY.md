# Deployment Guide — NOC Agentic Platform

Two components to deploy:
1. **Next.js app** (frontend + API routes) → Vercel
2. **Python forecasting service** (FastAPI) → Render / Railway / any Docker host

> The Next.js app works without the Python service (falls back to linear extrapolation).
> Deploy the Next.js app first, add the Python service later if needed.

---

## Part 1: Deploy Next.js to Vercel

### Method A: Vercel CLI (fastest — no GitHub needed)

```bash
# 1. Navigate to the project
cd noc-agentic-vercel

# 2. Initialize git (Vercel needs it)
git init
git add -A
git commit -m "Initial commit: NOC Agentic Platform"

# 3. Deploy to Vercel
vercel

# Follow the prompts:
#   - Log in if prompted
#   - Set up and deploy? Y
#   - Which scope? (select your account)
#   - Link to existing project? N
#   - Project name: noc-agentic-vercel
#   - Directory: ./
#   - Override settings? N

# 4. Set environment variables
vercel env add OPENROUTER_API_KEY
# Paste: sk-or-v1-REDACTED
# Select: Production, Preview, Development

# 5. Deploy to production
vercel --prod
```

Your app will be live at `https://noc-agentic-vercel.vercel.app` (or similar).

---

### Method B: GitHub + Vercel (CI/CD auto-deploys)

```bash
# 1. Initialize git
cd noc-agentic-vercel
git init
git add -A
git commit -m "Initial commit: NOC Agentic Platform"

# 2. Create GitHub repo (using GitHub CLI or web)
# Option A - GitHub CLI:
brew install gh
gh auth login
gh repo create noc-agentic-vercel --private --push

# Option B - GitHub web:
# Go to github.com/new
# Create "noc-agentic-vercel" (private)
# Then:
git remote add origin https://github.com/YOUR_USERNAME/noc-agentic-vercel.git
git push -u origin main

# 3. Connect to Vercel
# Go to https://vercel.com/new
# Import your GitHub repository
# Configure:
#   - Framework: Next.js (auto-detected)
#   - Root Directory: ./
#   - Environment Variables:
#       OPENROUTER_API_KEY = sk-or-v1-...
#       FORECAST_SERVICE_URL = (leave blank for now, add after Python deploy)
# Click Deploy

# 4. Future pushes auto-deploy
git add . && git commit -m "Update" && git push
# Vercel auto-builds and deploys on every push
```

---

### Important: Vercel Configuration Notes

**Output directory**: Vercel auto-detects Next.js — no config needed.

**Data files**: The `data/` directory with the CSV is included in the deployment. `fs.readFileSync` works in Vercel serverless functions.

**Outputs directory**: The `outputs/` directory for run storage works locally but is **ephemeral on Vercel** (serverless functions don't persist filesystem writes across invocations). For production:
- Switch to Vercel Blob (`@vercel/blob`) or S3
- Or use the app as a demo where runs are generated fresh each time

**Function timeout**: The `maxDuration = 120` in the analyze route allows up to 2 minutes on Vercel Pro. On the free tier, the limit is 10 seconds for serverless functions. If you hit timeouts:
- Upgrade to Vercel Pro ($20/month), or
- Reduce the number of LLM calls (skip analyst/planner for GREEN sites)

---

## Part 2: Deploy Python Forecasting Service

### Option A: Render (free tier available)

```bash
# 1. Create a Dockerfile in forecasting/
```

Create this file:

```dockerfile
# forecasting/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# 2. Push to GitHub (if not already)
# The forecasting/ directory should be in the same repo

# 3. Go to https://render.com
# Click "New" → "Web Service"
# Connect your GitHub repo
# Configure:
#   - Name: noc-forecast-service
#   - Root Directory: forecasting
#   - Runtime: Docker
#   - Instance Type: Free (or Starter $7/mo for better performance)
#   - Environment Variables:
#       FORECAST_API_KEY = your-secret-key (optional)
# Click "Create Web Service"

# 4. After deploy, copy the URL (e.g., https://noc-forecast-service.onrender.com)

# 5. Update Vercel environment variable
vercel env add FORECAST_SERVICE_URL
# Paste: https://noc-forecast-service.onrender.com
vercel --prod  # redeploy to pick up the new env var
```

---

### Option B: Railway

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create project
cd forecasting
railway init

# 4. Deploy
railway up

# 5. Set environment variables on Railway dashboard
# FORECAST_API_KEY = your-secret-key

# 6. Get the public URL from Railway dashboard
# Update Vercel env: FORECAST_SERVICE_URL = https://your-app.railway.app
```

---

### Option C: Any Docker Host (AWS ECS, DigitalOcean, Fly.io, etc.)

```bash
# 1. Build the Docker image
cd forecasting
docker build -t noc-forecast .

# 2. Run locally to test
docker run -p 8000:8000 -e FORECAST_API_KEY=secret noc-forecast

# 3. Push to your container registry and deploy
# AWS ECR + ECS, DigitalOcean App Platform, Fly.io, etc.
```

---

## Part 3: Create the Dockerfile

```bash
# Run this to create the Dockerfile
```

---

## Post-Deployment Checklist

After deploying both services:

- [ ] **Verify Vercel deployment**
  ```bash
  curl https://your-app.vercel.app
  # Should return the HTML page
  ```

- [ ] **Verify forecasting service**
  ```bash
  curl https://your-forecast-service.onrender.com/health
  # Should return: {"status":"ok","llmtime_available":false}
  ```

- [ ] **Test analysis endpoint**
  ```bash
  curl -X POST https://your-app.vercel.app/api/analyze \
    -H "Content-Type: application/json" \
    -d '{"dataset":"telecom_noc_multi_site_with_festival_spikes.csv","horizonDays":14,"samples":20}'
  # Should return: {"runId":"...","status":"done"}
  ```

- [ ] **Test the UI**
  - Open your Vercel URL in browser
  - Click "Run Analysis"
  - Verify results appear with executive summary
  - Click into a site detail page

- [ ] **Set up environment variables** on Vercel dashboard:
  | Variable | Value |
  |----------|-------|
  | `OPENROUTER_API_KEY` | `sk-or-v1-...` |
  | `FORECAST_SERVICE_URL` | `https://your-forecast-service.onrender.com` |
  | `FORECAST_API_KEY` | (same key set on your Python service) |

---

## Quick Reference: Deploy Commands

```bash
# === ONE-TIME SETUP ===
cd noc-agentic-vercel
git init
git add -A
git commit -m "Initial commit: NOC Agentic Platform"

# === DEPLOY TO VERCEL ===
vercel                          # first time — sets up project
vercel env add OPENROUTER_API_KEY  # set API key
vercel --prod                   # deploy to production

# === UPDATE DEPLOYMENT ===
git add -A
git commit -m "Update"
vercel --prod                   # redeploy

# === CHECK DEPLOYMENT ===
vercel ls                       # list deployments
vercel logs                     # view logs
vercel env ls                   # list env vars
```

---

## Troubleshooting

### "Function timeout" on Vercel
- Free tier has 10s limit. You need Vercel Pro ($20/mo) for 120s timeout.
- Or reduce LLM calls: set `OPENROUTER_API_KEY` to empty to skip LLM features.

### "OPENROUTER_API_KEY not set" error
- Run `vercel env add OPENROUTER_API_KEY` and redeploy with `vercel --prod`.

### Forecasting service returns 500
- Check if `requirements.txt` installed correctly.
- The service works without llmtime (falls back to statistical method).
- Check Render/Railway logs for the specific error.

### Run outputs not persisting between requests on Vercel
- Vercel serverless functions are stateless — filesystem writes don't persist.
- For demo: run analysis and view results in the same session.
- For production: switch to Vercel Blob or Supabase for storage.

### CORS errors from forecast service
- The Python service allows all origins by default (`allow_origins=["*"]`).
- If you've changed this, add your Vercel domain to the allowed origins.
