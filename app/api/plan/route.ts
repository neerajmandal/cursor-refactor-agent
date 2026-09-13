import { NextResponse } from "next/server";
import { startPlan } from "@/lib/cursor";
import type { ResearchReport } from "@/lib/types";
import { isResearchReport } from "@/lib/workflow";

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
      research?: ResearchReport;
      researchDocument?: string;
      requestKey?: string;
    };
    if (
      !body.legacyRepo?.trim() ||
      !body.targetRepo?.trim() ||
      !body.prompt?.trim() ||
      !isResearchReport(body.research ?? null) ||
      !body.researchDocument?.trim()
    ) {
      return NextResponse.json(
        { error: "Repositories, goal, and completed research are required" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await startPlan({
        envName: body.envName ?? "",
        legacyRepo: body.legacyRepo,
        legacyRef: body.legacyRef ?? "",
        targetRepo: body.targetRepo,
        targetRef: body.targetRef ?? "",
        prompt: body.prompt,
        research: body.research!,
        researchDocument: body.researchDocument,
        requestKey: body.requestKey,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Planning failed" },
      { status: 500 },
    );
  }
}
