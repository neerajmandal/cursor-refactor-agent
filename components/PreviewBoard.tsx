"use client";

import { useState } from "react";
import Link from "next/link";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { EvidencePanel } from "@/components/EvidencePanel";
import { SpecPanel } from "@/components/SpecPanel";
import { SAMPLE_AS_IS, SAMPLE_TO_BE } from "@/lib/sample-board";
import type {
  EvaluationReport,
  Graph,
  NodeStatus,
  Phase,
  WorkItem,
} from "@/lib/types";

const PASSED_REPORT: EvaluationReport = {
  status: "passed",
  summary: "The frozen ask-a-question journey produced the same observable answer and failure behavior.",
  journeys: [{
    journeyId: "ask-a-question",
    status: "passed",
    checks: [{
      name: "Answer is returned",
      status: "passed",
      legacy: "200 · ChatResponse with answer",
      target: "200 · ChatResponse with answer",
      difference: "",
      evidence: ["tests/parity/report.json", "artifacts/answer.png"],
    }],
  }],
};

function demoItems(status: NodeStatus): Record<string, WorkItem> {
  return Object.fromEntries(
    SAMPLE_TO_BE.nodes.map((node) => [
      node.id,
      {
        componentId: node.id,
        label: node.label,
        status,
        attempts: 1,
        specSnapshot: node.spec as WorkItem["specSnapshot"],
        dependsOn: SAMPLE_TO_BE.edges
          .filter((edge) => edge.to === node.id)
          .map((edge) => edge.from),
        agentId: "bc-demo-execute",
        runId: "run-demo",
        branches: [],
        summary: status === "done" ? "Implemented from the frozen spec." : "",
      },
    ]),
  );
}

export function PreviewBoard() {
  const [asIs, setAsIs] = useState<Graph>(SAMPLE_AS_IS);
  const [toBe, setToBe] = useState<Graph>(SAMPLE_TO_BE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("aligning");
  const [view, setView] = useState<"architecture" | "evidence">("architecture");

  const selected = toBe.nodes.find((node) => node.id === selectedId);
  const running = phase === "executing";
  const nodeStatus: Record<string, NodeStatus> = Object.fromEntries(
    toBe.nodes.map((node, index) => [
      node.id,
      phase === "done" ? "done" : running && index === 0 ? "running" : "pending",
    ]),
  );

  function move(pane: "asIs" | "toBe", id: string, x: number, y: number) {
    const setter = pane === "asIs" ? setAsIs : setToBe;
    setter((graph) => ({
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === id ? { ...node, x, y } : node,
      ),
    }));
  }

  function executeProof() {
    setPhase("executing");
    setView("evidence");
    window.setTimeout(() => setPhase("evaluating"), 250);
    window.setTimeout(() => setPhase("done"), 650);
  }

  return (
    <div className="relative flex h-svh min-h-0 flex-col">
      <header className="shrink-0 border-b border-line">
        <div className="flex min-h-12 items-center gap-5 px-4">
          <Link href="/" className="font-serif text-[28px] font-semibold tracking-[0.04em]">Cural</Link>
          <div className="ml-auto">
            {phase === "aligning" ? (
              <button type="button" onClick={executeProof} className="bg-accent px-3 py-1.5 text-[13px] text-accent-ink">
                Execute plan
              </button>
            ) : (
              <span className="text-[12px] text-muted">
                {phase === "done" ? "Required journey passed" : "Working…"}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-5 border-t border-line px-4">
          {(["architecture", "evidence"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={`border-b-2 py-2 text-[11px] uppercase tracking-[0.14em] ${
                view === item ? "border-accent" : "border-transparent text-muted"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </header>

      {view === "evidence" ? (
        <EvidencePanel
          workItems={demoItems(phase === "done" ? "done" : running ? "running" : "pending")}
          report={phase === "done" ? PASSED_REPORT : null}
          branches={[{
            repoUrl: "https://github.com/acme/target",
            branch: "cursor/migration-proof",
            prUrl: "https://github.com/acme/target/pull/42",
          }]}
          journeys={[{
            id: "ask-a-question",
            title: "Ask a question",
            actor: "Customer",
            preconditions: ["A known document is available"],
            steps: ["Enter a question", "Submit it"],
            outcomes: ["An answer is shown"],
            fixtures: ["Known document"],
            normalizationRules: ["omit:requestId"],
            componentIds: ["controller", "service"],
            sourceEvidence: ["legacy/chat/controller.py"],
            required: true,
          }]}
        />
      ) : (
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
              readOnly={phase !== "aligning"}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
