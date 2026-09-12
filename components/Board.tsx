"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useMutation,
  useOthers,
  useRoom,
  useStorage,
  useUpdateMyPresence,
} from "@liveblocks/react/suspense";
import { AgentIdLink } from "@/components/AgentIdLink";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { BoardChrome, BoardOverflowItem } from "@/components/BoardChrome";
import { EvidencePanel } from "@/components/EvidencePanel";
import { SpecInspector } from "@/components/SpecInspector";
import { persistBoardArchiveClient } from "@/lib/archive/client";
import {
  createMigrationSnapshot,
  reconcileJourneyComponents,
  validateAlignment,
  workItemsFromSnapshot,
} from "@/lib/journey";
import {
  EMPTY_GRAPH,
  PHASE_LABEL,
  isCloudAgentId,
  type BoardStorage,
  type EvaluationReport,
  type EvaluationVideo,
  type ExecutionReport,
  type Graph,
  type Journey,
  type MigrationSnapshot,
  type NodeStatus,
  type RunBranch,
  type WorkItem,
} from "@/lib/types";

type View = "architecture" | "evidence";
type AnalyzeResponse = { agentId?: string; runId?: string; error?: string };
type PollResponse = {
  status?: string;
  graph?: Graph;
  journeys?: Journey[];
  error?: string;
  nodeStatus?: Record<string, NodeStatus>;
  executionReport?: ExecutionReport;
  evaluationReport?: EvaluationReport;
  evaluationVideos?: EvaluationVideo[];
  branches?: RunBranch[];
};

function asNodeStatus(
  value: Record<string, unknown> | null | undefined,
): Record<string, NodeStatus> {
  const next: Record<string, NodeStatus> = {};
  if (!value) return next;
  for (const [key, item] of Object.entries(value)) {
    if (
      item === "pending" ||
      item === "running" ||
      item === "done" ||
      item === "error"
    ) {
      next[key] = item;
    }
  }
  return next;
}

function mergeBranches(current: RunBranch[], incoming: RunBranch[] = []): RunBranch[] {
  const keyed = new Map(
    [...current, ...incoming].map((branch) => [
      `${branch.repoUrl}:${branch.branch ?? ""}:${branch.prUrl ?? ""}`,
      branch,
    ]),
  );
  return [...keyed.values()];
}

function mergeWorkItems(
  current: Record<string, WorkItem>,
  statuses?: Record<string, NodeStatus>,
  report?: ExecutionReport,
  branches?: RunBranch[],
): Record<string, WorkItem> {
  const next = { ...current };
  for (const [id, status] of Object.entries(statuses ?? {})) {
    const item = next[id];
    if (item) next[id] = { ...item, status };
  }
  for (const result of report?.components ?? []) {
    const item = next[result.id];
    if (item) {
      next[result.id] = {
        ...item,
        status: result.status === "done" ? "done" : "error",
        summary: result.summary,
        branches: mergeBranches(item.branches, branches),
      };
    }
  }
  return next;
}

export function Board() {
  const [view, setView] = useState<View>("architecture");
  const [selected, setSelected] = useState<{
    pane: "asIs" | "toBe";
    id: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const ingestedEvaluation = useRef("");
  const others = useOthers();
  const room = useRoom();
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
  const phase = useStorage((root) => root.phase);
  const asIs = useStorage((root) => root.asIs);
  const toBe = useStorage((root) => root.toBe);
  const journeys = useStorage((root) => root.journeys ?? []);
  const architectureVersion = useStorage((root) => root.architectureVersion ?? 0);
  const executionSnapshot = useStorage((root) => root.executionSnapshot ?? null);
  const analyzeAgentId = useStorage((root) => root.analyzeAgentId);
  const analyzeRunId = useStorage((root) => root.analyzeRunId);
  const executeAgentId = useStorage((root) => root.executeAgentId);
  const executeRunId = useStorage((root) => root.executeRunId);
  const evaluationAgentId = useStorage((root) => root.evaluationAgentId ?? "");
  const evaluationRunId = useStorage((root) => root.evaluationRunId ?? "");
  const activeComponentIds = useStorage((root) => root.activeComponentIds ?? []);
  const nodeStatus = useStorage((root) => root.nodeStatus) as unknown as Record<
    string,
    NodeStatus
  >;
  const workItems = useStorage((root) => root.workItems ?? {}) as unknown as Record<
    string,
    WorkItem
  >;
  const executionReport = useStorage((root) => root.executionReport ?? null);
  const evaluationReport = useStorage((root) => root.evaluationReport ?? null);
  const evaluationVideos = useStorage((root) => root.evaluationVideos ?? []);
  const runBranches = useStorage((root) => root.runBranches ?? []);
  const error = useStorage((root) => root.error);

  const patch = useMutation(({ storage }, values: Partial<BoardStorage>) => {
    (Object.keys(values) as (keyof BoardStorage)[]).forEach((key) => {
      const value = values[key];
      if (value !== undefined) storage.set(key, value as never);
    });
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
      if (pane === "toBe") {
        storage.set("executionSnapshot", null);
        storage.set("phase", "aligning");
      }
    },
    [],
  );

  const claimAnalyze = useMutation(
    ({ storage }, requestedPhase: "analyzing_current" | "analyzing_target") => {
      if (storage.get("phase") !== requestedPhase || storage.get("analyzeRunId")) {
        return false;
      }
      storage.set("analyzeRunId", "pending");
      if (requestedPhase === "analyzing_current" && !storage.get("analyzeAgentId")) {
        storage.set("analyzeAgentId", "pending");
      }
      storage.set("error", "");
      return true;
    },
    [],
  );

  const claimExecute = useMutation(({ storage }, snapshot: MigrationSnapshot) => {
    if (
      storage.get("phase") !== "aligning" ||
      storage.get("executeRunId")
    ) {
      return null;
    }
    const previousSnapshot = storage.get("executionSnapshot");
    const previous =
      previousSnapshot?.id === snapshot.id
        ? ((storage.get("workItems") ?? {}) as Record<string, WorkItem>)
        : {};
    const componentIds = Object.keys(previous).length
      ? Object.values(previous)
          .filter((item) => item.status !== "done")
          .map((item) => item.componentId)
      : snapshot.toBe.nodes.map((node) => node.id);
    if (!componentIds.length) return null;
    const selected = new Set(componentIds);
    const runSnapshot: MigrationSnapshot = {
      ...snapshot,
      toBe: {
        ...snapshot.toBe,
        nodes: snapshot.toBe.nodes.filter((node) => selected.has(node.id)),
        edges: snapshot.toBe.edges.filter(
          (edge) => selected.has(edge.from) && selected.has(edge.to),
        ),
      },
    };
    const items = workItemsFromSnapshot(
      snapshot,
      previous,
      componentIds,
    );
    storage.set("phase", "executing");
    storage.set("executionSnapshot", snapshot);
    storage.set("executeAgentId", "pending");
    storage.set("executeRunId", "pending");
    storage.set("executionReport", null);
    storage.set("evaluationReport", null);
    storage.set("evaluationVideos", []);
    storage.set("activeComponentIds", componentIds);
    storage.set("nodeStatus", Object.fromEntries(
      snapshot.toBe.nodes.map((node) => [node.id, "pending" as const]),
    ));
    storage.set("workItems", items);
    storage.set("error", "");
    return runSnapshot;
  }, []);

  const claimEvaluation = useMutation(({ storage }) => {
    if (
      storage.get("phase") !== "evaluating" ||
      storage.get("evaluationRunId") ||
      !storage.get("executionSnapshot")
    ) {
      return null;
    }
    storage.set("evaluationAgentId", "pending");
    storage.set("evaluationRunId", "pending");
    storage.set("evaluationVideos", []);
    storage.set("error", "");
    return storage.get("executionSnapshot");
  }, []);

  const attachExecutionRun = useMutation(
    ({ storage }, agentId: string, runId: string) => {
      const active = new Set(storage.get("activeComponentIds") ?? []);
      const current = (storage.get("workItems") ?? {}) as Record<string, WorkItem>;
      storage.set(
        "workItems",
        Object.fromEntries(
          Object.entries(current).map(([id, item]) => [
            id,
            active.has(id) ? { ...item, agentId, runId } : item,
          ]),
        ),
      );
    },
    [],
  );

  const startAsIs = useCallback(async () => {
    if (!legacyRepo || !claimAnalyze("analyzing_current")) return;
    const resumeId = isCloudAgentId(analyzeAgentId) ? analyzeAgentId : undefined;
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "as-is",
          envName,
          legacyRepo,
          legacyRef,
          targetRepo,
          prompt,
          agentId: resumeId,
          requestKey: `${room.id}:as-is:${architectureVersion + 1}`,
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start current-state analysis");
      }
      patch({ analyzeAgentId: data.agentId, analyzeRunId: data.runId });
    } catch (caught) {
      patch({
        analyzeAgentId: resumeId ?? "",
        analyzeRunId: "",
        error: caught instanceof Error ? caught.message : "Analyze failed",
      });
    }
  }, [
    analyzeAgentId,
    architectureVersion,
    claimAnalyze,
    envName,
    legacyRepo,
    legacyRef,
    patch,
    prompt,
    room.id,
    targetRepo,
  ]);

  const startToBe = useCallback(async () => {
    if (!isCloudAgentId(analyzeAgentId) || !claimAnalyze("analyzing_target")) return;
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "to-be",
          envName,
          legacyRepo,
          legacyRef,
          targetRepo,
          prompt,
          journeys,
          agentId: analyzeAgentId,
          requestKey: `${room.id}:to-be:${architectureVersion + 1}`,
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start target analysis");
      }
      patch({ analyzeAgentId: data.agentId, analyzeRunId: data.runId });
    } catch (caught) {
      patch({
        analyzeRunId: "",
        error: caught instanceof Error ? caught.message : "Target analysis failed",
      });
    }
  }, [
    analyzeAgentId,
    architectureVersion,
    claimAnalyze,
    envName,
    legacyRepo,
    legacyRef,
    journeys,
    patch,
    prompt,
    room.id,
    targetRepo,
  ]);

  useEffect(() => {
    if (phase === "analyzing_current" && !analyzeRunId && legacyRepo && !error) {
      void startAsIs();
    }
    if (
      phase === "analyzing_target" &&
      !analyzeRunId &&
      isCloudAgentId(analyzeAgentId) &&
      !error
    ) {
      void startToBe();
    }
  }, [
    analyzeAgentId,
    analyzeRunId,
    error,
    legacyRepo,
    phase,
    startAsIs,
    startToBe,
  ]);

  useEffect(() => {
    if (
      !isCloudAgentId(analyzeAgentId) ||
      !analyzeRunId ||
      analyzeRunId === "pending" ||
      (phase !== "analyzing_current" && phase !== "analyzing_target")
    ) {
      return;
    }
    let cancelled = false;
    let inFlight = false;

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(
          `/api/agents/${analyzeAgentId}?kind=analyze&runId=${encodeURIComponent(analyzeRunId)}`,
        );
        const data = (await response.json()) as PollResponse;
        if (cancelled) return;
        if (!response.ok || data.status === "error" || data.status === "cancelled") {
          patch({ error: data.error || "Analysis failed" });
          return;
        }
        if (data.status === "running") {
          patch({ error: "" });
          return;
        }
        if (!data.graph) {
          patch({ error: "No architecture JSON from agent" });
          return;
        }
        if (phase === "analyzing_current") {
          patch({
            asIs: data.graph,
            journeys: data.journeys?.length ? data.journeys : journeys,
            architectureVersion: architectureVersion + 1,
            phase: "analyzing_target",
            analyzeRunId: "",
            error: "",
          });
        } else {
          const targetJourneys = reconcileJourneyComponents(
            asIs,
            data.graph,
            data.journeys?.length ? data.journeys : journeys,
          );
          patch({
            toBe: data.graph,
            journeys: targetJourneys,
            architectureVersion: architectureVersion + 1,
            phase: "aligning",
            analyzeRunId: "",
            executionSnapshot: null,
            error: "",
          });
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
    const interval = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    analyzeAgentId,
    analyzeRunId,
    architectureVersion,
    asIs,
    journeys,
    patch,
    phase,
  ]);

  useEffect(() => {
    if (
      phase !== "executing" ||
      !isCloudAgentId(executeAgentId) ||
      !executeRunId ||
      executeRunId === "pending"
    ) {
      return;
    }
    let cancelled = false;
    let inFlight = false;
    const active = new Set(activeComponentIds);
    const components = executionSnapshot?.toBe.nodes
      .filter((node) => active.has(node.id))
      .map((node) => `${node.id}|${node.label}`)
      .join(",") ?? "";

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(
          `/api/agents/${executeAgentId}?kind=execute&runId=${encodeURIComponent(executeRunId)}&components=${encodeURIComponent(components)}`,
        );
        const data = (await response.json()) as PollResponse;
        if (cancelled) return;
        const nextItems = mergeWorkItems(
          workItems,
          data.nodeStatus,
          data.executionReport,
          data.branches,
        );
        patch({
          nodeStatus: data.nodeStatus ?? nodeStatus,
          workItems: nextItems,
          executionReport: data.executionReport ?? undefined,
          runBranches: mergeBranches(runBranches, data.branches),
          error: data.status === "running" ? "" : undefined,
        });
        if (data.status === "running") {
          patch({ error: "" });
          return;
        }
        if (
          !response.ok ||
          data.status === "error" ||
          data.status === "cancelled" ||
          data.executionReport?.status !== "passed"
        ) {
          patch({
            phase: "aligning",
            executeAgentId: "",
            executeRunId: "",
            error: data.error || "Component execution did not complete",
          });
          return;
        }
        const allDone = Object.values(nextItems).every(
          (item) => item.status === "done",
        );
        patch({
          phase: "evaluating",
          evaluationAgentId: "",
          evaluationRunId: "",
          error: "",
        });
        if (!allDone) {
          patch({
            phase: "aligning",
            executeAgentId: "",
            executeRunId: "",
            error: "Some components still need an execution attempt",
          });
          return;
        }
        setView("evidence");
      } catch (caught) {
        if (!cancelled) {
          patch({ error: caught instanceof Error ? caught.message : "Poll failed" });
        }
      } finally {
        inFlight = false;
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 2500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    executionSnapshot,
    activeComponentIds,
    executeAgentId,
    executeRunId,
    nodeStatus,
    patch,
    phase,
    runBranches,
    workItems,
  ]);

  const startEvaluation = useCallback(async () => {
    const snapshot = claimEvaluation();
    if (!snapshot) return;
    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envName,
          legacyRepo,
          legacyRef,
          targetRepo,
          targetRef,
          legacyBaseUrl,
          targetBaseUrl,
          fixtureCommand,
          snapshot,
          requestKey: `${room.id}:evaluate:${snapshot.id}`,
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start end-to-end user testing");
      }
      patch({ evaluationAgentId: data.agentId, evaluationRunId: data.runId });
    } catch (caught) {
      patch({
        evaluationAgentId: "",
        evaluationRunId: "",
        phase: "parity_failed",
        error: caught instanceof Error ? caught.message : "Evaluation failed",
      });
    }
  }, [
    claimEvaluation,
    envName,
    fixtureCommand,
    legacyBaseUrl,
    legacyRepo,
    legacyRef,
    patch,
    room.id,
    targetBaseUrl,
    targetRef,
    targetRepo,
  ]);

  useEffect(() => {
    if (phase === "evaluating" && !evaluationRunId && !error) {
      void startEvaluation();
    }
  }, [error, evaluationRunId, phase, startEvaluation]);

  useEffect(() => {
    if (
      phase !== "evaluating" ||
      !isCloudAgentId(evaluationAgentId) ||
      !evaluationRunId ||
      evaluationRunId === "pending"
    ) {
      return;
    }
    let cancelled = false;
    let inFlight = false;

    async function poll() {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(
          `/api/agents/${evaluationAgentId}?kind=evaluate&runId=${encodeURIComponent(evaluationRunId)}`,
        );
        const data = (await response.json()) as PollResponse;
        if (cancelled) return;
        if (data.status === "running") return;
        const report = data.evaluationReport ?? null;
        patch({
          evaluationReport: report,
          evaluationVideos: data.evaluationVideos ?? report?.videos ?? [],
          runBranches: mergeBranches(runBranches, data.branches),
          phase:
            response.ok && data.status === "finished" && report?.status === "passed"
              ? "done"
              : "parity_failed",
          error:
            response.ok && report
              ? report.status === "passed"
                ? ""
                : report.summary || "Behavior differs from legacy"
              : data.error || "End-to-end user testing failed",
        });
      } catch (caught) {
        if (!cancelled) {
          patch({
            phase: "parity_failed",
            error: caught instanceof Error ? caught.message : "Poll failed",
          });
        }
      } finally {
        inFlight = false;
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    evaluationAgentId,
    evaluationRunId,
    patch,
    phase,
    runBranches,
  ]);

  useEffect(() => {
    if (!legacyRepo) return;
    const shouldIngest =
      (phase === "done" || phase === "parity_failed") &&
      Boolean(evaluationReport || evaluationVideos.length) &&
      ingestedEvaluation.current !== evaluationRunId;
    const ingestArtifacts = shouldIngest && Boolean(evaluationRunId);
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
          asIs,
          toBe,
          journeys,
          architectureVersion,
          executionSnapshot,
          analyzeAgentId,
          analyzeRunId,
          executeAgentId,
          executeRunId,
          evaluationAgentId,
          evaluationRunId,
          workItems,
          executionReport,
          evaluationReport,
          evaluationVideos,
          runBranches,
          error,
        },
        { ingestArtifacts },
      ).then(() => {
        if (ingestArtifacts) ingestedEvaluation.current = evaluationRunId;
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    analyzeAgentId,
    analyzeRunId,
    architectureVersion,
    asIs,
    envName,
    error,
    evaluationAgentId,
    evaluationReport,
    evaluationRunId,
    evaluationVideos,
    executeAgentId,
    executeRunId,
    executionReport,
    executionSnapshot,
    fixtureCommand,
    journeys,
    legacyBaseUrl,
    legacyRef,
    legacyRepo,
    phase,
    prompt,
    room.id,
    runBranches,
    targetBaseUrl,
    targetRef,
    targetRepo,
    toBe,
    workItems,
  ]);

  async function execute() {
    const reconciledJourneys = reconcileJourneyComponents(asIs, toBe, journeys);
    const errors = validateAlignment(toBe, reconciledJourneys);
    if (errors.length) {
      patch({
        journeys: reconciledJourneys,
        error: errors.slice(0, 3).join(" · "),
      });
      return;
    }
    const snapshot = createMigrationSnapshot({
      asIs,
      toBe,
      journeys: reconciledJourneys,
      architectureVersion,
    });
    patch({
      journeys: reconciledJourneys,
      error: "",
    });
    const runSnapshot = claimExecute(snapshot);
    if (!runSnapshot) return;
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envName,
          legacyRepo,
          legacyRef,
          targetRepo,
          targetRef,
          prompt,
          snapshot: runSnapshot,
          requestKey: `${room.id}:execute:${runSnapshot.id}`,
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start execution");
      }
      patch({ executeAgentId: data.agentId, executeRunId: data.runId });
      attachExecutionRun(data.agentId, data.runId);
      setView("evidence");
    } catch (caught) {
      patch({
        phase: "aligning",
        executeAgentId: "",
        executeRunId: "",
        error: caught instanceof Error ? caught.message : "Execute failed",
      });
    }
  }

  function retryEvaluation() {
    if (!executionSnapshot) return;
    patch({
      phase: "evaluating",
      evaluationAgentId: "",
      evaluationRunId: "",
      evaluationReport: null,
      evaluationVideos: [],
      error: "",
    });
    setView("evidence");
  }

  function retryAnalysis() {
    patch({
      analyzeRunId: "",
      analyzeAgentId:
        phase === "analyzing_target" && isCloudAgentId(analyzeAgentId)
          ? analyzeAgentId
          : "",
      error: "",
    });
  }

  function regenerate() {
    if (
      phase === "analyzing_current" ||
      phase === "analyzing_target" ||
      phase === "executing" ||
      phase === "evaluating"
    ) {
      return;
    }
    patch({
      phase: "analyzing_current",
      asIs: EMPTY_GRAPH,
      toBe: EMPTY_GRAPH,
      journeys: [],
      executionSnapshot: null,
      analyzeAgentId: "",
      analyzeRunId: "",
      executeAgentId: "",
      executeRunId: "",
      evaluationAgentId: "",
      evaluationRunId: "",
      activeComponentIds: [],
      nodeStatus: {},
      workItems: {},
      executionReport: null,
      evaluationReport: null,
      evaluationVideos: [],
      runBranches: [],
      error: "",
    });
    setView("architecture");
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const busy =
    phase === "analyzing_current" ||
    phase === "analyzing_target" ||
    phase === "executing" ||
    phase === "evaluating";
  const locked = busy || phase === "done";

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <BoardChrome
        view={view}
        onViewChange={setView}
        status={
          <div className="flex max-w-md items-center gap-2">
            {error ? (
              <p title={error} className="truncate text-[12px] text-bad">
                {error}
              </p>
            ) : others.length > 0 ? (
              <p className="text-[12px] text-muted">{others.length + 1} here</p>
            ) : (
              <p className="hidden text-[12px] text-muted lg:block">{PHASE_LABEL[phase]}</p>
            )}
            {error && (phase === "analyzing_current" || phase === "analyzing_target") ? (
              <button type="button" onClick={retryAnalysis} className="shrink-0 text-[12px] text-accent">
                Retry
              </button>
            ) : null}
          </div>
        }
        primaryAction={
          phase === "aligning" ? (
            <button
              type="button"
              onClick={() => void execute()}
              className="inline-flex items-center gap-2 rounded-md bg-cta px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-ink"
            >
              Execute plan <span aria-hidden>→</span>
            </button>
          ) : (phase === "done" || phase === "parity_failed") && executionSnapshot ? (
            <button
              type="button"
              onClick={retryEvaluation}
              className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-paper-2"
            >
              Rerun E2E testing
            </button>
          ) : null
        }
        overflow={
          <>
            <BoardOverflowItem onClick={regenerate} disabled={!legacyRepo || busy}>
              Regenerate
            </BoardOverflowItem>
            <BoardOverflowItem
              onClick={retryEvaluation}
              disabled={!executionSnapshot || busy}
            >
              Rerun E2E testing
            </BoardOverflowItem>
            <BoardOverflowItem onClick={() => void copyLink()}>
              {copied ? "Copied" : "Copy link"}
            </BoardOverflowItem>
            <BoardOverflowItem href={`/p/${room.id}`}>
              Open saved view
            </BoardOverflowItem>
            {analyzeAgentId ? (
              <div className="border-t border-line px-3 py-2">
                <AgentIdLink label="Analyze" id={analyzeAgentId} />
              </div>
            ) : null}
            {executeAgentId ? (
              <div className="border-t border-line px-3 py-2">
                <AgentIdLink label="Execute" id={executeAgentId} />
              </div>
            ) : null}
            {evaluationAgentId ? (
              <div className="border-t border-line px-3 py-2">
                <AgentIdLink label="E2E user testing" id={evaluationAgentId} />
              </div>
            ) : null}
          </>
        }
      />

      {!legacyRepo ? (
        <p className="px-4 py-10 text-sm text-muted">
          This board is empty or was not initialized. Start from the home page.
        </p>
      ) : view === "evidence" ? (
        <EvidencePanel
          workItems={workItems}
          report={evaluationReport}
          videos={evaluationVideos}
          evaluationAgentId={evaluationAgentId}
          branches={runBranches}
          journeys={journeys}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ArchitecturePane
            pane="asIs"
            title="Current"
            subtitle="Existing architecture (as-is)"
            graph={asIs}
            selectable
            selectedId={selected?.pane === "asIs" ? selected.id : null}
            nodeStatus={{}}
            collab
            onSelect={(id) => setSelected(id ? { pane: "asIs", id } : null)}
            onMove={(id, x, y) => moveNode("asIs", id, x, y)}
            onCursor={(cursor) => updateMyPresence({ cursor })}
          />
          <div className="w-px bg-line" />
          <ArchitecturePane
            pane="toBe"
            title="Target"
            subtitle="Proposed architecture (to-be)"
            graph={toBe}
            selectable
            selectedId={selected?.pane === "toBe" ? selected.id : null}
            nodeStatus={asNodeStatus(nodeStatus)}
            collab
            onSelect={(id) => setSelected(id ? { pane: "toBe", id } : null)}
            onMove={(id, x, y) => moveNode("toBe", id, x, y)}
            onCursor={(cursor) => updateMyPresence({ cursor })}
          />
          <SpecInspector
            pane={selected?.pane ?? "toBe"}
            selectedId={selected?.id ?? null}
            locked={locked}
            onClose={() => setSelected(null)}
          />
        </div>
      )}
    </div>
  );
}
