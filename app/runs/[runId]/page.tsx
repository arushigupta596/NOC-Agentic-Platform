"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RunResult } from "@/lib/schemas";
import SiteTable from "@/app/components/SiteTable";
import ExecSummary from "@/app/components/ExecSummary";

export default function RunDashboard() {
  const params = useParams();
  const runId = params.runId as string;
  const [run, setRun] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRun() {
      try {
        const res = await fetch(`/api/run/${runId}`);
        if (!res.ok) throw new Error("Failed to fetch run");
        const data = await res.json();
        setRun(data);

        // Poll if still running
        if (data.status === "running") {
          setTimeout(fetchRun, 3000);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchRun();
  }, [runId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading run results...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
        {error}
      </div>
    );
  }

  if (!run) return null;

  const sites = run.sites ?? [];
  const redCount = sites.filter((s) => s.risk.severity === "RED").length;
  const amberCount = sites.filter((s) => s.risk.severity === "AMBER").length;
  const greenCount = sites.filter((s) => s.risk.severity === "GREEN").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold">Run: {runId.slice(0, 8)}...</h2>
          <p className="text-sm text-gray-500">
            Status: {run.status} | Created: {new Date(run.createdAt).toLocaleString()}
            {run.completedAt && ` | Completed: ${new Date(run.completedAt).toLocaleString()}`}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${
            run.status === "done"
              ? "bg-green-100 text-green-800"
              : run.status === "error"
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {run.status.toUpperCase()}
        </span>
      </div>

      {run.status === "running" && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
          Analysis is running. This page will auto-refresh...
        </div>
      )}

      {run.status === "done" && (
        <>
          <ExecSummary
            evaluator={run.evaluator}
            totalSites={sites.length}
            redCount={redCount}
            amberCount={amberCount}
            greenCount={greenCount}
          />
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-md font-semibold mb-4">Site Rankings</h3>
            <SiteTable sites={sites} runId={runId} />
          </div>
        </>
      )}

      {run.status === "error" && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700">
          Run failed: {run.error}
        </div>
      )}
    </div>
  );
}
