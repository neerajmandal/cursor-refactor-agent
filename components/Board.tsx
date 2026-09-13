"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useMutation,
  useOthers,
  useRoom,
  useStorage,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { ArtifactDrawer } from "@/components/ArtifactDrawer";
import { AgentIdLink } from "@/components/AgentIdLink";
import { BoardChrome, BoardOverflowItem } from "@/components/BoardChrome";
import { WorkflowDocumentPanel } from "@/components/WorkflowDocumentPanel";
import { persistBoardArchiveClient } from "@/lib/archive/client";
import { boardViewHref, type BoardView } from "@/lib/board-view";
import { createMigrationSnapshot } from "@/lib/journey";
import {
  EMPTY_GRAPH,
  isCloudAgentId,
  RECOVER_RUN_ID,
  type BoardStorage,
  type Graph,
  type ImplementationPlanReport,
  type ImplementationReport,
  type NodeStatus,
  type Phase,
  type PhaseStatuses,
  type ResearchReport,
  type RunBranch,
  type WorkflowDocument,
} from "@/lib/types";
import {
  canApprovePlan,
  canCreatePlan,
  defaultPhaseStatuses,
} from "@/lib/workflow";

type StartResponse = { agentId?: string; runId?: string; error?: string };
const NO_DOCUMENTS: Record<string, WorkflowDocument> = {};
type PollResponse = {
  status?: string;
  error?: string;
  researchResult?: {
    graph: Graph;
    report: ResearchReport;
    document: Pick<WorkflowDocument, "filename" | "artifactPath" | "content">;
  };
  planResult?: {
    graph: Graph;
    report: ImplementationPlanReport;
    document: Pick<WorkflowDocument, "filename" | "artifactPath" | "content">;
  };
  implementationResult?: {
    report: ImplementationReport;
    steps: { id: string; status: "done" | "error"; summary: string }[];
    documents: Pick<WorkflowDocument, "filename" | "artifactPath" | "content">[];
  };
  nodeStatus?: Record<string, NodeStatus>;
  branches?: RunBranch[];
};

function mergeBranches(current: RunBranch[], incoming: RunBranch[] = []) {
  const values = new Map(
    [...current, ...incoming].map((branch) => [
      `${branch.repoUrl}:${branch.branch ?? ""}:${branch.prUrl ?? ""}`,
      branch,
    ]),
  );
  return [...values.values()];
}

function savedDocument(
  value: Pick<WorkflowDocument, "filename" | "artifactPath" | "content">,
  agentId: string,
  runId: string,
): WorkflowDocument {
  return {
    ...value,
    agentId,
    runId,
    updatedAt: new Date().toISOString(),
  };
}

export function Board({ initialView }: { initialView: BoardView }) {
  const [view, setViewState] = useState<BoardView>(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFilename, setSelectedFilename] = useState("");
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ingested = useRef("");
  const room = useRoom();
  const others = useOthers();
  const updateMyPresence = useUpdateMyPresence();

  const envName = useStorage((root) => root.envName);
  const legacyRepo = useStorage((root) => root.legacyRepo);
  const targetRepo = useStorage((root) => root.targetRepo);
  const legacyRef = useStorage((root) => root.legacyRef ?? "");
  const targetRef = useStorage((root) => root.targetRef ?? "");
  const prompt = useStorage((root) => root.prompt);
  const legacyBaseUrl = useStorage((root) => root.legacyBaseUrl ?? "");
  const targetBaseUrl = useStorage((root) => root.targetBaseUrl ?? "");
  const fixtureCommand = useStorage((root) => root.fixtureCommand ?? "");
  const phase = useStorage((root) => root.phase ?? "research") as Phase;
  const phaseStatuses =
    (useStorage((root) => root.phaseStatuses) as PhaseStatuses | undefined) ??
    defaultPhaseStatuses(phase);
  const documents =
    (useStorage((root) => root.documents) as Record<string, WorkflowDocument> | undefined) ??
    NO_DOCUMENTS;
  const researchReport =
    (useStorage((root) => root.researchReport) as ResearchReport | null | undefined) ??
    null;
  const implementationPlan =
    (useStorage((root) => root.implementationPlan) as
      | ImplementationPlanReport
      | null
      | undefined) ?? null;
  const implementationReport =
    (useStorage((root) => root.implementationReport) as
      | ImplementationReport
      | null
      | undefined) ?? null;
  const blockers = useStorage((root) => root.blockers ?? []);
  const asIs = useStorage((root) => root.asIs ?? EMPTY_GRAPH);
  const toBe = useStorage((root) => root.toBe ?? EMPTY_GRAPH);
  const architectureVersion = useStorage((root) => root.architectureVersion ?? 0);
  const researchAgentId = useStorage((root) => root.researchAgentId ?? "");
  const researchRunId = useStorage((root) => root.researchRunId ?? "");
  const planAgentId = useStorage((root) => root.planAgentId ?? "");
  const planRunId = useStorage((root) => root.planRunId ?? "");
  const implementAgentId = useStorage((root) => root.implementAgentId ?? "");
  const implementRunId = useStorage((root) => root.implementRunId ?? "");
  const runBranches = useStorage((root) => root.runBranches ?? []);
  const error = useStorage((root) => root.error ?? "");

  const patch = useMutation(({ storage }, values: Partial<BoardStorage>) => {
    for (const key of Object.keys(values) as (keyof BoardStorage)[]) {
      const value = values[key];
      if (value !== undefined) storage.set(key, value as never);
    }
  }, []);

  const claimRun = useMutation(({ storage }, target: Phase) => {
    const runId =
      target === "research"
        ? storage.get("researchRunId")
        : target === "plan"
          ? storage.get("planRunId")
          : storage.get("implementRunId");
    if (runId) return false;
    if (target === "research") storage.set("researchRunId", "pending");
    if (target === "plan") storage.set("planRunId", "pending");
    if (target === "implement") storage.set("implementRunId", "pending");
    storage.set("phase", target);
    storage.set("phaseStatuses", {
      ...(storage.get("phaseStatuses") ?? defaultPhaseStatuses(target)),
      [target]: "running",
    });
    storage.set("blockers", []);
    storage.set("error", "");
    return true;
  }, []);

  const moveNode = useMutation(
    ({ storage }, pane: "asIs" | "toBe", id: string, x: number, y: number) => {
      const graph = storage.get(pane);
      storage.set(pane, {
        ...graph,
        nodes: graph.nodes.map((node) =>
          node.id === id ? { ...node, x, y } : node,
        ),
      });
    },
    [],
  );

  const setView = useCallback((next: BoardView) => {
    setViewState(next);
    setSelectedId(null);
    window.history.replaceState(
      null,
      "",
      boardViewHref(window.location.href, next),
    );
  }, []);

  const startResearch = useCallback(async () => {
    if (!legacyRepo || !claimRun("research")) return;
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envName,
          legacyRepo,
          legacyRef,
          legacyBaseUrl,
          prompt,
          requestKey: `${room.id}:research:${architectureVersion + 1}`,
        }),
      });
      const data = (await response.json()) as StartResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start research");
      }
      patch({ researchAgentId: data.agentId, researchRunId: data.runId });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Research failed";
      patch({
        researchRunId: "",
        phaseStatuses: { ...phaseStatuses, research: "blocked" },
        blockers: [{ id: "research-start", phase: "research", message }],
        error: message,
      });
    }
  }, [
    architectureVersion,
    claimRun,
    envName,
    legacyBaseUrl,
    legacyRef,
    legacyRepo,
    patch,
    phaseStatuses,
    prompt,
    room.id,
  ]);

  useEffect(() => {
    if (
      phase === "research" &&
      phaseStatuses.research === "running" &&
      !researchRunId &&
      !researchReport &&
      !error
    ) {
      void startResearch();
    }
  }, [
    error,
    phase,
    phaseStatuses.research,
    researchReport,
    researchRunId,
    startResearch,
  ]);

  const running = useMemo(() => {
    if (
      phaseStatuses.research === "running" &&
      isCloudAgentId(researchAgentId) &&
      researchRunId &&
      researchRunId !== "pending"
    ) {
      return { kind: "research" as const, agentId: researchAgentId, runId: researchRunId };
    }
    if (
      phaseStatuses.plan === "running" &&
      isCloudAgentId(planAgentId) &&
      planRunId &&
      planRunId !== "pending"
    ) {
      return { kind: "plan" as const, agentId: planAgentId, runId: planRunId };
    }
    if (
      phaseStatuses.implement === "running" &&
      isCloudAgentId(implementAgentId) &&
      implementRunId &&
      implementRunId !== "pending"
    ) {
      return { kind: "implement" as const, agentId: implementAgentId, runId: implementRunId };
    }
    return null;
  }, [
    implementAgentId,
    implementRunId,
    phaseStatuses,
    planAgentId,
    planRunId,
    researchAgentId,
    researchRunId,
  ]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let inFlight = false;
    async function poll() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/agents/${running!.agentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: running!.runId,
            kind: running!.kind,
            research: researchReport,
            plan: implementationPlan,
          }),
        });
        const data = (await response.json()) as PollResponse;
        if (cancelled) return;
        if (data.status === "running") {
          if (running!.kind === "implement" && data.nodeStatus && implementationPlan) {
            patch({
              implementationPlan: withStepProgress(
                implementationPlan,
                data.nodeStatus,
              ),
              error: "",
            });
          }
          return;
        }
        if (!response.ok || data.status === "error" || data.error) {
          const message = data.error || `${running!.kind} failed`;
          const keepFinishedRun =
            (running!.kind === "research" || running!.kind === "plan") &&
            /without a valid report/i.test(message);
          patch({
            phaseStatuses: {
              ...phaseStatuses,
              [running!.kind]: "blocked",
            },
            blockers: [{
              id: `${running!.kind}-run`,
              phase: running!.kind,
              message,
              resolution: "Retry the phase after resolving the reported issue.",
            }],
            error: message,
            runBranches: mergeBranches(runBranches, data.branches),
            ...(running!.kind === "research" && !keepFinishedRun
              ? { researchRunId: "" }
              : {}),
            ...(running!.kind === "plan" && !keepFinishedRun
              ? { planRunId: "" }
              : {}),
            ...(running!.kind === "implement" ? { implementRunId: "" } : {}),
          });
          return;
        }
        if (running!.kind === "research" && data.researchResult) {
          const document = savedDocument(
            data.researchResult.document,
            running!.agentId,
            running!.runId,
          );
          patch({
            asIs: data.researchResult.graph,
            researchReport: data.researchResult.report,
            documents: { ...documents, [document.filename]: document },
            phaseStatuses: { ...phaseStatuses, research: "ready" },
            architectureVersion: architectureVersion + 1,
            error: "",
          });
          setSelectedFilename(document.filename);
        } else if (running!.kind === "plan" && data.planResult) {
          const document = savedDocument(
            data.planResult.document,
            running!.agentId,
            running!.runId,
          );
          patch({
            toBe: data.planResult.graph,
            implementationPlan: data.planResult.report,
            documents: { ...documents, [document.filename]: document },
            phaseStatuses: { ...phaseStatuses, plan: "ready" },
            architectureVersion: architectureVersion + 1,
            error: "",
          });
          setSelectedFilename(document.filename);
        } else if (running!.kind === "implement" && data.implementationResult) {
          const nextDocuments = { ...documents };
          for (const item of data.implementationResult.documents) {
            const document = savedDocument(item, running!.agentId, running!.runId);
            nextDocuments[document.filename] = document;
          }
          const nextPlan = implementationPlan
            ? withTerminalSteps(implementationPlan, data.implementationResult.steps)
            : null;
          const passed = data.implementationResult.report.status === "passed";
          patch({
            implementationPlan: nextPlan,
            implementationReport: data.implementationResult.report,
            documents: nextDocuments,
            phaseStatuses: {
              ...phaseStatuses,
              implement: passed ? "complete" : "blocked",
            },
            blockers: passed
              ? []
              : [{
                  id: "verification",
                  phase: "implement",
                  message: "Modern application verification did not pass every gate.",
                }],
            evaluationVideos: data.implementationResult.report.recording
              ? [data.implementationResult.report.recording]
              : [],
            runBranches: mergeBranches(runBranches, data.branches),
            error: passed ? "" : "Modern verification is incomplete",
          });
          setSelectedFilename(
            nextDocuments["verification-report.md"]
              ? "verification-report.md"
              : "implementation-summary.md",
          );
          setView("implement");
        }
      } catch (caught) {
        if (!cancelled) {
          patch({ error: caught instanceof Error ? caught.message : "Poll failed" });
        }
      } finally {
        inFlight = false;
      }
    }
    void poll();
    const timer = window.setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    architectureVersion,
    documents,
    implementationPlan,
    patch,
    phaseStatuses,
    researchReport,
    runBranches,
    running,
    setView,
  ]);

  useEffect(() => {
    if (!legacyRepo) return;
    const shouldIngest =
      phaseStatuses.implement === "complete" &&
      implementRunId &&
      ingested.current !== implementRunId;
    const timer = window.setTimeout(() => {
      void persistBoardArchiveClient(
        room.id,
        {
          envName,
          legacyRepo,
          targetRepo,
          legacyRef,
          targetRef,
          prompt,
          legacyBaseUrl,
          targetBaseUrl,
          fixtureCommand,
          phase,
          phaseStatuses,
          documents,
          researchReport,
          implementationPlan,
          implementationReport,
          blockers,
          researchAgentId,
          researchRunId,
          planAgentId,
          planRunId,
          implementAgentId,
          implementRunId,
          asIs,
          toBe,
          architectureVersion,
          evaluationVideos: implementationReport?.recording
            ? [implementationReport.recording]
            : [],
          runBranches,
          error,
        },
        { ingestArtifacts: Boolean(shouldIngest) },
      )
        .then(() => {
          if (shouldIngest) ingested.current = implementRunId;
        })
        .catch((caught) => {
          patch({
            error:
              caught instanceof Error
                ? caught.message
                : "Failed to persist workflow artifacts",
          });
        });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    architectureVersion,
    asIs,
    blockers,
    documents,
    envName,
    error,
    fixtureCommand,
    implementAgentId,
    implementRunId,
    implementationPlan,
    implementationReport,
    legacyBaseUrl,
    legacyRef,
    legacyRepo,
    patch,
    phase,
    phaseStatuses,
    planAgentId,
    planRunId,
    prompt,
    researchAgentId,
    researchReport,
    researchRunId,
    room.id,
    runBranches,
    targetBaseUrl,
    targetRef,
    targetRepo,
    toBe,
  ]);

  async function createPlan() {
    const researchDocument = documents["research-plan.md"];
    if (!canCreatePlan(researchReport, researchDocument?.content) || !claimRun("plan")) {
      return;
    }
    setView("plan");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envName,
          legacyRepo,
          legacyRef,
          targetRepo,
          targetRef,
          prompt,
          research: researchReport,
          researchDocument: researchDocument.content,
          requestKey: `${room.id}:plan:${architectureVersion + 1}`,
        }),
      });
      const data = (await response.json()) as StartResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start planning");
      }
      patch({
        phase: "plan",
        researchRunId,
        planAgentId: data.agentId,
        planRunId: data.runId,
        phaseStatuses: {
          ...phaseStatuses,
          research: "complete",
          plan: "running",
        },
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Planning failed";
      patch({
        planRunId: "",
        phaseStatuses: { ...phaseStatuses, research: "complete", plan: "blocked" },
        blockers: [{ id: "plan-start", phase: "plan", message }],
        error: message,
      });
    }
  }

  async function approveAndImplement() {
    const planDocument = documents["implementation-plan.md"];
    if (
      !canApprovePlan(
        implementationPlan,
        researchReport,
        planDocument?.content,
      ) ||
      !researchReport ||
      !implementationPlan ||
      !claimRun("implement")
    ) {
      return;
    }
    const snapshot = createMigrationSnapshot({
      asIs,
      toBe,
      journeys: [],
      architectureVersion,
    });
    setView("implement");
    try {
      const response = await fetch("/api/implement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envName,
          legacyRepo,
          legacyRef,
          targetRepo,
          targetRef,
          targetBaseUrl,
          fixtureCommand,
          prompt,
          research: researchReport,
          plan: implementationPlan,
          planDocument: planDocument.content,
          snapshot,
          requestKey: `${room.id}:implement:${snapshot.id}`,
        }),
      });
      const data = (await response.json()) as StartResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start implementation");
      }
      patch({
        phase: "implement",
        executionSnapshot: snapshot,
        implementAgentId: data.agentId,
        implementRunId: data.runId,
        executeAgentId: data.agentId,
        executeRunId: data.runId,
        phaseStatuses: {
          ...phaseStatuses,
          research: "complete",
          plan: "complete",
          implement: "running",
        },
      });
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Implementation failed";
      patch({
        implementRunId: "",
        phaseStatuses: {
          ...phaseStatuses,
          research: "complete",
          plan: "complete",
          implement: "blocked",
        },
        blockers: [{ id: "implement-start", phase: "implement", message }],
        error: message,
      });
    }
  }

  function retryCurrent() {
    const reuseResearch = phase === "research" && isCloudAgentId(researchAgentId);
    const reusePlan = phase === "plan" && isCloudAgentId(planAgentId);
    patch({
      error: "",
      blockers: [],
      phaseStatuses: { ...phaseStatuses, [phase]: "running" },
      ...(phase === "research" && !reuseResearch
        ? { researchRunId: "", researchAgentId: "" }
        : {}),
      ...(phase === "research" && reuseResearch && !researchRunId
        ? { researchRunId: RECOVER_RUN_ID }
        : {}),
      ...(phase === "plan" && !reusePlan
        ? { planRunId: "", planAgentId: "" }
        : {}),
      ...(phase === "plan" && reusePlan && !planRunId
        ? { planRunId: RECOVER_RUN_ID }
        : {}),
      ...(phase === "implement" ? { implementRunId: "", implementAgentId: "" } : {}),
    });
    if (phase === "plan" && !reusePlan) void createPlan();
    if (phase === "implement") void approveAndImplement();
  }

  function restartResearch() {
    if (!window.confirm("Restart research and clear the current plan and implementation?")) {
      return;
    }
    patch({
      phase: "research",
      phaseStatuses: defaultPhaseStatuses("research"),
      documents: {},
      researchReport: null,
      implementationPlan: null,
      implementationReport: null,
      blockers: [],
      researchAgentId: "",
      researchRunId: "",
      planAgentId: "",
      planRunId: "",
      implementAgentId: "",
      implementRunId: "",
      asIs: EMPTY_GRAPH,
      toBe: EMPTY_GRAPH,
      evaluationVideos: [],
      runBranches: [],
      error: "",
    });
    setSelectedFilename("");
    setView("research");
  }

  const displayedView = phaseStatuses[view] === "pending" ? phase : view;
  const preferredFilename =
    displayedView === "research"
      ? "research-plan.md"
      : displayedView === "plan"
        ? "implementation-plan.md"
        : documents["verification-report.md"]
          ? "verification-report.md"
          : "implementation-summary.md";
  const displayedFilename = documents[selectedFilename]
    ? selectedFilename
    : documents[preferredFilename]
      ? preferredFilename
      : "";
  const graph = displayedView === "research" ? asIs : toBe;
  const nodeStatus = componentStatuses(toBe, implementationPlan);
  const primaryAction =
    phaseStatuses[displayedView] === "blocked" ? (
      <ActionButton onClick={retryCurrent}>Retry {displayedView}</ActionButton>
    ) : displayedView === "research" && phaseStatuses.research === "ready" ? (
      <ActionButton onClick={() => void createPlan()}>
        Create implementation plan
      </ActionButton>
    ) : displayedView === "plan" && phaseStatuses.plan === "ready" ? (
      <ActionButton onClick={() => void approveAndImplement()}>
        Approve and implement
      </ActionButton>
    ) : displayedView === "implement" && phaseStatuses.implement === "complete" ? (
      <ActionButton onClick={() => setSelectedFilename("verification-report.md")}>
        Review implementation
      </ActionButton>
    ) : null;

  function artifactUrl(path: string): string | null {
    const document = Object.values(documents).find(
      (item) => item.artifactPath === path,
    );
    const agentId = document?.agentId || implementAgentId;
    return isCloudAgentId(agentId)
      ? `/api/agents/${agentId}/artifacts?path=${encodeURIComponent(path)}`
      : null;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-paper">
      <BoardChrome
        view={displayedView}
        onViewChange={setView}
        phaseStatuses={phaseStatuses}
        primaryAction={primaryAction}
        status={
          <p className="hidden max-w-64 truncate text-[11px] text-muted md:block">
            {error ||
              (others.length
                ? `${others.length + 1} collaborators`
                : nextAction(phaseStatuses))}
          </p>
        }
        overflow={
          <>
            <BoardOverflowItem onClick={() => setArtifactsOpen(true)}>
              Saved artifacts
            </BoardOverflowItem>
            <BoardOverflowItem
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied" : "Copy link"}
            </BoardOverflowItem>
            <BoardOverflowItem href={`/p/${room.id}`}>Open saved view</BoardOverflowItem>
            <BoardOverflowItem onClick={restartResearch}>Restart research</BoardOverflowItem>
            {researchAgentId ? (
              <div className="border-t border-line px-3 py-2">
                <AgentIdLink label="Research" id={researchAgentId} />
              </div>
            ) : null}
            {planAgentId ? (
              <div className="border-t border-line px-3 py-2">
                <AgentIdLink label="Plan" id={planAgentId} />
              </div>
            ) : null}
            {implementAgentId ? (
              <div className="border-t border-line px-3 py-2">
                <AgentIdLink label="Implement" id={implementAgentId} />
              </div>
            ) : null}
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ArchitecturePane
          pane={displayedView === "research" ? "asIs" : "toBe"}
          title={displayedView === "research" ? "Legacy component diagram" : "Target component diagram"}
          subtitle={
            displayedView === "research"
              ? "Select a component to inspect responsibilities and findings"
              : displayedView === "plan"
                ? "Components are linked to approved implementation steps"
                : "Status reflects implementation progress"
          }
          graph={graph}
          selectable
          selectedId={selectedId}
          nodeStatus={displayedView === "implement" ? nodeStatus : {}}
          collab
          loading={phaseStatuses[displayedView] === "running" && graph.nodes.length === 0}
          stages={
            displayedView === "research"
              ? ["Inspecting the legacy repository", "Using the legacy UI", "Writing research-plan.md"]
              : displayedView === "plan"
                ? ["Designing target architecture", "Breaking work into steps", "Writing implementation-plan.md"]
                : ["Implementing approved steps", "Verifying the modern UI", "Saving the recording"]
          }
          onSelect={setSelectedId}
          onMove={(id, x, y) =>
            moveNode(displayedView === "research" ? "asIs" : "toBe", id, x, y)
          }
          onCursor={(cursor) => updateMyPresence({ cursor })}
        />
        <WorkflowDocumentPanel
          phase={displayedView}
          documents={documents}
          selectedFilename={displayedFilename}
          onSelectDocument={setSelectedFilename}
          selectedComponentId={selectedId}
          graph={graph}
          research={researchReport}
          plan={implementationPlan}
          implementation={implementationReport}
          blockers={blockers.filter((blocker) => blocker.phase === displayedView)}
          artifactUrl={artifactUrl}
        />
      </div>

      <ArtifactDrawer
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        documents={documents}
        implementation={implementationReport}
        branches={runBranches}
        urlFor={artifactUrl}
      />
    </div>
  );
}

function ActionButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md bg-cta px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-ink"
    >
      {children} <span aria-hidden>→</span>
    </button>
  );
}

function withStepProgress(
  plan: ImplementationPlanReport,
  statuses: Record<string, NodeStatus>,
): ImplementationPlanReport {
  return {
    ...plan,
    phases: plan.phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((step) => ({
        ...step,
        status: statuses[step.id] ?? step.status,
      })),
    })),
  };
}

function withTerminalSteps(
  plan: ImplementationPlanReport,
  results: { id: string; status: "done" | "error"; summary: string }[],
): ImplementationPlanReport {
  const byId = new Map(results.map((item) => [item.id, item]));
  return {
    ...plan,
    phases: plan.phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((step) => {
        const result = byId.get(step.id);
        return result
          ? { ...step, status: result.status, summary: result.summary }
          : { ...step, status: "error" };
      }),
    })),
  };
}

function componentStatuses(
  graph: Graph,
  plan: ImplementationPlanReport | null,
): Record<string, NodeStatus> {
  if (!plan) return {};
  const steps = plan.phases.flatMap((phase) => phase.steps);
  return Object.fromEntries(
    graph.nodes.map((node) => {
      const related = steps.filter((step) => step.componentIds.includes(node.id));
      const status: NodeStatus = related.some((step) => step.status === "error")
        ? "error"
        : related.some((step) => step.status === "running")
          ? "running"
          : related.length && related.every((step) => step.status === "done")
            ? "done"
            : "pending";
      return [node.id, status];
    }),
  );
}

function nextAction(statuses: PhaseStatuses) {
  if (statuses.research === "running") return "Researching the legacy application";
  if (statuses.research === "ready") return "Next: create implementation plan";
  if (statuses.plan === "running") return "Creating implementation plan";
  if (statuses.plan === "ready") return "Next: approve and implement";
  if (statuses.implement === "running") return "Implementing and verifying";
  if (statuses.implement === "complete") return "Verification passed";
  return "Action required";
}
