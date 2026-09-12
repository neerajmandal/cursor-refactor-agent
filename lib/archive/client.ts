import type { BoardStorage } from "@/lib/types";

export async function persistBoardArchiveClient(
  boardId: string,
  board: Partial<BoardStorage>,
  options: { ingestArtifacts?: boolean } = {},
): Promise<void> {
  await fetch("/api/archives", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      boardId,
      board,
      ingestArtifacts: options.ingestArtifacts,
    }),
  });
}
