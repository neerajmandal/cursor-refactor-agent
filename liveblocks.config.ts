import type { BoardStorage } from "@/lib/types";

declare global {
  interface Liveblocks {
    Presence: {
      cursor: {
        pane: "asIs" | "toBe";
        x: number;
        y: number;
      } | null;
      name: string;
      color: string;
    };
    Storage: BoardStorage;
    UserMeta: {
      id: string;
      info: {
        name: string;
        color: string;
      };
    };
  }
}

export {};
