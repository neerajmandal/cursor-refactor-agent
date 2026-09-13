"use client";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import { Board } from "@/components/Board";
import { BoardErrorBoundary, BoardFallback } from "@/components/BoardFallback";
import type { BoardView } from "@/lib/board-view";
import type { Identity } from "@/lib/identity";
import { createInitialBoardStorage } from "@/lib/types";

export function BoardRoom({
  boardId,
  identity,
  initialView,
}: {
  boardId: string;
  identity: Identity;
  initialView: BoardView;
}) {
  return (
    <BoardErrorBoundary>
      <LiveblocksProvider
        authEndpoint={async (room) => {
          const response = await fetch("/api/liveblocks-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              room,
              userId: identity.id,
              name: identity.name,
              color: identity.color,
            }),
          });
          const data = (await response.json()) as { token?: string; error?: string };
          if (!response.ok || !data.token) {
            throw new Error(data.error || "Liveblocks auth failed");
          }
          return { token: data.token };
        }}
      >
        <RoomProvider
          id={boardId}
          initialPresence={{
            cursor: null,
            name: identity.name,
            color: identity.color,
          }}
          initialStorage={createInitialBoardStorage()}
        >
          <ClientSideSuspense fallback={<BoardFallback />}>
            <Board initialView={initialView} />
          </ClientSideSuspense>
        </RoomProvider>
      </LiveblocksProvider>
    </BoardErrorBoundary>
  );
}
