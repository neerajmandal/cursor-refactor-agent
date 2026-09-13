import { Liveblocks, type PlainLsonObject } from "@liveblocks/node";
import {
  createInitialBoardStorage,
  type BoardSetup,
  type BoardStorage,
} from "@/lib/types";

function client(): Liveblocks {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
  if (!secret) throw new Error("LIVEBLOCKS_SECRET_KEY is not set");
  return new Liveblocks({ secret });
}

export async function createBoardRoom(
  boardId: string,
  setup: BoardSetup,
): Promise<BoardStorage> {
  const liveblocks = client();
  const storage = createInitialBoardStorage(setup);
  await liveblocks.createRoom(
    boardId,
    {
      defaultAccesses: [],
      metadata: { product: "cural" },
    },
    { idempotent: true },
  );

  try {
    await liveblocks.initializeStorageDocument(boardId, {
      liveblocksType: "LiveObject",
      data: storage,
    } as PlainLsonObject);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("storage") && !message.includes("already")) throw error;
  }
  return storage;
}

export async function deleteBoardRoom(boardId: string): Promise<void> {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY?.trim();
  if (!secret) return;
  try {
    await new Liveblocks({ secret }).deleteRoom(boardId);
  } catch {
    // The live room may already be gone.
  }
}
