import fs from "fs";
import path from "path";
import { RunResult } from "./schemas";

// On Vercel, process.cwd() points to /var/task which is read-only.
// Use /tmp for serverless environments; fall back to local outputs/ for dev.
const isVercel = !!process.env.VERCEL;
const OUTPUTS_DIR = isVercel
  ? path.join("/tmp", "outputs")
  : path.join(process.cwd(), "outputs");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save a run result to the local filesystem.
 */
export function saveRun(run: RunResult): void {
  const runDir = path.join(OUTPUTS_DIR, run.runId);
  ensureDir(runDir);
  fs.writeFileSync(
    path.join(runDir, "run.json"),
    JSON.stringify(run, null, 2),
    "utf-8"
  );
}

/**
 * Load a run result from the local filesystem.
 */
export function loadRun(runId: string): RunResult | null {
  const filePath = path.join(OUTPUTS_DIR, runId, "run.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as RunResult;
}

/**
 * List all run IDs (most recent first based on directory mtime).
 */
export function listRuns(): string[] {
  ensureDir(OUTPUTS_DIR);
  const entries = fs.readdirSync(OUTPUTS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => ({
      name: e.name,
      mtime: fs.statSync(path.join(OUTPUTS_DIR, e.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .map((e) => e.name);
}
