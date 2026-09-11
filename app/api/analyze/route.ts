import { NextResponse } from "next/server";
import { startAnalyze } from "@/lib/cursor";
import type { Journey } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      phase?: "as-is" | "to-be";
      envName?: string;
      legacyRepo?: string;
      legacyRef?: string;
      targetRepo?: string;
      prompt?: string;
      journeys?: Journey[];
      agentId?: string;
      regenerate?: boolean;
      requestKey?: string;
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
      legacyRef: body.legacyRef ?? "",
      targetRepo: body.targetRepo ?? "",
      prompt: body.prompt ?? "",
      journeys: body.journeys ?? [],
      agentId: body.agentId,
      regenerate: body.regenerate,
      requestKey: body.requestKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyze failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
