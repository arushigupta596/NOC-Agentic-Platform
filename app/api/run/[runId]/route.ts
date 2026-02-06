import { NextRequest, NextResponse } from "next/server";
import { loadRun } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const run = loadRun(params.runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(run);
}
