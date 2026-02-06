"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteResult } from "@/lib/schemas";

interface SiteTableProps {
  sites: SiteResult[];
  runId: string;
}

type SortKey = "priority_score" | "severity" | "site_id" | "p90_peak_util";

const severityOrder: Record<string, number> = { RED: 0, AMBER: 1, GREEN: 2 };
const severityColors: Record<string, string> = {
  RED: "bg-red-100 text-red-800",
  AMBER: "bg-amber-100 text-amber-800",
  GREEN: "bg-green-100 text-green-800",
};

export default function SiteTable({ sites, runId }: SiteTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("priority_score");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");

  const filtered = filterSeverity === "ALL"
    ? sites
    : sites.filter((s) => s.risk.severity === filterSeverity);

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "priority_score":
        cmp = a.scoring.priority_score - b.scoring.priority_score;
        break;
      case "severity":
        cmp = severityOrder[a.risk.severity] - severityOrder[b.risk.severity];
        break;
      case "site_id":
        cmp = a.site_id.localeCompare(b.site_id);
        break;
      case "p90_peak_util":
        cmp = a.risk.p90_peak_util - b.risk.p90_peak_util;
        break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {["ALL", "RED", "AMBER", "GREEN"].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-3 py-1 rounded text-sm font-medium ${
              filterSeverity === sev
                ? "bg-gray-900 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th
                className="py-2 px-3 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("site_id")}
              >
                Site ID {sortKey === "site_id" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th className="py-2 px-3">Region</th>
              <th className="py-2 px-3">Type</th>
              <th
                className="py-2 px-3 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("severity")}
              >
                Severity {sortKey === "severity" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th
                className="py-2 px-3 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("priority_score")}
              >
                Priority {sortKey === "priority_score" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th
                className="py-2 px-3 cursor-pointer hover:text-blue-600"
                onClick={() => toggleSort("p90_peak_util")}
              >
                P90 Peak Util {sortKey === "p90_peak_util" ? (sortAsc ? "↑" : "↓") : ""}
              </th>
              <th className="py-2 px-3">Risk Days</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((site) => (
              <tr
                key={site.site_id}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="py-2 px-3 font-mono font-medium">{site.site_id}</td>
                <td className="py-2 px-3">{site.region}</td>
                <td className="py-2 px-3">{site.site_type}</td>
                <td className="py-2 px-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      severityColors[site.risk.severity]
                    }`}
                  >
                    {site.risk.severity}
                  </span>
                </td>
                <td className="py-2 px-3 font-bold">{site.scoring.priority_score}</td>
                <td className="py-2 px-3">{site.risk.p90_peak_util}%</td>
                <td className="py-2 px-3">{site.risk.risk_windows.length}</td>
                <td className="py-2 px-3">
                  <Link
                    href={`/runs/${runId}/site/${site.site_id}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    View Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
