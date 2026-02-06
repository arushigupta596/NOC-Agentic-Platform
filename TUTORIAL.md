# NOC Agentic Platform -- User Tutorial

A step-by-step guide to every feature in the application.

---

## Getting Started

### Starting the Application

1. Open a terminal in the `noc-agentic-vercel` directory.
2. Run `npm run dev` to start the development server.
3. Open your browser to **http://localhost:3000**.
4. (Optional) In a separate terminal, start the Python forecasting service:
   ```bash
   cd forecasting
   uvicorn main:app --reload --port 8000
   ```

You will see the **Home Page** with the analysis configuration form.

---

## Page 1: Home Page -- Configure & Run Analysis

**URL**: `http://localhost:3000`

This is your starting point. Here you configure the parameters for a capacity analysis run.

### Feature: Dataset Selector

- **What it shows**: The CSV file that will be analyzed.
- **Current value**: `telecom_noc_multi_site_with_festival_spikes.csv` (the demo dataset with 5 Indian telecom sites over 60 days).
- **Note**: This field is read-only in the demo. Future versions will support uploading custom datasets.

### Feature: Forecast Horizon (days)

- **What it does**: Controls how many days into the future the system will forecast.
- **Range**: 7 to 90 days.
- **Default**: 14 days.
- **Tip**: A 14-day horizon is good for operational planning. Use 30-90 days for strategic capacity reviews. Longer horizons will have wider uncertainty bands (P10-P90 spread).

### Feature: Forecast Samples

- **What it does**: Sets how many Monte Carlo sample paths the forecasting engine generates. More samples = more accurate percentile estimates but slower.
- **Range**: 5 to 100.
- **Default**: 20.
- **Tip**: 20 is a good balance for demos. Use 50-100 for production-quality analysis.

### Feature: Utilization Thresholds

Three adjustable thresholds that control how the risk engine classifies sites:

| Threshold | Default | Color | Meaning |
|-----------|---------|-------|---------|
| **Watch** | 75% | Amber | "Keep an eye on this" -- early warning |
| **Risk** | 80% | Orange | "This needs attention" -- planning trigger |
| **Critical** | 90% | Red | "Act now" -- immediate intervention needed |

- **How they work**: The risk engine compares forecasted utilization percentages against these thresholds. A site is classified as RED if its median (P50) forecast crosses the risk threshold, or if worst-case (P90) repeatedly exceeds critical.
- **Tip**: Lowering thresholds makes the system more conservative (more alerts). Raising them makes it more permissive.

### Feature: Scenario Options

Two toggles that control how the system handles detected traffic outliers (festival spikes):

**Winsorize spikes (default: ON)**
- Caps extreme traffic values at the 95th percentile before forecasting.
- The spikes are still in the data, but their magnitude is reduced.
- *Use when*: You want to forecast "normal" traffic patterns without being skewed by one-time events, but still acknowledge that spikes happened.

**Remove festival spikes entirely (default: OFF)**
- Completely removes outlier dates from the data before forecasting.
- *Use when*: You want to see the pure baseline capacity trend without any event influence.
- **Note**: These two options are mutually exclusive. Enabling one disables the other.

### Feature: Run Analysis Button

- **What it does**: Sends your configuration to the backend, which runs the full pipeline:
  1. Loads and validates the CSV
  2. Detects outliers and applies your scenario choice
  3. Computes statistics and capacity estimates for each site
  4. Calls the forecasting service for probabilistic predictions
  5. Runs the risk engine to classify each site
  6. Computes priority scores
  7. Calls 4 LLM agents (analyst, planner, risk explainer, evaluator)
  8. Saves results and redirects you to the Run Dashboard

- **Duration**: Typically 20-40 seconds (most time is spent on LLM calls).
- **What to expect**: A loading spinner while the analysis runs, then automatic redirect to the results page.

---

## Page 2: Run Dashboard -- Overview of All Sites

**URL**: `http://localhost:3000/runs/[runId]`

After the analysis completes, you arrive here. This is the command center view.

### Feature: Run Header

- **Run ID**: A unique identifier for this analysis run (truncated for readability).
- **Status Badge**: Shows DONE (green), RUNNING (blue), or ERROR (red).
- **Timestamps**: When the run was created and completed.

### Feature: Auto-Refresh (while running)

- If the analysis is still processing, the page shows a blue banner: "Analysis is running. This page will auto-refresh..."
- The page polls the server every 3 seconds until the run completes.
- No manual refresh needed.

### Feature: Executive Summary

A card at the top of the dashboard containing AI-generated insights:

**Severity Counters**
- Three colored dots with counts: how many sites are RED, AMBER, and GREEN.
- Gives you an instant sense of the network's overall health.

**Executive Bullets**
- 3 AI-generated bullet points summarizing the capacity outlook.
- Written for a CTO/VP audience -- concise, business-focused language.
- Example: "3 of 5 monitored sites are flagged RED, indicating imminent capacity pressure across urban regions."

**Top Priority Sites**
- The 3 most critical sites with a one-line explanation of why each needs attention.
- Example: "DEL_112 -- Highest priority at 91% P50 peak with 14 consecutive risk days."

**Confidence Level**
- HIGH / MEDIUM / LOW indicator based on data quality.
- If there are missing data or many outliers, confidence is lowered.

**Fallback**: If the LLM was unavailable, you see: "Executive summary unavailable. Review the site table below for deterministic risk and scoring results." The deterministic results are always available.

### Feature: Site Rankings Table

A sortable, filterable table of all analyzed sites.

**Columns**:
| Column | What it shows |
|--------|--------------|
| **Site ID** | Unique identifier (e.g., DEL_112) |
| **Region** | Geographic region (North/South/East/West) |
| **Type** | Urban / Semi-urban / Rural |
| **Severity** | Color-coded badge: RED, AMBER, or GREEN |
| **Priority** | Score from 0-100 (higher = more urgent) |
| **P90 Peak Util** | Worst-case peak utilization percentage |
| **Risk Days** | Number of forecast days with utilization above risk threshold |
| **View Detail** | Link to the site's detailed page |

**Sorting** (click any column header):
- Click once to sort descending (highest first).
- Click again to sort ascending.
- Default: sorted by Priority score, highest first.
- You can sort by any column: Site ID (alphabetical), Severity (RED first), Priority, or P90 utilization.

**Filtering** (buttons above the table):
- **ALL**: Show all sites.
- **RED**: Show only RED-severity sites.
- **AMBER**: Show only AMBER-severity sites.
- **GREEN**: Show only GREEN-severity sites.
- Useful for focusing on sites that need immediate attention.

---

## Page 3: Site Detail -- Deep Dive into a Single Site

**URL**: `http://localhost:3000/runs/[runId]/site/[siteId]`

Click "View Detail" on any site in the rankings table to see its full analysis.

### Feature: Breadcrumb Navigation

- Shows the path: `Run [runId] / [siteId]`
- Click the run link to go back to the dashboard.

### Feature: Site Header

- **Site ID**: Large, bold identifier.
- **Severity Badge**: Color-coded with border (RED/AMBER/GREEN).
- **Metadata**: Region, site type, and estimated capacity in GB.

### Feature: Traffic Forecast Chart

A Recharts visualization showing historical traffic and the probabilistic forecast:

**What you see**:
- **Black line (Actual)**: Historical daily traffic in GB (the data the system was given).
- **Blue line (Forecast P50)**: The most likely forecast -- the median prediction.
- **Light blue shaded area (P10-P90)**: The uncertainty band. 80% of possible outcomes fall within this range.
  - **P10** (bottom of band): Optimistic scenario (only 10% chance traffic will be this low).
  - **P90** (top of band): Pessimistic scenario (only 10% chance traffic will be this high).
- **Orange dashed line (80% Cap)**: The traffic level at 80% of estimated capacity -- your risk threshold.
- **Red dashed line (90% Cap)**: The traffic level at 90% of estimated capacity -- your critical threshold.

**How to read it**:
- If the blue P50 line is above the orange 80% line, the site is likely to hit risk levels.
- If the shaded P90 area extends above the red 90% line, there is a significant chance of critical congestion.
- A wider shaded band means more uncertainty in the forecast.

### Feature: Risk Assessment Panel

Detailed risk analysis with visual gauges.

**Utilization Gauge Bars**:
- Two horizontal progress bars showing P50 and P90 peak utilization.
- Color-coded: green (safe), amber (watch), red (risk/critical).
- Vertical marker lines show the 75%, 80%, and 90% thresholds.
- The bar fills to the utilization percentage, making it immediately visual whether the site is in the danger zone.

**Capacity Context**:
- Shows the site's estimated capacity in absolute GB terms.
- Shows what 80% and 90% of capacity equals in GB.
- Example: "Capacity: 1100 GB | 80% threshold: 880 GB | 90% threshold: 990 GB"

**"In Plain Language" Card** (AI-generated):
- A colored card (red/amber/green background) with a plain-English explanation.
- **How**: Explains how the risk was determined using everyday analogies. No technical jargon.
  - Example: "We analyzed 60 days of network traffic and predicted the next 14 days. Think of the network like a highway -- at 91% capacity, it is like a highway with almost no room for more cars."
- **Why it matters**: Explains the business impact if nothing is done.
  - Example: "Customers in this area may experience slow internet, dropped video calls, and failed downloads during peak hours."
- This feature is specifically designed for presenting to non-technical stakeholders.

**Technical Details**:
- Bullet-point list of the engine's specific findings.
- Example: "p50 peak util 91.4% >= critical 90%; 14 consecutive days with p90 >= 90%"
- Each bullet has a severity-colored dot indicator.

**Risk Window**:
- Count of days where P90 utilization exceeds the risk threshold.
- "14 days where P90 utilization exceeds risk threshold"

**Affected Dates**:
- Individual date badges showing exactly which forecast dates are at risk.
- Displayed as small red pills: `2024-03-01`, `2024-03-02`, etc.

### Feature: Priority Score Breakdown

A transparent decomposition of how the site's priority score was calculated:

| Component | Value | What it measures |
|-----------|-------|-----------------|
| **Severity** | 0/30/60 | Base score from GREEN/AMBER/RED |
| **Risk Days** | 0-20 | Duration of risk (2 pts per day) |
| **Growth** | 0-10 | Is traffic trending upward? |
| **Uncertainty** | 0-10 | How wide is the P10-P90 band? |
| **Urban Bonus** | 0 or 5 | Urban sites serve more customers |

This transparency is intentional. Unlike a black-box model, any team member can understand and verify why a site received its score.

### Feature: Analyst Summary (AI-generated)

If the LLM Analyst agent was available:
- **3 bullet points** summarizing the site's health, traffic patterns, and notable observations.
- **Candidate flag**: Whether the site should be reviewed for capacity planning (Yes/No) with a rationale.

### Feature: Recommended Actions (AI-generated)

If the site is AMBER or RED and the LLM Planner agent was available:
- A list of recommended actions, each with:
  - **Action text**: Specific, actionable step from the predefined playbook.
  - **Effort**: Low / Med / High.
  - **Expected Impact**: Estimated improvement or qualitative benefit.
  - **Dependencies**: What else needs to happen first (e.g., "Budget approval").

**Important**: All actions come from a predefined playbook of safe, validated network operations. The AI cannot invent novel actions, preventing potentially harmful recommendations.

### Feature: Data Quality Panel

Bottom section showing data integrity metrics:
- **Rows**: How many data points were available for this site.
- **Missing Days**: Any gaps in the daily time series.
- **Outliers**: Number of detected anomalous traffic days.
- **Notes**: Any data warnings (e.g., "2 rows with zero/negative traffic").

---

## Workflow: Running a Complete Analysis

Here is a typical end-to-end workflow:

### Step 1: Configure

1. Open http://localhost:3000.
2. Review the default settings (14-day horizon, thresholds 75/80/90).
3. Decide on spike handling:
   - Leave "Winsorize spikes" ON for a balanced view.
   - Or turn on "Remove festival spikes" to see pure baseline.

### Step 2: Run

4. Click **Run Analysis**.
5. Wait 20-40 seconds for the pipeline to complete.
6. You are automatically redirected to the Run Dashboard.

### Step 3: Triage

7. Read the **Executive Summary** for the high-level picture.
8. Note the **severity counters** -- how many RED/AMBER/GREEN sites.
9. Look at the **top priority sites** identified by the AI.

### Step 4: Investigate

10. In the **Site Rankings Table**, click through RED sites first.
11. On each site's detail page:
    - Check the **Forecast Chart** -- is the P50 line crossing thresholds?
    - Read the **Plain Language** explanation for stakeholder context.
    - Review **Recommended Actions** for next steps.

### Step 5: Compare Scenarios

12. Go back to the Home page.
13. Change the scenario toggle (e.g., switch from Winsorize to Remove spikes).
14. Run a new analysis.
15. Compare the two runs' results to see how festival spikes affect the risk outlook.

### Step 6: Adjust Thresholds

16. If too many sites show RED, you may want to raise the risk/critical thresholds.
17. If too few, lower them for earlier warning.
18. Re-run to see how threshold changes affect the rankings.

---

## Understanding the Scoring System

The priority score (0-100) determines site ordering. Here is how to interpret ranges:

| Score Range | Interpretation | Typical Action |
|-------------|---------------|----------------|
| **80-100** | Critical -- immediate attention needed | Activate emergency protocols, deploy field team |
| **60-79** | High risk -- plan intervention | Schedule capacity review, adjust QoS |
| **30-59** | Moderate -- monitor closely | Increase monitoring frequency, set alerts |
| **0-29** | Low risk -- routine monitoring | Continue standard operations |

---

## Understanding the Forecast Chart

### The Confidence Band (P10-P90)

- **Narrow band**: The model is confident about the forecast. Low uncertainty.
- **Wide band**: High uncertainty. Could go either way.
- **Band above thresholds**: Even in optimistic scenarios, capacity pressure exists.
- **Only P90 above threshold**: Risk exists in worst-case but median is safe.

### What P10, P50, P90 Mean

Think of generating 100 possible futures:
- **P10**: The 10th best outcome. "90% of scenarios are worse than this."
- **P50**: The middle outcome. "Equally likely to be above or below this."
- **P90**: The 90th worst outcome. "Only 10% of scenarios are worse."

For capacity planning, P90 is most important -- it represents the level you need to plan for to avoid congestion 90% of the time.

---

## Troubleshooting

### "Executive summary unavailable"
- The OpenRouter API key may not be set or is invalid.
- Check `.env.local` has a valid `OPENROUTER_API_KEY`.
- The deterministic results (risk, scoring, table) still work without it.

### Analysis takes very long (>60 seconds)
- Each LLM call takes 3-8 seconds. With 5 sites and 4 agent types, that is up to 20 calls.
- Reduce the number of sites or try a smaller model via OpenRouter.

### All sites show GREEN
- The thresholds may be too high for this dataset.
- Try lowering the Watch threshold to 65% and Risk to 70%.

### Forecast chart shows no historical data
- The current version passes forecast data only to the chart.
- Historical lines will appear in a future update.

### Python forecast service not running
- The system gracefully falls back to linear extrapolation.
- You will see less accurate forecasts but the pipeline still completes.
- Start the service with `cd forecasting && uvicorn main:app --port 8000`.
