import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { AnalyzeRequestSchema, RunResult, SiteResult, AnalystOutputSchema, PlannerOutputSchema, EvaluatorOutputSchema, RiskExplanationSchema } from "@/lib/schemas";
import { loadCSV, groupBySite, generateQualityReport, applyScenario } from "@/lib/dataLoader";
import { computeSiteStats } from "@/lib/stats";
import { computeRisk } from "@/lib/riskEngine";
import { computeScore } from "@/lib/scoring";
import { callWithSchema, loadPrompt } from "@/lib/openrouter";
import { fetchForecast } from "@/forecasting-client/llmtimeClient";
import { saveRun } from "@/lib/storage";

export const maxDuration = 120; // Allow up to 2 minutes for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = AnalyzeRequestSchema.parse(body);
    const runId = uuidv4();

    // Initialize run
    const run: RunResult = {
      runId,
      status: "running",
      params,
      createdAt: new Date().toISOString(),
      sites: [],
    };
    saveRun(run);

    // Load and group data
    const rows = loadCSV(params.dataset);
    if (rows.length === 0) {
      throw new Error(`No valid rows found in dataset: ${params.dataset}`);
    }
    const siteGroups = groupBySite(rows);

    // Load prompts
    const analystPrompt = loadPrompt("analyst.system.txt");
    const plannerPrompt = loadPrompt("planner.system.txt");
    const riskExplainerPrompt = loadPrompt("risk-explainer.system.txt");

    const siteResults: SiteResult[] = [];

    // Process each site
    for (const [siteId, siteRows] of siteGroups) {
      // Data quality
      const qualityReport = generateQualityReport(siteId, siteRows);

      // Apply scenario
      const processedRows = applyScenario(siteRows, qualityReport, params.scenario ?? {});

      // Stats
      const stats = computeSiteStats(siteId, processedRows);

      // Call forecast service
      let forecast;
      try {
        forecast = await fetchForecast({
          site_id: siteId,
          dates: processedRows.map((r) => r.date),
          traffic_gb: processedRows.map((r) => r.traffic_gb),
          horizon: params.horizonDays,
          samples: params.samples,
        });
      } catch (forecastError) {
        // Fallback: create a simple linear extrapolation
        const lastTraffic = processedRows[processedRows.length - 1]?.traffic_gb ?? 0;
        const trend = stats.avg_last_7d - stats.avg_prev_14d;
        const forecastDates: string[] = [];
        const p10: number[] = [];
        const p50: number[] = [];
        const p90: number[] = [];
        const lastDate = new Date(processedRows[processedRows.length - 1]?.date ?? "2024-01-01");
        for (let i = 0; i < params.horizonDays; i++) {
          const d = new Date(lastDate.getTime() + (i + 1) * 86400000);
          forecastDates.push(d.toISOString().split("T")[0]);
          const base = lastTraffic + trend * (i / 7);
          p50.push(Math.round(base));
          p10.push(Math.round(base * 0.9));
          p90.push(Math.round(base * 1.15));
        }
        forecast = { site_id: siteId, forecast_dates: forecastDates, p10, p50, p90 };
      }

      // Risk
      const risk = computeRisk({
        site_id: siteId,
        forecast,
        capacity_gb: stats.capacity_gb,
        thresholds: params.thresholds,
      });

      // Scoring
      const scoring = computeScore(risk, stats, forecast, params.thresholds);

      // LLM Analyst (best effort)
      let analyst;
      try {
        const analystInput = JSON.stringify({
          site_id: siteId,
          region: stats.region,
          site_type: stats.site_type,
          recent_stats: {
            avg_7d: stats.avg_last_7d,
            peak_7d: stats.peak_traffic,
            avg_utilization: stats.avg_utilization,
            peak_utilization: stats.peak_utilization,
            volatility: stats.volatility,
          },
          recent_outliers: qualityReport.outliers,
          capacity_gb: stats.capacity_gb,
          last_observed_utilization_pct: siteRows[siteRows.length - 1]?.utilization_pct ?? 0,
        });
        analyst = await callWithSchema(analystPrompt, analystInput, AnalystOutputSchema);
      } catch {
        // LLM unavailable — skip analyst
      }

      // LLM Planner (for AMBER/RED sites)
      let planner;
      if (risk.severity !== "GREEN") {
        try {
          const plannerInput = JSON.stringify({
            site_id: siteId,
            severity: risk.severity,
            risk_windows: risk.risk_windows,
            site_type: stats.site_type,
            region: stats.region,
            data_quality_notes: qualityReport.notes,
            capacity_gb: stats.capacity_gb,
            p50_peak_util: risk.p50_peak_util,
            p90_peak_util: risk.p90_peak_util,
          });
          planner = await callWithSchema(plannerPrompt, plannerInput, PlannerOutputSchema);
        } catch {
          // LLM unavailable — skip planner
        }
      }

      // LLM Risk Explainer — plain-language how & why
      try {
        const explainerInput = JSON.stringify({
          site_id: siteId,
          region: stats.region,
          site_type: stats.site_type,
          severity: risk.severity,
          p50_peak_util: risk.p50_peak_util,
          p90_peak_util: risk.p90_peak_util,
          risk_windows: risk.risk_windows.length,
          reason: risk.reason,
          capacity_gb: stats.capacity_gb,
        });
        const explanation = await callWithSchema(riskExplainerPrompt, explainerInput, RiskExplanationSchema);
        risk.risk_explanation = `**How:** ${explanation.how}\n\n**Why it matters:** ${explanation.why}`;
      } catch {
        // LLM unavailable — skip explanation
      }

      siteResults.push({
        site_id: siteId,
        region: stats.region,
        site_type: stats.site_type,
        capacity_gb: stats.capacity_gb,
        data_quality: qualityReport,
        forecast,
        risk,
        scoring,
        analyst,
        planner,
      });
    }

    // Sort by priority score descending
    siteResults.sort((a, b) => b.scoring.priority_score - a.scoring.priority_score);

    // LLM Evaluator — exec summary
    let evaluator;
    try {
      const evaluatorPrompt = loadPrompt("evaluator.system.txt");
      const redCount = siteResults.filter((s) => s.risk.severity === "RED").length;
      const amberCount = siteResults.filter((s) => s.risk.severity === "AMBER").length;
      const greenCount = siteResults.filter((s) => s.risk.severity === "GREEN").length;

      const evalInput = JSON.stringify({
        run_summary: {
          total_sites: siteResults.length,
          red_count: redCount,
          amber_count: amberCount,
          green_count: greenCount,
        },
        top_sites: siteResults.slice(0, 5).map((s) => ({
          site_id: s.site_id,
          region: s.region,
          site_type: s.site_type,
          priority_score: s.scoring.priority_score,
          severity: s.risk.severity,
          p50_peak_util: s.risk.p50_peak_util,
          p90_peak_util: s.risk.p90_peak_util,
          risk_window_count: s.risk.risk_windows.length,
        })),
        data_quality_overview: {
          sites_with_outliers: siteResults.filter((s) => s.data_quality.outliers.length > 0).length,
          sites_with_missing_data: siteResults.filter((s) => s.data_quality.missing_days > 0).length,
        },
      });
      evaluator = await callWithSchema(evaluatorPrompt, evalInput, EvaluatorOutputSchema);
    } catch {
      // LLM unavailable — skip evaluator
    }

    // Save final result
    const finalRun: RunResult = {
      ...run,
      status: "done",
      completedAt: new Date().toISOString(),
      sites: siteResults,
      evaluator,
    };
    saveRun(finalRun);

    return NextResponse.json({ runId, status: "done" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
