"use client";

import { useOthers } from "@liveblocks/react/suspense";
import { useViewport } from "@xyflow/react";

export function PresenceCursors({ pane }: { pane: "asIs" | "toBe" }) {
  const others = useOthers();
  const viewport = useViewport();

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {others.map((other) => {
        const cursor = other.presence.cursor;
        if (!cursor || cursor.pane !== pane) return null;
        const left = cursor.x * viewport.zoom + viewport.x;
        const top = cursor.y * viewport.zoom + viewport.y;
        const color = other.info?.color || other.presence.color || "#5b9cf6";
        const name = other.info?.name || other.presence.name || "Guest";
        return (
          <div
            key={other.connectionId}
            className="absolute"
            style={{ left, top, transform: "translate(-2px, -2px)" }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" fill={color} aria-hidden>
              <path d="M1 1l14 9.2-6.4 1.4L6.2 19 1 1z" />
            </svg>
            <span
              className="ml-3 -mt-1 inline-block px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ background: color }}
            >
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
