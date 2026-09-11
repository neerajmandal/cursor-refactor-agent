import { NextResponse } from "next/server";
import { createBoardRoom } from "@/lib/liveblocks-server";
import type { BoardSetup } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      boardId?: string;
      setup?: Partial<BoardSetup>;
    };
    const boardId = body.boardId?.trim();
    const setup = body.setup;
    if (
      !boardId ||
      !setup?.legacyRepo?.trim() ||
      !setup.targetRepo?.trim() ||
      !setup.prompt?.trim()
    ) {
      return NextResponse.json(
        { error: "boardId, legacyRepo, targetRepo, and prompt are required" },
        { status: 400 },
      );
    }

    await createBoardRoom(boardId, {
      envName: setup.envName?.trim() ?? "",
      legacyRepo: setup.legacyRepo.trim(),
      targetRepo: setup.targetRepo.trim(),
      legacyRef: setup.legacyRef?.trim() ?? "",
      targetRef: setup.targetRef?.trim() ?? "",
      prompt: setup.prompt.trim(),
      legacyBaseUrl: setup.legacyBaseUrl?.trim() ?? "",
      targetBaseUrl: setup.targetBaseUrl?.trim() ?? "",
      fixtureCommand: setup.fixtureCommand?.trim() ?? "",
    });
    return NextResponse.json({ boardId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Board creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
