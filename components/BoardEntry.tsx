"use client";

import { useState, useSyncExternalStore } from "react";
import { BoardRoom } from "@/components/BoardRoom";
import { NameGate } from "@/components/NameGate";
import type { BoardView } from "@/lib/board-view";
import { readIdentity, type Identity } from "@/lib/identity";

const emptySubscribe = () => () => undefined;

export function BoardEntry({
  boardId,
  initialView,
}: {
  boardId: string;
  initialView: BoardView;
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const [identity, setIdentity] = useState<Identity | null>(null);

  if (!mounted) {
    return <p className="px-8 py-10 font-serif text-3xl text-muted">Cural</p>;
  }

  const resolved = identity ?? readIdentity();
  if (!resolved) {
    return <NameGate onReady={setIdentity} />;
  }

  return (
    <BoardRoom
      boardId={boardId}
      identity={resolved}
      initialView={initialView}
    />
  );
}
