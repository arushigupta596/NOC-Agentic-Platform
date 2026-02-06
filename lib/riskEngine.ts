import { Thresholds, RiskResult, Severity, ForecastResponse } from "./schemas";

interface RiskInput {
  site_id: string;
  forecast: ForecastResponse;
  capacity_gb: number;
  thresholds: Thresholds;
}

/**
 * Convert traffic forecast to utilization percentages.
 */
function trafficToUtil(trafficArr: number[], capacity: number): number[] {
  return trafficArr.map((t) => (t / capacity) * 100);
}

/**
 * Deterministic risk engine.
 * Rules:
 * - GREEN: p90_util < watch for all days
 * - AMBER: any day p90_util >= watch but p50_util < risk for all days
 * - RED: any day p50_util >= risk, or consecutive days p90_util >= critical
 */
export function computeRisk(input: RiskInput): RiskResult {
  const { site_id, forecast, capacity_gb, thresholds } = input;
  const { watch, risk, critical } = thresholds;

  const p10Util = trafficToUtil(forecast.p10, capacity_gb);
  const p50Util = trafficToUtil(forecast.p50, capacity_gb);
  const p90Util = trafficToUtil(forecast.p90, capacity_gb);

  const riskWindows: string[] = [];
  let severity: Severity = "GREEN";
  const reasons: string[] = [];

  // Track consecutive critical days
  let consecutiveCritical = 0;
  let maxConsecutiveCritical = 0;

  for (let i = 0; i < forecast.forecast_dates.length; i++) {
    const date = forecast.forecast_dates[i];

    if (p90Util[i] >= risk) {
      riskWindows.push(date);
    }

    if (p90Util[i] >= critical) {
      consecutiveCritical++;
      maxConsecutiveCritical = Math.max(maxConsecutiveCritical, consecutiveCritical);
    } else {
      consecutiveCritical = 0;
    }
  }

  const p50PeakUtil = Math.round(Math.max(...p50Util) * 10) / 10;
  const p90PeakUtil = Math.round(Math.max(...p90Util) * 10) / 10;

  // Determine severity
  if (p50PeakUtil >= critical || maxConsecutiveCritical >= 2) {
    severity = "RED";
    if (p50PeakUtil >= critical) {
      reasons.push(`p50 peak util ${p50PeakUtil}% >= critical ${critical}%`);
    }
    if (maxConsecutiveCritical >= 2) {
      reasons.push(
        `${maxConsecutiveCritical} consecutive days with p90 >= ${critical}%`
      );
    }
  } else if (p50PeakUtil >= risk || riskWindows.length > 0) {
    severity = "RED";
    if (p50PeakUtil >= risk) {
      reasons.push(`p50 peak util ${p50PeakUtil}% >= risk ${risk}%`);
    }
    if (riskWindows.length > 0) {
      reasons.push(`p90 > ${risk}% for ${riskWindows.length} days`);
    }
  } else if (p90PeakUtil >= watch) {
    severity = "AMBER";
    reasons.push(`p90 peak util ${p90PeakUtil}% >= watch ${watch}%`);
  } else {
    reasons.push("All forecast utilization within safe thresholds");
  }

  return {
    site_id,
    severity,
    risk_windows: riskWindows,
    p50_peak_util: p50PeakUtil,
    p90_peak_util: p90PeakUtil,
    reason: reasons.join("; "),
  };
}
