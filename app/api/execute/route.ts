import { NextResponse } from "next/server";
import { startExecute } from "@/lib/cursor";
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
      prompt?: string;
      extraPrompt?: string;
      snapshot?: MigrationSnapshot;
      requestKey?: string;
    };
    if (
      !body.legacyRepo ||
      !body.targetRepo ||
      !body.snapshot?.toBe.nodes.length ||
      !body.snapshot.journeys.some((journey) => journey.required)
    ) {
      return NextResponse.json(
        { error: "legacyRepo, targetRepo, and an execution snapshot are required" },
        { status: 400 },
      );
    }
    const result = await startExecute({
      envName: body.envName ?? "",
      legacyRepo: body.legacyRepo,
      legacyRef: body.legacyRef ?? "",
      targetRepo: body.targetRepo,
      targetRef: body.targetRef ?? "",
      prompt: body.prompt ?? "",
      extraPrompt: body.extraPrompt ?? "",
      snapshot: body.snapshot,
      requestKey: body.requestKey,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
