"use client";

import { EvaluatorOutput } from "@/lib/schemas";

interface ExecSummaryProps {
  evaluator?: EvaluatorOutput;
  totalSites: number;
  redCount: number;
  amberCount: number;
  greenCount: number;
}

export default function ExecSummary({
  evaluator,
  totalSites,
  redCount,
  amberCount,
  greenCount,
}: ExecSummaryProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-bold mb-4">Executive Summary</h2>

      {/* Severity counters */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm font-medium">
            {redCount} RED
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-sm font-medium">
            {amberCount} AMBER
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm font-medium">
            {greenCount} GREEN
          </span>
        </div>
        <div className="text-sm text-gray-500 ml-2">
          {totalSites} sites total
        </div>
      </div>

      {evaluator ? (
        <>
          {/* Bullets */}
          <ul className="list-disc list-inside space-y-2 mb-4">
            {evaluator.exec_bullets.map((bullet, i) => (
              <li key={i} className="text-sm text-gray-700">
                {bullet}
              </li>
            ))}
          </ul>

          {/* Top sites */}
          {evaluator.top_sites.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">Top Priority Sites</h3>
              <div className="space-y-1">
                {evaluator.top_sites.map((site, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-mono font-medium">{site.site_id}</span>
                    <span className="text-gray-500 ml-2">— {site.why}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confidence */}
          <div className="text-xs text-gray-400">
            Confidence: {evaluator.confidence}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500 italic">
          Executive summary unavailable (LLM not configured or call failed).
          Review the site table below for deterministic risk and scoring results.
        </p>
      )}
    </div>
  );
}
