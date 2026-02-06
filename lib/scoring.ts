import { RiskResult, Severity, ScoringResult, ForecastResponse, Thresholds } from "./schemas";
import { SiteStats } from "./stats";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function severityScore(sev: Severity): number {
  switch (sev) {
    case "GREEN":
      return 0;
    case "AMBER":
      return 30;
    case "RED":
      return 60;
  }
}

/**
 * Compute priority score for a site.
 *
 * Formula:
 * - SeverityScore: GREEN=0, AMBER=30, RED=60
 * - RiskDaysScore: 2 * riskDays, capped at 20
 * - GrowthScore: clamp((avg_last14 - avg_prev14) / avg_prev14 * 100, 0, 10)
 * - UncertaintyScore: clamp(avg((p90 - p10) / p50) * 100, 0, 10)
 * - UrbanBonus: +5 if site_type == 'urban'
 * - Total: sum of above, max 100
 */
export function computeScore(
  risk: RiskResult,
  stats: SiteStats,
  forecast: ForecastResponse,
  thresholds: Thresholds
): ScoringResult {
  const sevScore = severityScore(risk.severity);

  // Risk days score
  const riskDays = risk.risk_windows.length;
  const riskDaysScore = clamp(2 * riskDays, 0, 20);

  // Growth score
  const growthPct =
    stats.avg_prev_14d > 0
      ? ((stats.avg_last_14d - stats.avg_prev_14d) / stats.avg_prev_14d) * 100
      : 0;
  const growthScore = clamp(growthPct, 0, 10);

  // Uncertainty score
  let uncertaintySum = 0;
  let count = 0;
  for (let i = 0; i < forecast.p50.length; i++) {
    if (forecast.p50[i] > 0) {
      uncertaintySum += (forecast.p90[i] - forecast.p10[i]) / forecast.p50[i];
      count++;
    }
  }
  const avgUncertainty = count > 0 ? uncertaintySum / count : 0;
  const uncertaintyScore = clamp(avgUncertainty * 100, 0, 10);

  // Urban bonus
  const urbanBonus = stats.site_type === "urban" ? 5 : 0;

  const total = clamp(
    Math.round(sevScore + riskDaysScore + growthScore + uncertaintyScore + urbanBonus),
    0,
    100
  );

  return {
    site_id: risk.site_id,
    priority_score: total,
    components: {
      severityScore: sevScore,
      riskDaysScore,
      growthScore: Math.round(growthScore * 10) / 10,
      uncertaintyScore: Math.round(uncertaintyScore * 10) / 10,
      urbanBonus,
    },
  };
}
