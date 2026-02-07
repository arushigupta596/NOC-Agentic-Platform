"use client";

import { createContext, useContext, useCallback, ReactNode } from "react";
import { RunResult, SiteResult } from "@/lib/schemas";

interface RunContextType {
  saveRun: (run: RunResult) => void;
  loadRun: (runId: string) => RunResult | null;
  loadSite: (runId: string, siteId: string) => SiteResult | null;
}

const RunCtx = createContext<RunContextType | null>(null);

const STORAGE_PREFIX = "noc_run_";

export function RunProvider({ children }: { children: ReactNode }) {
  const saveRun = useCallback((run: RunResult) => {
    try {
      sessionStorage.setItem(
        `${STORAGE_PREFIX}${run.runId}`,
        JSON.stringify(run)
      );
    } catch {
      // sessionStorage full or unavailable — ignore
    }
  }, []);

  const loadRun = useCallback((runId: string): RunResult | null => {
    try {
      const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${runId}`);
      if (!raw) return null;
      return JSON.parse(raw) as RunResult;
    } catch {
      return null;
    }
  }, []);

  const loadSite = useCallback(
    (runId: string, siteId: string) => {
      const run = loadRun(runId);
      if (!run) return null;
      return run.sites?.find((s) => s.site_id === siteId) ?? null;
    },
    [loadRun]
  );

  return (
    <RunCtx.Provider value={{ saveRun, loadRun, loadSite }}>
      {children}
    </RunCtx.Provider>
  );
}

export function useRunContext() {
  const ctx = useContext(RunCtx);
  if (!ctx) throw new Error("useRunContext must be used within RunProvider");
  return ctx;
}
