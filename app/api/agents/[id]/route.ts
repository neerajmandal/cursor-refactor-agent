import { NextResponse } from "next/server";
import { pollRun } from "@/lib/cursor";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const runId = url.searchParams.get("runId");
    const componentIds = url.searchParams.get("componentIds");
    if (!runId) {
      return NextResponse.json({ error: "runId is required" }, { status: 400 });
    }
    const result = await pollRun({
      agentId: id,
      runId,
      componentIds: componentIds ? componentIds.split(",").filter(Boolean) : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Poll failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
