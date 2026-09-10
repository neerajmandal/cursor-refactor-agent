import type { ComponentSpec } from "@/lib/spec";

export type Phase =
  | "analyzing_current"
  | "analyzing_target"
  | "aligning"
  | "executing"
  | "done";

export type NodeStatus = "pending" | "running" | "done" | "error";

export type GraphNode = {
  id: string;
  label: string;
  kind?: string;
  spec?: string | ComponentSpec;
  x?: number;
  y?: number;
};

export type GraphEdge = {
  from: string;
  to: string;
  label?: string;
};

export type Graph = {
  caption?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type BoardSetup = {
  envName: string;
  legacyRepo: string;
  targetRepo: string;
  prompt: string;
};

export type BoardStorage = BoardSetup & {
  phase: Phase;
  asIs: Graph;
  toBe: Graph;
  analyzeAgentId: string;
  analyzeRunId: string;
  executeAgentId: string;
  executeRunId: string;
  nodeStatus: Record<string, NodeStatus>;
  error: string;
};

export const EMPTY_GRAPH: Graph = { caption: "", nodes: [], edges: [] };

export function isCloudAgentId(id: string | undefined | null): boolean {
  return Boolean(id && id.startsWith("bc-"));
}

export const PHASE_LABEL: Record<Phase, string> = {
  analyzing_current: "Reading current architecture",
  analyzing_target: "Drafting target architecture",
  aligning: "Align on specs",
  executing: "Agents running",
  done: "Done",
};
