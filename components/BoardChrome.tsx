"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CuralLogo } from "@/components/CuralLogo";
import { BOARD_VIEWS, type BoardView } from "@/lib/board-view";
import type { PhaseStatuses } from "@/lib/types";

export type { BoardView } from "@/lib/board-view";

const VIEW_LABEL: Record<BoardView, string> = {
  research: "Research",
  plan: "Plan",
  implement: "Implement",
};

const STATUS_LABEL = {
  pending: "Not started",
  running: "In progress",
  ready: "Ready",
  blocked: "Blocked",
  complete: "Complete",
} as const;

export function BoardChrome({
  view,
  onViewChange,
  phaseStatuses,
  primaryAction,
  overflow,
  status,
}: {
  view: BoardView;
  onViewChange: (view: BoardView) => void;
  phaseStatuses: PhaseStatuses;
  primaryAction?: ReactNode;
  overflow?: ReactNode;
  status?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="shrink-0 border-b border-line bg-white">
      <div className="flex min-h-14 items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2.5 text-ink no-underline">
          <CuralLogo className="h-[18px] w-[18px]" />
          <span className="text-[17px] font-semibold tracking-tight">Cural</span>
        </Link>
        <p className="hidden text-[13px] text-muted sm:block">
          Enterprise refactoring workspace
        </p>
        <div className="ml-auto flex items-center gap-3">
          {status}
          {primaryAction}
          {overflow ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label="More actions"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-paper-2 hover:text-ink"
              >
                <OverflowIcon />
              </button>
              {open ? (
                <div className="absolute right-0 top-full z-40 mt-1 min-w-48 rounded-lg border border-line bg-white py-1 shadow-sm">
                  <div className="flex flex-col" onClick={() => setOpen(false)}>
                    {overflow}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <nav className="flex px-4" aria-label="Refactoring phases">
        {BOARD_VIEWS.map((item, index) => {
          const active = view === item;
          const phaseStatus = phaseStatuses[item];
          const unavailable = phaseStatus === "pending";
          return (
            <button
              key={item}
              type="button"
              disabled={unavailable}
              onClick={() => onViewChange(item)}
              aria-current={active ? "step" : undefined}
              className={`group relative flex min-w-0 flex-1 items-center gap-2 border-b-2 px-2 py-2.5 text-left transition-colors sm:max-w-56 ${
                active
                  ? "border-accent text-ink"
                  : "border-transparent text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  phaseStatus === "complete"
                    ? "bg-good text-white"
                    : active
                      ? "bg-accent text-white"
                      : "border border-line bg-paper text-muted"
                }`}
              >
                {phaseStatus === "complete" ? "✓" : index + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">
                  {VIEW_LABEL[item]}
                </span>
                <span className="hidden truncate text-[10px] text-muted sm:block">
                  {STATUS_LABEL[phaseStatus]}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}

export function BoardOverflowItem({
  children,
  onClick,
  disabled,
  href,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  href?: string;
}) {
  const className =
    "px-3 py-2 text-left text-[13px] text-ink hover:bg-paper-2 disabled:cursor-not-allowed disabled:opacity-40";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

function OverflowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="8" cy="3" r="1.4" />
      <circle cx="8" cy="8" r="1.4" />
      <circle cx="8" cy="13" r="1.4" />
    </svg>
  );
}
