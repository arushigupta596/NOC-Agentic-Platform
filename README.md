# NOC Agentic Platform

**AI-Powered Telecom Network Capacity Planning & Risk Analysis**

A full-stack application that combines deterministic risk analysis with multi-agent LLM intelligence to help Network Operations Centers (NOCs) forecast capacity issues, prioritize sites, and generate actionable recommendations.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Pipeline](#3-data-pipeline)
4. [Dataset Description](#4-dataset-description)
5. [Backend: Core Engines](#5-backend-core-engines)
6. [Forecasting Service](#6-forecasting-service)
7. [Multi-Agent LLM System](#7-multi-agent-llm-system)
8. [Frontend](#8-frontend)
9. [API Reference](#9-api-reference)
10. [Tech Stack](#10-tech-stack)
11. [Setup & Running](#11-setup--running)
12. [Project Structure](#12-project-structure)
13. [Key Design Decisions](#13-key-design-decisions)
14. [Limitations & Future Work](#14-limitations--future-work)

---

## 1. Problem Statement

Telecom NOC teams manage hundreds of cell sites. Key challenges:

- **Reactive operations**: Teams respond to outages instead of preventing them.
- **Manual analysis**: Utilization data is reviewed in spreadsheets; no automated risk scoring.
- **No probabilistic forecasting**: Traditional monitoring shows current state, not where things are heading.
- **Communication gap**: Technical metrics don't translate well for executive decision-makers.

**This platform solves these by combining:**
- Probabilistic time-series forecasting (LLMTime) to predict future utilization
- Deterministic, rules-based risk scoring for transparency and auditability
- Multi-agent LLM analysis for human-readable insights and recommendations
- A dashboard that serves both technical operators and business leadership

---

## 2. Architecture Overview

```
                                    +---------------------+
                                    |   Next.js Frontend  |
                                    |   (App Router)      |
                                    |   - Home Page       |
                                    |   - Run Dashboard   |
                                    |   - Site Detail     |
                                    +----------+----------+
                                               |
                                    +----------v----------+
                                    |   Next.js API Routes|
                                    |   POST /api/analyze |
                                    |   GET  /api/run/:id |
                                    |   GET  /api/site/.. |
                                    +----+------+----+----+
                                         |      |    |
                          +--------------+   +--+    +-------------+
                          |                  |                     |
               +----------v------+  +--------v--------+  +--------v--------+
               | Python FastAPI  |  |  OpenRouter API  |  |  Local Storage  |
               | Forecast Service|  |  (Claude Sonnet) |  |  outputs/*.json |
               | - LLMTime      |  |  - Analyst Agent  |  +-----------------+
               | - Stats Fallback|  |  - Planner Agent  |
               +-----------------+  |  - Evaluator Agent|
                                    |  - Risk Explainer |
                                    +-------------------+
```

**Data Flow (per analysis run):**

```
CSV Load --> Group by Site --> For Each Site:
  |-- Data Quality Report (outliers, missing dates, validation)
  |-- Apply Scenario (remove or winsorize festival spikes)
  |-- Compute Statistics (capacity estimation, volatility, growth)
  |-- Call Forecast Service (LLMTime or statistical fallback)
  |-- Convert Forecast to Utilization (using estimated capacity)
  |-- Risk Engine (deterministic GREEN/AMBER/RED classification)
  |-- Priority Scoring (transparent formula, max 100)
  |-- LLM Analyst Agent (3-bullet site summary)
  |-- LLM Planner Agent (playbook-based action recommendations)
  |-- LLM Risk Explainer (plain-language how & why)

Sort Sites by Priority Score -->
  LLM Evaluator Agent (executive summary) -->
    Save to Local Filesystem --> Return Results
```

---

## 3. Data Pipeline

### 3.1 Data Loading & Validation

The pipeline starts by reading the CSV dataset from the `data/` directory using PapaParse. Every row is validated against a Zod schema:

```typescript
SiteRowSchema = {
  date:            string (ISO YYYY-MM-DD),
  site_id:         string,
  region:          string,
  site_type:       "urban" | "semi_urban" | "rural",
  traffic_gb:      number,
  utilization_pct: number (0-100)
}
```

Invalid rows are silently dropped. This ensures downstream engines always work with clean, typed data.

### 3.2 Data Quality Assessment

For each site, the system generates a quality report:

- **Missing dates**: Counts gaps in the date range (e.g., site has data for Jan 1 and Jan 3 but not Jan 2)
- **Outlier detection**: Computes z-scores on `traffic_gb`; flags rows with z-score > 3.0 as potential festival spikes
- **Invalid values**: Flags rows with zero or negative traffic

### 3.3 Scenario Handling

Users can choose how to handle detected outliers before forecasting:

| Scenario | What it does | When to use |
|----------|-------------|-------------|
| **Winsorize spikes** (default) | Caps outlier values at the 95th percentile | Smooth out extremes while preserving trend |
| **Remove festival spikes** | Drops outlier rows entirely | See baseline capacity without events |
| **Neither** | Raw data as-is | Compare effect of spike handling |

---

## 4. Dataset Description

**File**: `data/telecom_noc_multi_site_with_festival_spikes.csv`

| Property | Value |
|----------|-------|
| Rows | 300 (60 days x 5 sites) |
| Date range | 2024-01-01 to 2024-02-29 |
| Granularity | Daily |
| Sites | 5 |

### Sites in the Dataset

| Site ID | Region | Type | Typical Traffic | Behavior |
|---------|--------|------|-----------------|----------|
| BLR_045 | South | Urban | 800-1000 GB | High utilization, festival spikes |
| DEL_112 | North | Urban | 900-1100 GB | Highest traffic, congestion risk |
| MUM_203 | West | Urban | 850-1050 GB | Steady growth pattern |
| LKO_017 | North | Semi-urban | 500-700 GB | Moderate, seasonal variance |
| RJT_009 | West | Rural | 380-550 GB | Lower utilization, stable |

### Festival Spike Dates

The dataset includes intentional traffic spikes corresponding to Indian festival/event periods:
- Jan 13-14 (Lohri/Makar Sankranti)
- Jan 26-27 (Republic Day)
- Feb 10-11, 13-14 (various)
- Feb 26-27 (highest spike, utilization 90-91%)

These spikes test the system's outlier detection and scenario handling.

---

## 5. Backend: Core Engines

All engines are deterministic (no randomness, no LLM) making them auditable and reproducible.

### 5.1 Capacity Estimation (`lib/stats.ts`)

**Problem**: The dataset has `traffic_gb` and `utilization_pct` but no explicit capacity column. We need capacity to convert forecast traffic into utilization percentages.

**Method**:
```
For rows where 40% <= utilization_pct <= 90%:
    capacity_estimate = traffic_gb / (utilization_pct / 100)

capacity_gb = median(all capacity_estimates)
```

The 40-90% filter selects rows where the site is operating normally (not idle or saturated). Taking the median makes the estimate robust to outliers.

**Fallback** (if fewer than 5 eligible rows):
```
capacity_gb = median(traffic_gb) * 1.5
```

### 5.2 Site Statistics (`lib/stats.ts`)

Per-site aggregates computed from the processed (post-scenario) data:

| Metric | Formula | Purpose |
|--------|---------|---------|
| `avg_traffic` | mean(all traffic_gb) | Baseline level |
| `peak_traffic` | max(traffic_gb) | Worst observed day |
| `volatility` | stddev(traffic) / mean(traffic) | Coefficient of variation; high = unpredictable |
| `avg_last_7d` | mean(last 7 days traffic) | Recent trend |
| `avg_last_14d` | mean(last 14 days traffic) | Short-term average |
| `avg_prev_14d` | mean(days -28 to -14 traffic) | Previous period for growth comparison |

### 5.3 Risk Engine (`lib/riskEngine.ts`)

Converts forecast percentiles (P10/P50/P90) to utilization percentages, then applies threshold rules.

**Utilization conversion**:
```
util_pct = (forecast_traffic_gb / capacity_gb) * 100
```

**Severity classification**:

```
IF p50_peak_util >= critical (90%)
   OR >= 2 consecutive days with p90_util >= critical:
   --> RED (action required)

ELSE IF p50_peak_util >= risk (80%)
   OR any day p90_util >= risk:
   --> RED

ELSE IF p90_peak_util >= watch (75%):
   --> AMBER (monitor closely)

ELSE:
   --> GREEN (healthy)
```

**Outputs**:
- `severity`: GREEN / AMBER / RED
- `risk_windows`: Array of specific dates where p90 utilization exceeds risk threshold
- `p50_peak_util` / `p90_peak_util`: Peak utilization across forecast horizon
- `reason`: Human-readable technical explanation

### 5.4 Priority Scoring (`lib/scoring.ts`)

A transparent, additive formula producing a score from 0 to 100:

| Component | Calculation | Max Points |
|-----------|-------------|------------|
| **Severity** | GREEN=0, AMBER=30, RED=60 | 60 |
| **Risk Days** | 2 points per day with p90 > risk threshold | 20 |
| **Growth** | `((avg_last14 - avg_prev14) / avg_prev14) * 100`, clamped 0-10 | 10 |
| **Uncertainty** | `avg((p90 - p10) / p50) * 100`, clamped 0-10 | 10 |
| **Urban Bonus** | +5 if site_type is "urban" | 5 |

**Why these components?**
- **Severity** dominates because RED sites need immediate attention
- **Risk Days** captures duration, not just peak severity
- **Growth** catches sites trending upward even if not yet at threshold
- **Uncertainty** penalizes sites where forecast confidence is low (wider P10-P90 band)
- **Urban Bonus** reflects higher customer density and business impact

**Score = sum(all components), clamped to [0, 100]**

---

## 6. Forecasting Service

### 6.1 LLMTime Overview

LLMTime (NeurIPS 2023, Gruver et al.) treats time-series forecasting as text completion. It:
1. Encodes the time series as a string of numbers
2. Feeds it to a large language model as a prompt
3. Samples multiple continuations (forecast paths)
4. Extracts percentiles (P10/P50/P90) from the samples

**Key insight**: LLMs have implicit knowledge of numerical patterns, trends, and seasonality from pre-training on internet text containing numerical data.

### 6.2 Service Architecture

The forecasting service is a Python FastAPI application (`forecasting/main.py`):

**Endpoint**: `POST /forecast`

```python
Request:
{
    "site_id": "BLR_045",
    "dates": ["2024-01-01", "2024-01-02", ...],
    "traffic_gb": [820, 835, ...],
    "horizon": 14,      # days to forecast
    "samples": 20       # Monte Carlo paths
}

Response:
{
    "site_id": "BLR_045",
    "forecast_dates": ["2024-03-01", ...],
    "p10": [870.2, ...],    # optimistic bound
    "p50": [920.5, ...],    # most likely
    "p90": [985.3, ...],    # pessimistic bound
    "samples": [[...], ...]  # all sample paths
}
```

### 6.3 Statistical Fallback

If LLMTime is not installed, the service falls back to exponential smoothing with bootstrap:

```python
alpha = 0.3          # smoothing factor
level = last_value   # start from most recent observation
trend = mean(diff(last 14 days))  # linear trend estimate
noise = Normal(0, stddev(historical residuals))

For each sample, for each horizon step:
    forecast = level + trend + noise
    level = forecast  # update for next step
```

This produces reasonable probabilistic forecasts for demo purposes.

### 6.4 Fallback in the API Route

If the entire forecast service is unreachable, the Next.js API route creates a simple linear extrapolation:

```typescript
base = last_traffic + trend * (day / 7)
p50 = round(base)
p10 = round(base * 0.9)    // 10% below
p90 = round(base * 1.15)   // 15% above
```

This ensures the pipeline always completes, even without the Python service.

---

## 7. Multi-Agent LLM System

The platform uses four specialized LLM agents, each with a carefully crafted system prompt. All agents are called via OpenRouter using Claude Sonnet 4.

### 7.1 Agent Architecture

```
                    +------------------+
                    |   Analyst Agent  |  Per site
                    |   (Health check) |  "Is this site healthy?"
                    +------------------+
                            |
                    +------------------+
                    |   Planner Agent  |  Per site (AMBER/RED only)
                    |   (Actions)      |  "What should we do?"
                    +------------------+
                            |
                    +------------------+
                    |  Risk Explainer  |  Per site
                    |   (Plain lang.)  |  "Explain this to my manager"
                    +------------------+
                            |
                    +------------------+
                    |  Evaluator Agent |  Once per run
                    |   (Exec summary) |  "Brief the CTO"
                    +------------------+
```

### 7.2 Analyst Agent

**Purpose**: Generate a human-readable site health summary.

**Input**: Recent stats (7-day avg, peak, volatility), outlier list, capacity, last utilization.

**Output**:
```json
{
    "site_id": "DEL_112",
    "summary": [
        "Delhi site is operating at 85% average utilization over the past week.",
        "Two significant traffic spikes detected in January coinciding with festivals.",
        "Growth trend of 3.2% over the past 14 days indicates rising demand."
    ],
    "candidate": true,
    "candidate_reason": "High utilization with upward growth trend warrants capacity review."
}
```

### 7.3 Planner Agent

**Purpose**: Recommend specific actions from a predefined playbook.

**Key design choice**: The planner can ONLY recommend actions from the playbook (no hallucinated recommendations). This makes outputs actionable and safe.

**Playbook categories**:
- **Immediate** (RED): Traffic shaping, emergency load balancing, field team alert
- **Short-term** (AMBER/RED): Capacity upgrade review, spectrum carriers, antenna optimization, QoS policy adjustment
- **Monitoring** (any): Standard monitoring, increased frequency, automated alerts
- **Event-play**: Temporary mobile cell deployment, events team coordination

**Output**:
```json
{
    "site_id": "DEL_112",
    "actions": [
        {
            "action": "Enable traffic shaping on congested interfaces",
            "effort": "low",
            "expected_impact": "10-15% reduction in peak congestion",
            "dependencies": []
        },
        {
            "action": "Schedule capacity upgrade review for next planning cycle",
            "effort": "med",
            "expected_impact": "Long-term capacity alignment with demand growth",
            "dependencies": ["Budget approval"]
        }
    ]
}
```

### 7.4 Risk Explainer Agent

**Purpose**: Translate technical risk metrics into plain language that non-technical stakeholders can understand.

**Design**: Uses analogies (road traffic, water pipes) and avoids jargon. Written at 10th-grade reading level.

**Output**:
```json
{
    "how": "We analyzed 60 days of network traffic data and predicted the next 14 days. Think of the network like a highway -- at the most likely scenario, this site will be at 91% capacity, like a highway with almost no room for more cars. In the worst-case scenario, it exceeds 100%.",
    "why": "If nothing is done, customers in Delhi may experience slow internet, dropped video calls, and failed downloads during peak hours. This directly impacts customer satisfaction and could drive churn to competitors."
}
```

### 7.5 Evaluator Agent

**Purpose**: Produce an executive summary across all sites for CTO-level briefing.

**Input**: Severity counts, top 5 sites with scores, data quality overview.

**Output**:
```json
{
    "exec_bullets": [
        "3 of 5 monitored sites are flagged RED, indicating imminent capacity pressure across urban regions.",
        "Delhi (DEL_112) and Bangalore (BLR_045) require immediate intervention with peak utilization forecasted above 90%.",
        "Data quality is high with no missing records, supporting high confidence in these predictions."
    ],
    "top_sites": [
        { "site_id": "DEL_112", "why": "Highest priority at 91% P50 peak with 14 consecutive risk days." },
        { "site_id": "BLR_045", "why": "Urban site with accelerating growth trend and P90 above critical." },
        { "site_id": "MUM_203", "why": "Steady rise in utilization approaching risk threshold." }
    ],
    "confidence": "high"
}
```

### 7.6 LLM Guardrails

All LLM interactions have safety mechanisms:

1. **Schema enforcement**: Every LLM output is validated with Zod. If parsing fails, the system retries once with a stricter prompt.
2. **No raw data to LLM**: Only computed summaries and metrics are sent (never raw CSV rows).
3. **Best-effort**: If any LLM call fails, the pipeline continues with deterministic results only.
4. **Low temperature** (0.2): Minimizes randomness in outputs.
5. **JSON mode**: OpenRouter `response_format: json_object` ensures structured output.
6. **Playbook constraint**: Planner agent can only recommend predefined actions.

---

## 8. Frontend

### 8.1 Home Page (`/`)

Parameter form for configuring an analysis run:
- Dataset selector (fixed to demo CSV)
- Forecast horizon (7-90 days)
- Number of Monte Carlo samples (5-100)
- Utilization thresholds (watch/risk/critical)
- Scenario toggles (remove vs. winsorize spikes)

### 8.2 Run Dashboard (`/runs/[runId]`)

After running analysis:
- **Executive Summary**: AI-generated 3-bullet overview with confidence level
- **Severity Counters**: Visual RED/AMBER/GREEN counts
- **Site Rankings Table**: Sortable by priority score, severity, P90 utilization, or site ID. Filterable by severity level.

### 8.3 Site Detail (`/runs/[runId]/site/[siteId]`)

Deep-dive into a single site:
- **Forecast Chart** (Recharts): Historical traffic + P10/P50/P90 forecast bands with 80% and 90% capacity reference lines
- **Risk Assessment**: Utilization gauge bars with threshold markers, capacity context, plain-language explanation (How & Why), technical details
- **Priority Score Breakdown**: Component-by-component score decomposition
- **Analyst Summary**: AI-generated health bullets
- **Recommended Actions**: Planner-generated actions with effort/impact ratings
- **Data Quality**: Row counts, missing days, outlier summary

---

## 9. API Reference

### POST `/api/analyze`

Runs the full analysis pipeline.

**Request Body**:
```json
{
    "dataset": "telecom_noc_multi_site_with_festival_spikes.csv",
    "horizonDays": 14,
    "samples": 20,
    "thresholds": { "watch": 75, "risk": 80, "critical": 90 },
    "scenario": { "removeFestivalSpikes": false, "winsorizeSpikes": true }
}
```

**Response**: `{ "runId": "uuid-here", "status": "done" }`

### GET `/api/run/[runId]`

Returns full run results including all site data and evaluator output.

### GET `/api/site/[runId]/[siteId]`

Returns detailed results for a single site.

---

## 10. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | React SSR/CSR framework |
| **Styling** | Tailwind CSS 4 | Utility-first CSS |
| **Charts** | Recharts | React charting (area, line, reference lines) |
| **Validation** | Zod 4 | Runtime schema validation (both input and LLM output) |
| **CSV Parsing** | PapaParse | Robust CSV-to-JSON parsing |
| **IDs** | UUID v4 | Unique run identifiers |
| **LLM Gateway** | OpenRouter | Multi-model API gateway (Claude Sonnet 4) |
| **Forecasting** | Python FastAPI + LLMTime | Probabilistic time-series forecasting |
| **Storage** | Local filesystem | JSON-based run persistence |
| **Language** | TypeScript (frontend/API), Python (forecasting) | Type safety everywhere |

---

## 11. Setup & Running

### Prerequisites

- Node.js 18+
- Python 3.9+ (for forecasting service)
- OpenRouter API key

### Installation

```bash
# Clone and install
cd noc-agentic-vercel
npm install

# Set up environment
cp .env.local.example .env.local
# Edit .env.local and add your OPENROUTER_API_KEY

# (Optional) Set up Python forecasting service
cd forecasting
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
cd ..

# Run the app
npm run dev
```

Open http://localhost:3000

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | API key for LLM calls via OpenRouter |
| `FORECAST_SERVICE_URL` | No | URL of Python forecast service (default: http://localhost:8000) |
| `FORECAST_API_KEY` | No | API key for forecast service authentication |
| `STORAGE_MODE` | No | "local" (default) or "blob" for Vercel Blob |

---

## 12. Project Structure

```
noc-agentic-vercel/
|
|-- data/
|   |-- telecom_noc_multi_site_with_festival_spikes.csv   # Demo dataset
|
|-- lib/                              # Core TypeScript libraries
|   |-- schemas.ts                    # Zod schemas for all data types
|   |-- dataLoader.ts                 # CSV parsing, validation, quality reports
|   |-- stats.ts                      # Per-site statistics & capacity estimation
|   |-- riskEngine.ts                 # Deterministic risk classification
|   |-- scoring.ts                    # Priority scoring formula
|   |-- openrouter.ts                 # OpenRouter LLM wrapper with retry
|   |-- storage.ts                    # Local filesystem persistence
|
|-- app/                              # Next.js App Router
|   |-- layout.tsx                    # Root layout with header
|   |-- globals.css                   # Tailwind imports & base styles
|   |-- page.tsx                      # Home page (analysis form)
|   |-- runs/[runId]/
|   |   |-- page.tsx                  # Run dashboard
|   |   |-- site/[siteId]/
|   |       |-- page.tsx              # Site detail page
|   |-- api/
|   |   |-- analyze/route.ts          # POST - run analysis pipeline
|   |   |-- run/[runId]/route.ts      # GET - fetch run results
|   |   |-- site/[runId]/[siteId]/route.ts  # GET - fetch site detail
|   |-- components/
|       |-- SiteTable.tsx             # Sortable/filterable site ranking table
|       |-- ForecastChart.tsx         # Recharts P10/P50/P90 visualization
|       |-- ExecSummary.tsx           # Executive summary display
|
|-- forecasting/                      # Python forecasting service
|   |-- main.py                       # FastAPI app with /forecast endpoint
|   |-- requirements.txt              # Python dependencies
|
|-- forecasting-client/
|   |-- llmtimeClient.ts             # TypeScript client for forecast service
|
|-- prompts/                          # LLM system prompts
|   |-- analyst.system.txt            # Site health analysis
|   |-- planner.system.txt            # Action recommendations
|   |-- evaluator.system.txt          # Executive summary
|   |-- risk-explainer.system.txt     # Plain-language risk explanation
|
|-- outputs/                          # Run result storage (gitignored)
|-- .env.local                        # Environment variables (gitignored)
|-- .env.local.example                # Template for env vars
```

---

## 13. Key Design Decisions

### Deterministic First, LLM Second

The risk engine and scoring are fully deterministic. LLM agents add narrative and recommendations on top. If LLMs fail, the platform still produces usable results. This means:
- Results are reproducible with the same inputs
- No "black box" risk classification
- LLM outputs enhance but never override the quantitative analysis

### Playbook-Constrained Planner

The Planner agent cannot hallucinate novel recommendations. It must choose from a predefined action playbook. This is critical for operational safety since incorrect network actions could cause outages.

### Schema Validation Everywhere

Zod validates:
- CSV input rows (drop invalid data)
- API request bodies (reject malformed requests)
- LLM outputs (retry if schema doesn't match)
- Forecast service responses (ensure correct structure)

### Graceful Degradation

Every external dependency has a fallback:
- Forecast service down --> linear extrapolation
- LLMTime not installed --> exponential smoothing
- OpenRouter fails --> skip LLM output, show deterministic results
- Invalid LLM response --> retry once, then skip

---

## 14. Limitations & Future Work

### Current Limitations

- **Single dataset**: Currently hardcoded to the demo CSV; upload functionality planned
- **Sequential processing**: Sites are processed one at a time (parallel with p-limit is a planned optimization)
- **No persistent database**: Run results stored as JSON files; Postgres/Supabase integration planned
- **No authentication**: No user login or RBAC; planned for production
- **Forecast chart history**: Site detail page shows forecast only (historical data not passed to chart component yet)

### Future Enhancements

- **Scenario comparison**: Side-by-side view of baseline vs. spike-removed forecasts
- **Report export**: Generate PDF/Markdown executive reports
- **Webhook alerts**: Slack/email notifications when RED sites detected
- **Multi-dataset support**: Upload and select different CSV files
- **Real-time ingestion**: Stream data from network monitoring tools
- **Deployment**: Vercel (frontend) + Railway (FastAPI) with CI/CD via GitHub Actions
