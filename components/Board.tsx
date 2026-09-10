"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useOthers, useRoom, useStorage, useUpdateMyPresence } from "@liveblocks/react/suspense";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { AgentIdLink } from "@/components/AgentIdLink";
import { SpecInspector } from "@/components/SpecInspector";
import {
  EMPTY_GRAPH,
  PHASE_LABEL,
  isCloudAgentId,
  type BoardStorage,
  type Graph,
  type NodeStatus,
  type Phase,
} from "@/lib/types";

type AnalyzeResponse = { agentId?: string; runId?: string; error?: string };
type PollResponse = {
  status?: string;
  graph?: Graph;
  error?: string;
  nodeStatus?: Record<string, NodeStatus>;
};

function asNodeStatus(value: Record<string, unknown> | null | undefined): Record<string, NodeStatus> {
  const next: Record<string, NodeStatus> = {};
  if (!value) return next;
  for (const [key, item] of Object.entries(value)) {
    if (item === "pending" || item === "running" || item === "done" || item === "error") {
      next[key] = item;
    }
  }
  return next;
}

export function Board() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const starting = useRef(false);
  const others = useOthers();
  const room = useRoom();
  const updateMyPresence = useUpdateMyPresence();

  const envName = useStorage((root) => root.envName);
  const legacyRepo = useStorage((root) => root.legacyRepo);
  const targetRepo = useStorage((root) => root.targetRepo);
  const prompt = useStorage((root) => root.prompt);
  const phase = useStorage((root) => root.phase);
  const asIs = useStorage((root) => root.asIs);
  const toBe = useStorage((root) => root.toBe);
  const analyzeAgentId = useStorage((root) => root.analyzeAgentId);
  const analyzeRunId = useStorage((root) => root.analyzeRunId);
  const executeAgentId = useStorage((root) => root.executeAgentId);
  const executeRunId = useStorage((root) => root.executeRunId);
  const nodeStatus = useStorage((root) => root.nodeStatus);
  const error = useStorage((root) => root.error);

  const patch = useMutation(({ storage }, values: Partial<BoardStorage>) => {
    (Object.keys(values) as (keyof BoardStorage)[]).forEach((key) => {
      const value = values[key];
      if (value !== undefined) {
        storage.set(key, value as never);
      }
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
    },
    [],
  );

  const startAsIs = useCallback(async (options?: {
    resumeAgentId?: string;
    regenerate?: boolean;
  }) => {
    if (starting.current || !legacyRepo) return;
    if (!options?.regenerate && analyzeAgentId) return;
    const lockKey = `cural:analyze:${room.id}`;
    if (!options?.regenerate && sessionStorage.getItem(lockKey)) return;
    sessionStorage.setItem(lockKey, "1");
    starting.current = true;
    const resumeId = options?.resumeAgentId;
    patch({ analyzeAgentId: resumeId || "pending", error: "" });
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "as-is",
          envName,
          legacyRepo,
          targetRepo,
          prompt,
          agentId: resumeId || undefined,
          regenerate: Boolean(options?.regenerate),
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start as-is analysis");
      }
      patch({ analyzeAgentId: data.agentId, analyzeRunId: data.runId });
    } catch (err) {
      starting.current = false;
      sessionStorage.removeItem(`cural:analyze:${room.id}`);
      patch({
        analyzeAgentId: resumeId || "",
        error: err instanceof Error ? err.message : "Analyze failed",
        ...(options?.regenerate ? { phase: "aligning" satisfies Phase } : {}),
      });
    }
  }, [analyzeAgentId, envName, legacyRepo, patch, prompt, room.id, targetRepo]);

  const startToBe = useCallback(async () => {
    if (starting.current || !analyzeAgentId || analyzeAgentId === "pending") return;
    const lockKey = `cural:target:${room.id}`;
    if (sessionStorage.getItem(lockKey)) return;
    sessionStorage.setItem(lockKey, "1");
    starting.current = true;
    patch({ error: "" });
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: "to-be",
          envName,
          legacyRepo,
          targetRepo,
          prompt,
          agentId: analyzeAgentId,
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start target analysis");
      }
      patch({ analyzeAgentId: data.agentId, analyzeRunId: data.runId });
    } catch (err) {
      starting.current = false;
      sessionStorage.removeItem(`cural:target:${room.id}`);
      patch({
        error: err instanceof Error ? err.message : "Target analysis failed",
      });
    }
  }, [analyzeAgentId, envName, legacyRepo, patch, prompt, room.id, targetRepo]);

  useEffect(() => {
    if (phase === "analyzing_current" && !analyzeAgentId && legacyRepo) {
      void startAsIs();
    }
  }, [analyzeAgentId, legacyRepo, phase, startAsIs]);

  useEffect(() => {
    if (
      phase === "analyzing_target" &&
      analyzeAgentId &&
      analyzeAgentId !== "pending" &&
      !analyzeRunId
    ) {
      void startToBe();
    }
  }, [analyzeAgentId, analyzeRunId, phase, startToBe]);

  useEffect(() => {
    if (!analyzeAgentId || analyzeAgentId === "pending" || !analyzeRunId) return;
    if (phase !== "analyzing_current" && phase !== "analyzing_target") return;

    let cancelled = false;

    async function poll() {
      const response = await fetch(
        `/api/agents/${analyzeAgentId}?runId=${encodeURIComponent(analyzeRunId)}`,
      );
      const data = (await response.json()) as PollResponse;
      if (cancelled) return;
      if (!response.ok) {
        patch({ error: data.error || "Poll failed" });
        return;
      }
      if (data.status === "running") return;
      if (data.status === "error" || data.status === "cancelled") {
        starting.current = false;
        patch({ error: data.error || `Run ${data.status}` });
        return;
      }
      if (!data.graph) {
        starting.current = false;
        patch({ error: data.error || "No architecture JSON from agent" });
        return;
      }
      starting.current = false;
      if (phase === "analyzing_current") {
        patch({
          asIs: data.graph,
          phase: "analyzing_target" satisfies Phase,
          analyzeRunId: "",
          error: "",
        });
      } else {
        patch({
          toBe: data.graph,
          phase: "aligning" satisfies Phase,
          error: "",
        });
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [analyzeAgentId, analyzeRunId, patch, phase]);

  useEffect(() => {
    if (phase !== "executing" || !executeAgentId || !executeRunId) return;
    let cancelled = false;
    const ids = toBe.nodes.map((node) => node.id).join(",");

    async function poll() {
      const response = await fetch(
        `/api/agents/${executeAgentId}?runId=${encodeURIComponent(executeRunId)}&componentIds=${encodeURIComponent(ids)}`,
      );
      const data = (await response.json()) as PollResponse;
      if (cancelled) return;
      if (data.nodeStatus) {
        patch({ nodeStatus: data.nodeStatus });
      }
      if (data.status === "running") return;
      starting.current = false;
      if (data.status === "error" || data.status === "cancelled") {
        patch({
          phase: "aligning" satisfies Phase,
          error: data.error || `Execute ${data.status}`,
        });
        return;
      }
      patch({ phase: "done" satisfies Phase, error: "" });
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [executeAgentId, executeRunId, patch, phase, toBe.nodes]);

  async function onExecute() {
    if (phase !== "aligning" && phase !== "done") return;
    if (!toBe.nodes.length) return;
    starting.current = true;
    const pending = Object.fromEntries(
      toBe.nodes.map((node) => [node.id, "pending" as const]),
    );
    patch({
      phase: "executing" satisfies Phase,
      nodeStatus: pending,
      error: "",
      executeAgentId: "pending",
    });
    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          envName,
          legacyRepo,
          targetRepo,
          prompt,
          components: toBe.nodes,
        }),
      });
      const data = (await response.json()) as AnalyzeResponse;
      if (!response.ok || !data.agentId || !data.runId) {
        throw new Error(data.error || "Failed to start execution");
      }
      patch({ executeAgentId: data.agentId, executeRunId: data.runId });
    } catch (err) {
      starting.current = false;
      patch({
        phase: "aligning" satisfies Phase,
        executeAgentId: "",
        error: err instanceof Error ? err.message : "Execute failed",
      });
    }
  }

  const canExecute =
    (phase === "aligning" || phase === "done") && toBe.nodes.length > 0;
  const busy =
    phase === "analyzing_current" ||
    phase === "analyzing_target" ||
    phase === "executing";

  async function onRegenerate() {
    if (busy) return;
    sessionStorage.removeItem(`cural:analyze:${room.id}`);
    sessionStorage.removeItem(`cural:target:${room.id}`);
    const keep = isCloudAgentId(analyzeAgentId) ? analyzeAgentId : "";
    patch({
      phase: "analyzing_current" satisfies Phase,
      asIs: EMPTY_GRAPH,
      toBe: EMPTY_GRAPH,
      analyzeRunId: "",
      analyzeAgentId: keep || "pending",
      executeAgentId: "",
      executeRunId: "",
      nodeStatus: {},
      error: "",
    });
    void startAsIs({ resumeAgentId: keep || undefined, regenerate: true });
  }

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-col gap-1 border-b border-line px-4 py-2">
        <div className="flex min-h-8 items-center gap-6">
          <Link href="/" className="font-serif text-xl tracking-tight">
            Cural
          </Link>
          <p className="text-[13px] text-muted">{PHASE_LABEL[phase]}</p>
          {others.length > 0 ? (
            <p className="text-[13px] text-muted">
              {others.length + 1} here
            </p>
          ) : null}
          <div className="ml-auto flex items-center gap-3">
            {error ? <p className="max-w-md truncate text-[12px] text-bad">{error}</p> : null}
            <button
              type="button"
              onClick={() => void onRegenerate()}
              disabled={!legacyRepo || busy}
              className="text-[12px] text-muted hover:text-ink disabled:opacity-40"
            >
              {busy && phase !== "executing" ? "Regenerating" : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="text-[12px] text-muted hover:text-ink"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => void onExecute()}
              disabled={!canExecute}
              className="bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-ink disabled:opacity-40"
            >
              {phase === "executing" ? "Running" : "Execute"}
            </button>
          </div>
        </div>
        {analyzeAgentId || executeAgentId ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <AgentIdLink label="Analyze" id={analyzeAgentId} />
            <AgentIdLink label="Execute" id={executeAgentId} />
          </div>
        ) : null}
      </header>

      {!legacyRepo ? (
        <p className="px-4 py-10 text-sm text-muted">
          This board is empty. Start from the home page.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1">
          <ArchitecturePane
            pane="asIs"
            title="Current"
            graph={asIs}
            selectable={false}
            selectedId={null}
            nodeStatus={{}}
            collab
            onSelect={() => undefined}
            onMove={(id, x, y) => moveNode("asIs", id, x, y)}
            onCursor={(cursor) => updateMyPresence({ cursor })}
          />
          <div className="w-px bg-line" />
          <ArchitecturePane
            pane="toBe"
            title="Target"
            graph={toBe}
            selectable
            selectedId={selectedId}
            nodeStatus={asNodeStatus(nodeStatus)}
            collab
            onSelect={setSelectedId}
            onMove={(id, x, y) => moveNode("toBe", id, x, y)}
            onCursor={(cursor) => updateMyPresence({ cursor })}
          />
          <SpecInspector selectedId={selectedId} onClose={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}
