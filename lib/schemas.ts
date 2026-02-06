import { z } from "zod";

// ---------- Input schemas ----------

export const SiteRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  site_id: z.string(),
  region: z.string(),
  site_type: z.enum(["urban", "semi_urban", "rural"]),
  traffic_gb: z.number(),
  utilization_pct: z.number().min(0).max(100),
});
export type SiteRow = z.infer<typeof SiteRowSchema>;

export const ThresholdsSchema = z.object({
  watch: z.number().min(50).max(100).default(75),
  risk: z.number().min(50).max(100).default(80),
  critical: z.number().min(80).max(100).default(90),
});
export type Thresholds = z.infer<typeof ThresholdsSchema>;

export const ScenarioSchema = z
  .object({
    removeFestivalSpikes: z.boolean().default(false),
    winsorizeSpikes: z.boolean().default(true),
  })
  .partial();
export type Scenario = z.infer<typeof ScenarioSchema>;

export const AnalyzeRequestSchema = z.object({
  dataset: z.string(),
  horizonDays: z.number().int().min(7).max(90).default(14),
  samples: z.number().int().min(5).max(100).default(20),
  thresholds: ThresholdsSchema.default({ watch: 75, risk: 80, critical: 90 }),
  scenario: ScenarioSchema.default({}),  // partial object, {} is valid
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

// ---------- Forecast schemas ----------

export const ForecastRequestSchema = z.object({
  site_id: z.string(),
  dates: z.array(z.string()),
  traffic_gb: z.array(z.number()),
  horizon: z.number().int().min(1).max(90),
  samples: z.number().int().min(1).max(100),
});
export type ForecastRequest = z.infer<typeof ForecastRequestSchema>;

export const ForecastResponseSchema = z.object({
  site_id: z.string(),
  forecast_dates: z.array(z.string()),
  p10: z.array(z.number()),
  p50: z.array(z.number()),
  p90: z.array(z.number()),
  samples: z.array(z.array(z.number())).optional(),
});
export type ForecastResponse = z.infer<typeof ForecastResponseSchema>;

// ---------- Data quality ----------

export const OutlierSchema = z.object({
  date: z.string(),
  traffic_gb: z.number(),
  reason: z.string(),
});

export const DataQualityReportSchema = z.object({
  site_id: z.string(),
  rows: z.number(),
  missing_days: z.number(),
  outliers: z.array(OutlierSchema),
  notes: z.array(z.string()),
});
export type DataQualityReport = z.infer<typeof DataQualityReportSchema>;

// ---------- Risk ----------

export type Severity = "GREEN" | "AMBER" | "RED";

export const RiskResultSchema = z.object({
  site_id: z.string(),
  severity: z.enum(["GREEN", "AMBER", "RED"]),
  risk_windows: z.array(z.string()),
  p50_peak_util: z.number(),
  p90_peak_util: z.number(),
  reason: z.string(),
  risk_explanation: z.string().optional(),
});
export type RiskResult = z.infer<typeof RiskResultSchema>;

export const RiskExplanationSchema = z.object({
  how: z.string(),
  why: z.string(),
});
export type RiskExplanation = z.infer<typeof RiskExplanationSchema>;

// ---------- Scoring ----------

export const ScoringComponentsSchema = z.object({
  severityScore: z.number(),
  riskDaysScore: z.number(),
  growthScore: z.number(),
  uncertaintyScore: z.number(),
  urbanBonus: z.number(),
});

export const ScoringResultSchema = z.object({
  site_id: z.string(),
  priority_score: z.number(),
  components: ScoringComponentsSchema,
});
export type ScoringResult = z.infer<typeof ScoringResultSchema>;

// ---------- LLM output schemas ----------

export const AnalystOutputSchema = z.object({
  site_id: z.string(),
  summary: z.array(z.string()).min(1).max(5),
  candidate: z.boolean(),
  candidate_reason: z.string(),
});
export type AnalystOutput = z.infer<typeof AnalystOutputSchema>;

export const ActionSchema = z.object({
  action: z.string(),
  effort: z.enum(["low", "med", "high"]),
  expected_impact: z.string(),
  dependencies: z.array(z.string()),
});

export const PlannerOutputSchema = z.object({
  site_id: z.string(),
  actions: z.array(ActionSchema),
});
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

export const TopSiteSchema = z.object({
  site_id: z.string(),
  why: z.string(),
});

export const EvaluatorOutputSchema = z.object({
  exec_bullets: z.array(z.string()).min(1).max(5),
  top_sites: z.array(TopSiteSchema),
  confidence: z.enum(["high", "medium", "low"]),
});
export type EvaluatorOutput = z.infer<typeof EvaluatorOutputSchema>;

// ---------- Run result ----------

export const SiteResultSchema = z.object({
  site_id: z.string(),
  region: z.string(),
  site_type: z.string(),
  capacity_gb: z.number(),
  data_quality: DataQualityReportSchema,
  forecast: ForecastResponseSchema,
  risk: RiskResultSchema,
  scoring: ScoringResultSchema,
  analyst: AnalystOutputSchema.optional(),
  planner: PlannerOutputSchema.optional(),
});
export type SiteResult = z.infer<typeof SiteResultSchema>;

export const RunResultSchema = z.object({
  runId: z.string(),
  status: z.enum(["running", "done", "error"]),
  params: AnalyzeRequestSchema,
  createdAt: z.string(),
  completedAt: z.string().optional(),
  sites: z.array(SiteResultSchema).optional(),
  evaluator: EvaluatorOutputSchema.optional(),
  error: z.string().optional(),
});
export type RunResult = z.infer<typeof RunResultSchema>;
