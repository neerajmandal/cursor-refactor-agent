import { NextResponse } from "next/server";
import { evaluationTargetRef } from "@/lib/branch";
import { startEvaluation } from "@/lib/cursor";
import type { MigrationSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      envName?: string;
      legacyRepo?: string;
      legacyRef?: string;
      targetRepo?: string;
      targetRef?: string;
      legacyBaseUrl?: string;
      targetBaseUrl?: string;
      fixtureCommand?: string;
      extraPrompt?: string;
      snapshot?: MigrationSnapshot;
      requestKey?: string;
    };
    if (
      !body.legacyRepo ||
      !body.targetRepo ||
      !body.snapshot?.journeys.some((journey) => journey.required)
    ) {
      return NextResponse.json(
        { error: "legacyRepo, targetRepo, and a journey snapshot are required" },
        { status: 400 },
      );
    }

    const result = await startEvaluation({
      envName: body.envName ?? "",
      legacyRepo: body.legacyRepo,
      legacyRef: body.legacyRef ?? "",
      targetRepo: body.targetRepo,
      targetRef: evaluationTargetRef(body.snapshot, body.targetRef ?? ""),
      legacyBaseUrl: body.legacyBaseUrl ?? "",
      targetBaseUrl: body.targetBaseUrl ?? "",
      fixtureCommand: body.fixtureCommand ?? "",
      extraPrompt: body.extraPrompt ?? "",
      snapshot: body.snapshot,
      requestKey: body.requestKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
