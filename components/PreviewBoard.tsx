"use client";

import { useState } from "react";
import Link from "next/link";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { AgentIdLink } from "@/components/AgentIdLink";
import { SpecPanel } from "@/components/SpecPanel";
import { SAMPLE_AS_IS, SAMPLE_TO_BE } from "@/lib/sample-board";
import type { Graph, NodeStatus } from "@/lib/types";

export function PreviewBoard() {
  const [asIs, setAsIs] = useState<Graph>(SAMPLE_AS_IS);
  const [toBe, setToBe] = useState<Graph>(SAMPLE_TO_BE);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = toBe.nodes.find((node) => node.id === selectedId);
  const nodeStatus: Record<string, NodeStatus> = {
    controller: "done",
    service: "running",
    domain: "pending",
    retrieval: "pending",
    generation: "pending",
  };

  function move(pane: "asIs" | "toBe", id: string, x: number, y: number) {
    const setter = pane === "asIs" ? setAsIs : setToBe;
    setter((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === id ? { ...node, x, y } : node,
      ),
    }));
  }

  return (
    <div className="relative flex h-svh min-h-0 flex-col">
      <header className="flex shrink-0 flex-col gap-1 border-b border-line px-4 py-2">
        <div className="flex min-h-8 items-center gap-6">
          <Link href="/" className="font-serif text-xl tracking-tight">
            Cural
          </Link>
          <p className="text-[13px] text-muted">Align on specs</p>
          <p className="text-[13px] text-muted">3 here</p>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[12px] text-muted">Regenerate</span>
            <span className="text-[12px] text-muted">Copy link</span>
            <button
              type="button"
              className="bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink"
            >
              Execute
            </button>
          </div>
        </div>
        <AgentIdLink
          label="Analyze"
          id="bc-e39a7c9c-5321-47a5-9440-7783e721d04f"
        />
      </header>
      <div className="flex min-h-0 flex-1">
        <ArchitecturePane
          pane="asIs"
          title="Current"
          graph={asIs}
          selectable={false}
          selectedId={null}
          nodeStatus={{}}
          onSelect={() => undefined}
          onMove={(id, x, y) => move("asIs", id, x, y)}
        />
        <div className="w-px bg-line" />
        <ArchitecturePane
          pane="toBe"
          title="Target"
          graph={toBe}
          selectable
          selectedId={selectedId}
          nodeStatus={nodeStatus}
          onSelect={setSelectedId}
          onMove={(id, x, y) => move("toBe", id, x, y)}
        />
        {selected ? (
          <SpecPanel
            key={selected.id}
            title={selected.label}
            spec={selected.spec}
            onSave={(spec) => {
              setToBe((graph) => ({
                ...graph,
                nodes: graph.nodes.map((node) =>
                  node.id === selected.id ? { ...node, spec } : node,
                ),
              }));
            }}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </div>
      <FakePointer name="Priya" color="#2f6f4e" className="left-[22%] top-[38%]" />
      <FakePointer name="Alex" color="#3d5a80" className="left-[78%] top-[58%]" />
    </div>
  );
}

function FakePointer({
  name,
  color,
  className,
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <div className={`pointer-events-none absolute z-30 ${className ?? ""}`}>
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
}
