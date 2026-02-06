import { SiteRow } from "./schemas";

export interface SiteStats {
  site_id: string;
  region: string;
  site_type: string;
  total_rows: number;
  avg_traffic: number;
  peak_traffic: number;
  avg_utilization: number;
  peak_utilization: number;
  volatility: number; // coefficient of variation
  avg_last_7d: number;
  avg_last_14d: number;
  avg_prev_14d: number;
  capacity_gb: number;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

/**
 * Estimate capacity_gb for a site.
 * Uses rows where 40% <= utilization <= 90% to compute
 * capacity = traffic_gb / (utilization_pct / 100), then take median.
 * Fallback: median(traffic_gb) * 1.5
 */
export function estimateCapacity(rows: SiteRow[]): number {
  const eligible = rows.filter(
    (r) => r.utilization_pct >= 40 && r.utilization_pct <= 90
  );
  if (eligible.length >= 5) {
    const estimates = eligible.map(
      (r) => r.traffic_gb / (r.utilization_pct / 100)
    );
    return Math.round(median(estimates));
  }
  // Fallback
  const trafficValues = rows.map((r) => r.traffic_gb);
  return Math.round(median(trafficValues) * 1.5);
}

/**
 * Compute per-site aggregate statistics.
 */
export function computeSiteStats(siteId: string, rows: SiteRow[]): SiteStats {
  const traffic = rows.map((r) => r.traffic_gb);
  const util = rows.map((r) => r.utilization_pct);

  const avgTraffic = mean(traffic);
  const peakTraffic = Math.max(...traffic);
  const avgUtil = mean(util);
  const peakUtil = Math.max(...util);
  const vol = avgTraffic > 0 ? stddev(traffic) / avgTraffic : 0;

  // Last 7 and 14 day averages, and previous 14 day average
  const last7 = traffic.slice(-7);
  const last14 = traffic.slice(-14);
  const prev14 = traffic.length >= 28 ? traffic.slice(-28, -14) : traffic.slice(0, Math.max(1, traffic.length - 14));

  const capacity = estimateCapacity(rows);

  return {
    site_id: siteId,
    region: rows[0]?.region ?? "unknown",
    site_type: rows[0]?.site_type ?? "unknown",
    total_rows: rows.length,
    avg_traffic: Math.round(avgTraffic * 10) / 10,
    peak_traffic: peakTraffic,
    avg_utilization: Math.round(avgUtil * 10) / 10,
    peak_utilization: peakUtil,
    volatility: Math.round(vol * 1000) / 1000,
    avg_last_7d: Math.round(mean(last7) * 10) / 10,
    avg_last_14d: Math.round(mean(last14) * 10) / 10,
    avg_prev_14d: Math.round(mean(prev14) * 10) / 10,
    capacity_gb: capacity,
  };
}
