"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useRunContext } from "@/app/context/RunContext";

export default function HomePage() {
  const router = useRouter();
  const { saveRun } = useRunContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [dataset] = useState("telecom_noc_multi_site_with_festival_spikes.csv");
  const [horizonDays, setHorizonDays] = useState(14);
  const [samples, setSamples] = useState(20);
  const [watchThreshold, setWatchThreshold] = useState(75);
  const [riskThreshold, setRiskThreshold] = useState(80);
  const [criticalThreshold, setCriticalThreshold] = useState(90);
  const [removeFestivalSpikes, setRemoveFestivalSpikes] = useState(false);
  const [winsorizeSpikes, setWinsorizeSpikes] = useState(true);

  async function handleRun() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          horizonDays,
          samples,
          thresholds: {
            watch: watchThreshold,
            risk: riskThreshold,
            critical: criticalThreshold,
          },
          scenario: {
            removeFestivalSpikes,
            winsorizeSpikes,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");

      // Save full run result to sessionStorage so dashboard/site pages can read it
      saveRun(data);
      router.push(`/runs/${data.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-bold mb-6">Run Capacity Analysis</h2>

        {/* Dataset */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dataset
          </label>
          <input
            type="text"
            value={dataset}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
          />
        </div>

        {/* Horizon & Samples */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forecast Horizon (days)
            </label>
            <input
              type="number"
              min={7}
              max={90}
              value={horizonDays}
              onChange={(e) => setHorizonDays(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Forecast Samples
            </label>
            <input
              type="number"
              min={5}
              max={100}
              value={samples}
              onChange={(e) => setSamples(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>

        {/* Thresholds */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Utilization Thresholds (%)
          </label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-xs text-amber-600 font-medium">Watch</span>
              <input
                type="number"
                min={50}
                max={100}
                value={watchThreshold}
                onChange={(e) => setWatchThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <span className="text-xs text-orange-600 font-medium">Risk</span>
              <input
                type="number"
                min={50}
                max={100}
                value={riskThreshold}
                onChange={(e) => setRiskThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <span className="text-xs text-red-600 font-medium">Critical</span>
              <input
                type="number"
                min={80}
                max={100}
                value={criticalThreshold}
                onChange={(e) => setCriticalThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* Scenario toggles */}
        <div className="mb-6 space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scenario Options
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeFestivalSpikes}
              onChange={(e) => {
                setRemoveFestivalSpikes(e.target.checked);
                if (e.target.checked) setWinsorizeSpikes(false);
              }}
            />
            Remove festival spikes entirely
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={winsorizeSpikes}
              onChange={(e) => {
                setWinsorizeSpikes(e.target.checked);
                if (e.target.checked) setRemoveFestivalSpikes(false);
              }}
            />
            Winsorize spikes (cap at 95th percentile)
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Run button */}
        <button
          onClick={handleRun}
          disabled={loading}
          className="w-full py-3 bg-gray-900 text-white rounded font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Running Analysis..." : "Run Analysis"}
        </button>
      </div>
    </div>
  );
}
