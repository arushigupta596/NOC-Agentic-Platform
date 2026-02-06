import { ForecastRequest, ForecastResponse, ForecastResponseSchema } from "@/lib/schemas";

/**
 * Client to call the Python FastAPI forecasting service.
 */
export async function fetchForecast(
  request: ForecastRequest
): Promise<ForecastResponse> {
  const baseUrl = process.env.FORECAST_SERVICE_URL || "http://localhost:8000";
  const apiKey = process.env.FORECAST_API_KEY || "";

  const res = await fetch(`${baseUrl}/forecast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Forecast service error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return ForecastResponseSchema.parse(data);
}
