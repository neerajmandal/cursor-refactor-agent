"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
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
  return (
    <div
      className={`flex h-[52px] w-[180px] items-center justify-center border bg-node px-3 ${
        selected ? "border-ink" : data.emphasized ? "border-[#3d5a80] shadow-[inset_0_0_0_1px_#3d5a80]" : "border-line"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-px !w-px !border-0 !bg-transparent !opacity-0" />
      <div className="min-w-0 text-center">
        <p className="truncate text-[13px] font-medium leading-5 text-ink">{data.label}</p>
        {data.status ? (
          <p className={`text-[10px] uppercase tracking-[0.12em] ${STATUS_CLASS[data.status]}`}>
            {data.status}
          </p>
        ) : null}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-px !w-px !border-0 !bg-transparent !opacity-0" />
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeInner);
