import { NextResponse } from "next/server";
import { persistBoardArchive } from "@/lib/archive/persist";
import { getArchiveStore } from "@/lib/archive/store";
import type { BoardStorage } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    const archives = await getArchiveStore().list();
    return NextResponse.json({ archives });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list archives";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      boardId?: string;
      board?: Partial<BoardStorage>;
      ingestArtifacts?: boolean;
    };
    const boardId = body.boardId?.trim();
    if (!boardId || !body.board) {
      return NextResponse.json(
        { error: "boardId and board are required" },
        { status: 400 },
      );
    }
    const archive = await persistBoardArchive(boardId, body.board, {
      ingestArtifacts: Boolean(body.ingestArtifacts),
    });
    return NextResponse.json({ archive });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save archive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
