import { NextResponse } from "next/server";
import { pollRun } from "@/lib/cursor";
import type { ImplementationPlanReport, ResearchReport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      runId?: string;
      kind?: "research" | "plan" | "implement";
      research?: ResearchReport;
      plan?: ImplementationPlanReport;
    };
    if (!body.runId || !body.kind) {
      return NextResponse.json(
        { error: "runId and kind are required" },
        { status: 400 },
      );
    }
    const result = await pollRun({
      agentId: id,
      runId: body.runId,
      kind: body.kind,
      research: body.research,
      plan: body.plan,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll failed";
    const rateLimited = /rate limit|too many requests|\b429\b/i.test(message);
    return NextResponse.json(
      { error: message },
      {
        status: rateLimited ? 429 : 500,
        headers: rateLimited ? { "Retry-After": "60" } : undefined,
      },
    );
  }
}
