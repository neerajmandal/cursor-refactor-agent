import { NextResponse } from "next/server";
import { startImplement } from "@/lib/cursor";
import type {
  ImplementationPlanReport,
  MigrationSnapshot,
  ResearchReport,
} from "@/lib/types";
import { isImplementationPlan } from "@/lib/workflow";

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
      targetBaseUrl?: string;
      fixtureCommand?: string;
      prompt?: string;
      research?: ResearchReport;
      plan?: ImplementationPlanReport;
      planDocument?: string;
      snapshot?: MigrationSnapshot;
      requestKey?: string;
    };
    if (
      !body.legacyRepo?.trim() ||
      !body.targetRepo?.trim() ||
      !body.prompt?.trim() ||
      !isImplementationPlan(body.plan ?? null, body.research ?? null) ||
      !body.planDocument?.trim() ||
      !body.snapshot?.toBe.nodes.length
    ) {
      return NextResponse.json(
        { error: "Repositories, approved plan, and target snapshot are required" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await startImplement({
        envName: body.envName ?? "",
        legacyRepo: body.legacyRepo,
        legacyRef: body.legacyRef ?? "",
        targetRepo: body.targetRepo,
        targetRef: body.targetRef ?? "",
        targetBaseUrl: body.targetBaseUrl ?? "",
        fixtureCommand: body.fixtureCommand ?? "",
        prompt: body.prompt,
        plan: body.plan!,
        planDocument: body.planDocument,
        snapshot: body.snapshot!,
        requestKey: body.requestKey,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Implementation failed" },
      { status: 500 },
    );
  }
}
