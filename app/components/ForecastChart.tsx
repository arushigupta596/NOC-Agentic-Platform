"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { ForecastResponse } from "@/lib/schemas";
import { SiteRow } from "@/lib/schemas";

interface ForecastChartProps {
  history: SiteRow[];
  forecast: ForecastResponse;
  capacityGb: number;
}

export default function ForecastChart({
  history,
  forecast,
  capacityGb,
}: ForecastChartProps) {
  // Build chart data: history + forecast
  const historyData = history.map((row) => ({
    date: row.date,
    actual: row.traffic_gb,
    p10: null as number | null,
    p50: null as number | null,
    p90: null as number | null,
  }));

  const forecastData = forecast.forecast_dates.map((date, i) => ({
    date,
    actual: null as number | null,
    p10: forecast.p10[i],
    p50: forecast.p50[i],
    p90: forecast.p90[i],
  }));

  const chartData = [...historyData, ...forecastData];

  // Capacity line thresholds
  const cap80 = Math.round(capacityGb * 0.8);
  const cap90 = Math.round(capacityGb * 0.9);

  return (
    <div className="w-full h-96">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(val: string) => val.slice(5)} // MM-DD
          />
          <YAxis tick={{ fontSize: 11 }} label={{ value: "Traffic (GB)", angle: -90, position: "insideLeft" }} />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend />

          {/* P10-P90 band */}
          <Area
            type="monotone"
            dataKey="p90"
            stackId="band"
            stroke="none"
            fill="#3b82f6"
            fillOpacity={0.15}
            name="P90"
            connectNulls={false}
          />
          <Area
            type="monotone"
            dataKey="p10"
            stackId="band"
            stroke="none"
            fill="#ffffff"
            fillOpacity={1}
            name="P10"
            connectNulls={false}
          />

          {/* Forecast median */}
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Forecast (P50)"
            connectNulls={false}
          />

          {/* Historical actual */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#111827"
            strokeWidth={2}
            dot={false}
            name="Actual"
            connectNulls={false}
          />

          {/* Capacity thresholds */}
          <ReferenceLine
            y={cap80}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            label={{ value: "80% Cap", position: "right", fontSize: 10 }}
          />
          <ReferenceLine
            y={cap90}
            stroke="#ef4444"
            strokeDasharray="5 5"
            label={{ value: "90% Cap", position: "right", fontSize: 10 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
