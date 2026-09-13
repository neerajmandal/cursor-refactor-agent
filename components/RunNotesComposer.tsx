"use client";

import { useEffect, useRef, useState } from "react";

const MAX_NOTES = 2000;

export function RunNotesComposer({
  value,
  onChange,
  appliesTo,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  appliesTo: "execute" | "evaluate";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const attached = Boolean(value.trim());

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="run-notes"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex items-center rounded-md border px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          attached
            ? "border-ink bg-paper-2 text-ink"
            : "border-line bg-white text-muted hover:bg-paper-2 hover:text-ink"
        }`}
      >
        {attached ? "Notes attached" : "Add notes"}
      </button>
      {open ? (
        <div
          id="run-notes"
          className="absolute right-0 top-full z-30 mt-1 w-[min(100vw-2rem,22rem)] rounded-lg border border-line bg-white p-3 shadow-sm"
        >
          <label htmlFor="run-notes-input" className="block text-[12px] font-medium text-ink">
            Extra instructions
          </label>
          <p className="mt-1 text-[11px] leading-4 text-muted">
            {appliesTo === "execute"
              ? "Applies to this execute run. Frozen specs and the assigned branch stay in force."
              : "Applies to this E2E run. Frozen journeys and the assigned branch stay in force."}
          </p>
          <textarea
            id="run-notes-input"
            value={value}
            maxLength={MAX_NOTES}
            rows={4}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              appliesTo === "execute"
                ? "Skip payments; use the stub. Do not open a PR yet."
                : "Legacy is on :3001 today. Reset with npm run seed."
            }
            className="mt-2 min-h-[6rem] w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-[13px] leading-5 outline-none focus:border-ink"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted">
              {value.trim().length}/{MAX_NOTES}
            </p>
            {attached ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-[12px] text-muted hover:text-ink"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
