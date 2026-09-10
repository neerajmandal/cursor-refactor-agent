import { NextResponse } from "next/server";
import { startExecute } from "@/lib/cursor";
import type { GraphNode } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      envName?: string;
      legacyRepo?: string;
      targetRepo?: string;
      prompt?: string;
      components?: GraphNode[];
    };
    if (!body.legacyRepo || !body.targetRepo || !body.components?.length) {
      return NextResponse.json(
        { error: "legacyRepo, targetRepo, and components are required" },
        { status: 400 },
      );
    }
    const result = await startExecute({
      envName: body.envName ?? "",
      legacyRepo: body.legacyRepo,
      targetRepo: body.targetRepo,
      prompt: body.prompt ?? "",
      components: body.components,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
