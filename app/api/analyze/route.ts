import { NextResponse } from "next/server";
import { startAnalyze } from "@/lib/cursor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phase?: "as-is" | "to-be";
      envName?: string;
      legacyRepo?: string;
      targetRepo?: string;
      prompt?: string;
      agentId?: string;
      regenerate?: boolean;
    };
    if (!body.legacyRepo || !body.phase) {
      return NextResponse.json(
        { error: "legacyRepo and phase are required" },
        { status: 400 },
      );
    }
    const result = await startAnalyze({
      phase: body.phase,
      envName: body.envName ?? "",
      legacyRepo: body.legacyRepo,
      targetRepo: body.targetRepo ?? "",
      prompt: body.prompt ?? "",
      agentId: body.agentId,
      regenerate: body.regenerate,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyze failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
