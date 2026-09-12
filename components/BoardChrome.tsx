"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CuralLogo } from "@/components/CuralLogo";

export type BoardView = "architecture" | "evidence" | "cursor";

const VIEW_LABEL: Record<BoardView, string> = {
  architecture: "Architecture",
  evidence: "Evidence",
  cursor: "Cursor",
};

export function BoardChrome({
  view,
  onViewChange,
  primaryAction,
  overflow,
  status,
}: {
  view: BoardView;
  onViewChange: (view: BoardView) => void;
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
        <p className="hidden text-[13px] text-muted sm:block">Architecture to outcomes</p>
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
                <div className="absolute right-0 top-full z-30 mt-1 min-w-44 rounded-lg border border-line bg-white py-1 shadow-sm">
                  <div className="flex flex-col" onClick={() => setOpen(false)}>
                    {overflow}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex gap-6 px-4">
        {(["architecture", "evidence", "cursor"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onViewChange(item)}
            className={`border-b-2 py-2.5 text-[13px] font-medium ${
              view === item
                ? "border-[#7c3aed] text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {VIEW_LABEL[item]}
          </button>
        ))}
      </div>
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
