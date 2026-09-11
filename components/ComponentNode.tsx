"use client";

import { memo, type ReactNode } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { displayIconFor, displayTypeFor, type DisplayIcon } from "@/lib/node-display";
import type { NodeStatus } from "@/lib/types";

export type ComponentNodeData = {
  label: string;
  kind?: string;
  status?: NodeStatus;
  emphasized?: boolean;
};

export type ComponentFlowNode = Node<ComponentNodeData, "component">;

const STATUS_CLASS: Record<NodeStatus, string> = {
  pending: "text-muted",
  running: "text-accent status-running",
  done: "text-good",
  error: "text-bad",
};

function ComponentNodeInner({ data, selected }: NodeProps<ComponentFlowNode>) {
  const running = data.status === "running";
  const typeLabel = displayTypeFor(data.label, data.kind);
  const icon = displayIconFor(data.label, data.kind);
  const highlighted = selected || data.emphasized;

  return (
    <div
      aria-busy={running}
      className={`relative flex h-[80px] w-[220px] items-start gap-2.5 rounded-lg border px-3 py-2.5 shadow-[0_1px_2px_rgb(0_0_0_/0.04)] ${
        highlighted
          ? "border-[#7c3aed] bg-[#f3e8ff]"
          : "border-[#e5e7eb] bg-white"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
          highlighted ? "bg-white text-[#7c3aed]" : "bg-[#eef0f3] text-ink"
        }`}
      >
        <TypeIcon name={icon} />
      </div>
      <div className="min-w-0 flex-1 pr-4">
        <p className="truncate text-[13px] font-semibold leading-5 text-ink">{data.label}</p>
        <p className="truncate text-[11px] leading-4 text-muted">{typeLabel}</p>
        {data.status ? (
          running ? (
            <span className="mt-0.5 inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-accent">
              <span className="node-spinner" aria-hidden />
              Running
            </span>
          ) : (
            <p
              className={`mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${STATUS_CLASS[data.status]}`}
            >
              {data.status}
            </p>
          )
        ) : null}
      </div>
      <button
        type="button"
        aria-label={`${data.label} menu`}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-black/5 hover:text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <MoreIcon />
      </button>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-px !w-px !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
}

function MoreIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <circle cx="7" cy="3" r="1.15" />
      <circle cx="7" cy="7" r="1.15" />
      <circle cx="7" cy="11" r="1.15" />
    </svg>
  );
}

function TypeIcon({ name }: { name: DisplayIcon }) {
  const props = {
    width: 14,
    height: 14,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const icons: Record<DisplayIcon, ReactNode> = {
    cube: (
      <svg {...props}>
        <path d="M8 1.8L13.5 4.8V11.2L8 14.2L2.5 11.2V4.8L8 1.8Z" />
        <path d="M8 8V14.2" />
        <path d="M8 8L13.5 4.8" />
        <path d="M8 8L2.5 4.8" />
      </svg>
    ),
    list: (
      <svg {...props}>
        <path d="M6 4h7M6 8h7M6 12h7" />
        <circle cx="3.5" cy="4" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="8" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="12" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    ),
    branch: (
      <svg {...props}>
        <circle cx="4.5" cy="4" r="1.4" />
        <circle cx="4.5" cy="12" r="1.4" />
        <circle cx="11.5" cy="12" r="1.4" />
        <path d="M4.5 5.4V10.6" />
        <path d="M4.5 8H11.5V10.6" />
      </svg>
    ),
    database: (
      <svg {...props}>
        <ellipse cx="8" cy="4" rx="4.5" ry="1.8" />
        <path d="M3.5 4v8c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V4" />
        <path d="M3.5 8c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8" />
      </svg>
    ),
    layers: (
      <svg {...props}>
        <path d="M8 2.5L13.5 5.5L8 8.5L2.5 5.5L8 2.5Z" />
        <path d="M2.5 8L8 11L13.5 8" />
        <path d="M2.5 10.5L8 13.5L13.5 10.5" />
      </svg>
    ),
    search: (
      <svg {...props}>
        <circle cx="7" cy="7" r="3.5" />
        <path d="M10 10.5L13.2 13.7" />
      </svg>
    ),
    sparkles: (
      <svg {...props}>
        <path d="M8 2.5l.9 2.4L11.5 6l-2.6.9L8 9.5l-.9-2.6L4.5 6l2.6-1.1L8 2.5Z" />
        <path d="M12.2 9.2l.45 1.2 1.25.45-1.25.45-.45 1.2-.45-1.2-1.25-.45 1.25-.45.45-1.2Z" />
        <path d="M3.5 10.5l.35.9.9.35-.9.35-.35.9-.35-.9-.9-.35.9-.35.35-.9Z" />
      </svg>
    ),
    box: (
      <svg {...props}>
        <rect x="3" y="3.5" width="10" height="9" rx="1.2" />
        <path d="M3 6.5h10" />
      </svg>
    ),
  };

  return icons[name];
}

export const ComponentNode = memo(ComponentNodeInner);
