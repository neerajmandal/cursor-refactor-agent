"use client";

import { useState } from "react";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { BoardChrome } from "@/components/BoardChrome";
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
    <div className="relative flex h-svh min-h-0 flex-col bg-paper">
      <BoardChrome
        view={view}
        onViewChange={setView}
        status={
          phase !== "aligning" ? (
            <span className="text-[12px] text-muted">
              {phase === "done" ? "Required journey passed" : "Working…"}
            </span>
          ) : null
        }
        primaryAction={
          phase === "aligning" ? (
            <button
              type="button"
              onClick={executeProof}
              className="inline-flex items-center gap-2 rounded-md bg-cta px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-ink"
            >
              Execute plan <span aria-hidden>→</span>
            </button>
          ) : null
        }
      />

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
            subtitle="Existing architecture (as-is)"
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
            subtitle="Proposed architecture (to-be)"
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
