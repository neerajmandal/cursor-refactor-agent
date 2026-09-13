"use client";

import { useEffect, useState } from "react";

export const CURRENT_ANALYZE_STAGES = [
  "Opening the legacy repo",
  "Tracing the request path",
  "Mapping current architecture",
] as const;

export const TARGET_WAITING_STAGES = ["Waiting for current architecture"] as const;

export const TARGET_ANALYZE_STAGES = [
  "Reading the current map",
  "Drafting target components",
  "Writing component specs",
] as const;

export function ThinkingDots({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-3 w-[14px] items-center justify-center gap-[3px] ${className}`}
      aria-hidden
    >
      <span className="thinking-dot" />
      <span className="thinking-dot" />
      <span className="thinking-dot" />
    </span>
  );
}

export function ThinkingStatus({
  stages,
  active = true,
}: {
  stages: readonly string[];
  active?: boolean;
}) {
  const label = useStreamedStage(stages, active);
  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgb(0_0_0_/0.12)]"
    >
      <ThinkingDots />
      <span>{label}</span>
    </div>
  );
}

function useStreamedStage(stages: readonly string[], active: boolean): string {
  const [index, setIndex] = useState(0);
  const key = stages.join("|");

  useEffect(() => {
    setIndex(0);
    if (!active || stages.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % stages.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [active, key, stages.length]);

  return stages[index] ?? stages[0] ?? "";
}
