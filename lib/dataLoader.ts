import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { SiteRow, SiteRowSchema, DataQualityReport, Scenario } from "./schemas";

/**
 * Load and parse CSV from the data/ directory.
 */
export function loadCSV(filename: string): SiteRow[] {
  const filePath = path.join(process.cwd(), "data", filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });

  const rows: SiteRow[] = [];
  for (const row of parsed.data as Record<string, string>[]) {
    const cleaned = {
      date: row.date?.trim(),
      site_id: row.site_id?.trim(),
      region: row.region?.trim(),
      site_type: row.site_type?.trim(),
      traffic_gb: parseFloat(row.traffic_gb),
      utilization_pct: parseFloat(row.utilization_pct),
    };
    const result = SiteRowSchema.safeParse(cleaned);
    if (result.success) {
      rows.push(result.data);
    }
  }
  return rows;
}

/**
 * Group rows by site_id.
 */
export function groupBySite(rows: SiteRow[]): Map<string, SiteRow[]> {
  const map = new Map<string, SiteRow[]>();
  for (const row of rows) {
    const existing = map.get(row.site_id) || [];
    existing.push(row);
    map.set(row.site_id, existing);
  }
  // Sort each site's rows by date
  for (const [, siteRows] of map) {
    siteRows.sort((a, b) => a.date.localeCompare(b.date));
  }
  return map;
}

/**
 * Compute z-scores for traffic_gb within a site.
 */
function zScores(values: number[]): number[] {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const std = Math.sqrt(
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  );
  if (std === 0) return values.map(() => 0);
  return values.map((v) => Math.abs((v - mean) / std));
}

/**
 * Generate data quality report for a site.
 */
export function generateQualityReport(
  siteId: string,
  rows: SiteRow[]
): DataQualityReport {
  const outliers: DataQualityReport["outliers"] = [];
  const notes: string[] = [];

  // Check for missing dates
  const dates = rows.map((r) => r.date);
  const dateSet = new Set(dates);
  let missingDays = 0;
  if (dates.length >= 2) {
    const start = new Date(dates[0]);
    const end = new Date(dates[dates.length - 1]);
    const dayMs = 86400000;
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + dayMs)) {
      const iso = d.toISOString().split("T")[0];
      if (!dateSet.has(iso)) missingDays++;
    }
  }

  // Detect outliers via z-score > 3
  const traffic = rows.map((r) => r.traffic_gb);
  const zs = zScores(traffic);
  for (let i = 0; i < rows.length; i++) {
    if (zs[i] > 3) {
      outliers.push({
        date: rows[i].date,
        traffic_gb: rows[i].traffic_gb,
        reason: `zscore=${zs[i].toFixed(1)}`,
      });
    }
  }

  // Check for negative/zero traffic
  const invalidRows = rows.filter((r) => r.traffic_gb <= 0);
  if (invalidRows.length > 0) {
    notes.push(`${invalidRows.length} rows with zero/negative traffic`);
  }

  return { site_id: siteId, rows: rows.length, missing_days: missingDays, outliers, notes };
}

/**
 * Apply scenario modifications (remove/winsorize festival spikes).
 */
export function applyScenario(
  rows: SiteRow[],
  qualityReport: DataQualityReport,
  scenario: Scenario
): SiteRow[] {
  const outlierDates = new Set(qualityReport.outliers.map((o) => o.date));

  if (scenario.removeFestivalSpikes) {
    return rows.filter((r) => !outlierDates.has(r.date));
  }

  if (scenario.winsorizeSpikes) {
    // Winsorize: cap outliers at the 95th percentile
    const traffic = rows.map((r) => r.traffic_gb).sort((a, b) => a - b);
    const p95 = traffic[Math.floor(traffic.length * 0.95)];
    return rows.map((r) => {
      if (outlierDates.has(r.date) && r.traffic_gb > p95) {
        return { ...r, traffic_gb: p95 };
      }
      return r;
    });
  }

  return rows;
}
