"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SiteResult } from "@/lib/schemas";
import ForecastChart from "@/app/components/ForecastChart";
import { useRunContext } from "@/app/context/RunContext";

export default function SiteDetail() {
  const params = useParams();
  const runId = params.runId as string;
  const siteId = params.siteId as string;
  const { loadSite } = useRunContext();
  const [site, setSite] = useState<SiteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try sessionStorage first
    const cached = loadSite(runId, siteId);
    if (cached) {
      setSite(cached);
      setLoading(false);
      return;
    }

    // Fallback: try the API
    async function fetchSite() {
      try {
        const res = await fetch(`/api/site/${runId}/${siteId}`);
        if (!res.ok) throw new Error("Site not found. Please run a new analysis from the home page.");
        const data = await res.json();
        setSite(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchSite();
  }, [runId, siteId, loadSite]);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading site details...</div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>;
  if (!site) return null;

  const severityColors: Record<string, string> = {
    RED: "bg-red-100 text-red-800 border-red-200",
    AMBER: "bg-amber-100 text-amber-800 border-amber-200",
    GREEN: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-gray-500">
        <Link href={`/runs/${runId}`} className="text-blue-600 hover:underline">
          Run {runId.slice(0, 8)}...
        </Link>
        {" / "}
        <span className="text-gray-700 font-medium">{siteId}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-xl font-bold">{site.site_id}</h2>
        <span
          className={`px-3 py-1 rounded text-sm font-semibold border ${
            severityColors[site.risk.severity]
          }`}
        >
          {site.risk.severity}
        </span>
        <span className="text-sm text-gray-500">
          {site.region} | {site.site_type} | Capacity: {site.capacity_gb} GB
        </span>
      </div>

      {/* Forecast Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-md font-semibold mb-4">Traffic Forecast</h3>
        <ForecastChart
          history={[]}
          forecast={site.forecast}
          capacityGb={site.capacity_gb}
        />
      </div>

      {/* Risk & Scoring */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-md font-semibold mb-3">Risk Assessment</h3>
          <div className="space-y-3 text-sm">
            {/* Utilization gauges */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium">P50 Peak Utilization</span>
                  <span className="font-mono font-medium">{site.risk.p50_peak_util}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 relative">
                  <div
                    className={`h-3 rounded-full ${
                      site.risk.p50_peak_util >= 90 ? "bg-red-500" :
                      site.risk.p50_peak_util >= 80 ? "bg-amber-500" : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(site.risk.p50_peak_util, 100)}%` }}
                  />
                  {/* Threshold markers */}
                  <div className="absolute top-0 h-3 border-l-2 border-amber-600" style={{ left: "75%" }} title="Watch 75%" />
                  <div className="absolute top-0 h-3 border-l-2 border-orange-600" style={{ left: "80%" }} title="Risk 80%" />
                  <div className="absolute top-0 h-3 border-l-2 border-red-800" style={{ left: "90%" }} title="Critical 90%" />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium">P90 Peak Utilization</span>
                  <span className="font-mono font-medium">{site.risk.p90_peak_util}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 relative">
                  <div
                    className={`h-3 rounded-full ${
                      site.risk.p90_peak_util >= 90 ? "bg-red-500" :
                      site.risk.p90_peak_util >= 80 ? "bg-amber-500" : "bg-green-500"
                    }`}
                    style={{ width: `${Math.min(site.risk.p90_peak_util, 100)}%` }}
                  />
                  <div className="absolute top-0 h-3 border-l-2 border-amber-600" style={{ left: "75%" }} title="Watch 75%" />
                  <div className="absolute top-0 h-3 border-l-2 border-orange-600" style={{ left: "80%" }} title="Risk 80%" />
                  <div className="absolute top-0 h-3 border-l-2 border-red-800" style={{ left: "90%" }} title="Critical 90%" />
                </div>
              </div>
              <div className="flex gap-4 text-xs text-gray-400 mt-1">
                <span><span className="inline-block w-2 h-2 border-l-2 border-amber-600 mr-1" />Watch 75%</span>
                <span><span className="inline-block w-2 h-2 border-l-2 border-orange-600 mr-1" />Risk 80%</span>
                <span><span className="inline-block w-2 h-2 border-l-2 border-red-800 mr-1" />Critical 90%</span>
              </div>
            </div>

            {/* Capacity context */}
            <div className="bg-gray-50 rounded p-3">
              <span className="font-medium">Capacity:</span> {site.capacity_gb} GB
              <span className="text-gray-400 mx-2">|</span>
              <span className="font-medium">80% threshold:</span> {Math.round(site.capacity_gb * 0.8)} GB
              <span className="text-gray-400 mx-2">|</span>
              <span className="font-medium">90% threshold:</span> {Math.round(site.capacity_gb * 0.9)} GB
            </div>

            {/* Plain-language explanation */}
            {site.risk.risk_explanation && (
              <div className={`rounded-lg p-4 ${
                site.risk.severity === "RED" ? "bg-red-50 border border-red-100" :
                site.risk.severity === "AMBER" ? "bg-amber-50 border border-amber-100" :
                "bg-green-50 border border-green-100"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">
                    {site.risk.severity === "RED" ? "🔴" : site.risk.severity === "AMBER" ? "🟡" : "🟢"}
                  </span>
                  <span className="font-semibold text-sm">In Plain Language</span>
                </div>
                <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
                  {site.risk.risk_explanation.split("\n\n").map((paragraph, i) => (
                    <p key={i}>
                      {paragraph.startsWith("**") ? (
                        <>
                          <span className="font-semibold">{paragraph.match(/\*\*(.*?)\*\*/)?.[1]}</span>
                          {paragraph.replace(/\*\*.*?\*\*/, "")}
                        </>
                      ) : paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Technical details */}
            <div>
              <span className="font-medium">Technical Details:</span>
              <ul className="mt-1 space-y-1 list-none">
                {site.risk.reason.split("; ").map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${
                      site.risk.severity === "RED" ? "bg-red-500" :
                      site.risk.severity === "AMBER" ? "bg-amber-500" : "bg-green-500"
                    }`} />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Risk days */}
            <div>
              <span className="font-medium">Risk Window:</span>{" "}
              <span className="text-gray-600">{site.risk.risk_windows.length} days where P90 utilization exceeds risk threshold</span>
            </div>

            {site.risk.risk_windows.length > 0 && (
              <div>
                <span className="font-medium">Affected Dates:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {site.risk.risk_windows.map((d) => (
                    <span key={d} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs font-mono">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-md font-semibold mb-3">Priority Score: {site.scoring.priority_score}</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Severity</span>
              <span className="font-mono">{site.scoring.components.severityScore}</span>
            </div>
            <div className="flex justify-between">
              <span>Risk Days</span>
              <span className="font-mono">{site.scoring.components.riskDaysScore}</span>
            </div>
            <div className="flex justify-between">
              <span>Growth</span>
              <span className="font-mono">{site.scoring.components.growthScore}</span>
            </div>
            <div className="flex justify-between">
              <span>Uncertainty</span>
              <span className="font-mono">{site.scoring.components.uncertaintyScore}</span>
            </div>
            <div className="flex justify-between">
              <span>Urban Bonus</span>
              <span className="font-mono">{site.scoring.components.urbanBonus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analyst Summary */}
      {site.analyst && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-md font-semibold mb-3">Analyst Summary</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {site.analyst.summary.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
          <div className="mt-3 text-sm">
            <span className="font-medium">Candidate:</span>{" "}
            {site.analyst.candidate ? "Yes" : "No"} — {site.analyst.candidate_reason}
          </div>
        </div>
      )}

      {/* Planner Actions */}
      {site.planner && site.planner.actions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-md font-semibold mb-3">Recommended Actions</h3>
          <div className="space-y-3">
            {site.planner.actions.map((action, i) => (
              <div key={i} className="border border-gray-100 rounded p-3">
                <div className="text-sm font-medium">{action.action}</div>
                <div className="flex gap-4 mt-1 text-xs text-gray-500">
                  <span>Effort: {action.effort}</span>
                  <span>Impact: {action.expected_impact}</span>
                  {action.dependencies.length > 0 && (
                    <span>Deps: {action.dependencies.join(", ")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Quality */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-md font-semibold mb-3">Data Quality</h3>
        <div className="space-y-1 text-sm">
          <div><span className="font-medium">Rows:</span> {site.data_quality.rows}</div>
          <div><span className="font-medium">Missing Days:</span> {site.data_quality.missing_days}</div>
          <div><span className="font-medium">Outliers:</span> {site.data_quality.outliers.length}</div>
          {site.data_quality.notes.length > 0 && (
            <div className="mt-1 text-gray-500">
              Notes: {site.data_quality.notes.join("; ")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
