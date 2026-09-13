import { NextResponse } from "next/server";
import { startResearch } from "@/lib/cursor";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      envName?: string;
      legacyRepo?: string;
      legacyRef?: string;
      legacyBaseUrl?: string;
      prompt?: string;
      requestKey?: string;
    };
    if (!body.legacyRepo?.trim() || !body.prompt?.trim()) {
      return NextResponse.json(
        { error: "legacyRepo and prompt are required" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await startResearch({
        envName: body.envName ?? "",
        legacyRepo: body.legacyRepo,
        legacyRef: body.legacyRef ?? "",
        legacyBaseUrl: body.legacyBaseUrl ?? "",
        prompt: body.prompt,
        requestKey: body.requestKey,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Research failed" },
      { status: 500 },
    );
  }
}
