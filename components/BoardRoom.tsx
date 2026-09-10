"use client";

import { useMemo } from "react";
import {
  ClientSideSuspense,
  LiveblocksProvider,
  RoomProvider,
} from "@liveblocks/react/suspense";
import { Board } from "@/components/Board";
import { BoardErrorBoundary, BoardFallback } from "@/components/BoardFallback";
import { setupStorageKey, type Identity } from "@/lib/identity";
import type { BoardSetup } from "@/lib/types";
import { EMPTY_GRAPH } from "@/lib/types";

function readSetup(boardId: string): BoardSetup | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(setupStorageKey(boardId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BoardSetup;
  } catch {
    return null;
  }
}

export function BoardRoom({
  boardId,
  identity,
}: {
  boardId: string;
  identity: Identity;
}) {
  const setup = useMemo(() => readSetup(boardId), [boardId]);

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
          initialStorage={{
            envName: setup?.envName ?? "",
            legacyRepo: setup?.legacyRepo ?? "",
            targetRepo: setup?.targetRepo ?? "",
            prompt: setup?.prompt ?? "",
            phase: "analyzing_current",
            asIs: EMPTY_GRAPH,
            toBe: EMPTY_GRAPH,
            analyzeAgentId: "",
            analyzeRunId: "",
            executeAgentId: "",
            executeRunId: "",
            nodeStatus: {},
            error: "",
          }}
        >
          <ClientSideSuspense fallback={<BoardFallback />}>
            <Board />
          </ClientSideSuspense>
        </RoomProvider>
      </LiveblocksProvider>
    </BoardErrorBoundary>
  );
}
