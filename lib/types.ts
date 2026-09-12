import type { ComponentSpec } from "@/lib/spec";

export type Phase =
  | "analyzing_current"
  | "analyzing_target"
  | "aligning"
  | "executing"
  | "evaluating"
  | "parity_failed"
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
  legacyRef: string;
  targetRef: string;
  prompt: string;
  legacyBaseUrl: string;
  targetBaseUrl: string;
  fixtureCommand: string;
};

export type Journey = {
  id: string;
  title: string;
  actor: string;
  preconditions: string[];
  steps: string[];
  outcomes: string[];
  fixtures: string[];
  normalizationRules: string[];
  componentIds: string[];
  sourceEvidence: string[];
  required: boolean;
};

export type MigrationSnapshot = {
  id: string;
  createdAt: string;
  architectureVersion: number;
  asIs: Graph;
  toBe: Graph;
  journeys: Journey[];
};

export type WorkItem = {
  componentId: string;
  label: string;
  status: NodeStatus;
  attempts: number;
  specSnapshot: ComponentSpec;
  dependsOn: string[];
  agentId: string;
  runId: string;
  branches: RunBranch[];
  summary: string;
};

export type RunBranch = {
  repoUrl: string;
  branch?: string;
  prUrl?: string;
};

export type ExecutionReport = {
  status: "passed" | "failed";
  components: {
    id: string;
    status: "done" | "error";
    summary: string;
  }[];
};

export type EvaluationCheck = {
  name: string;
  status: "passed" | "failed";
  legacy: string;
  target: string;
  difference: string;
  evidence: string[];
};

export type JourneyEvaluation = {
  journeyId: string;
  status: "passed" | "failed";
  checks: EvaluationCheck[];
};

export type EvaluationVideo = {
  path: string;
  label: string;
  journeyId?: string;
  sizeBytes?: number;
  updatedAt?: string;
  /** Direct URL for preview/demo; live runs proxy via the evaluation agent. */
  url?: string;
};

export type EvaluationReport = {
  status: "passed" | "failed";
  summary: string;
  journeys: JourneyEvaluation[];
  videos: EvaluationVideo[];
};

export type BoardStorage = BoardSetup & {
  phase: Phase;
  asIs: Graph;
  toBe: Graph;
  journeys: Journey[];
  architectureVersion: number;
  executionSnapshot: MigrationSnapshot | null;
  analyzeAgentId: string;
  analyzeRunId: string;
  executeAgentId: string;
  executeRunId: string;
  evaluationAgentId: string;
  evaluationRunId: string;
  activeComponentIds: string[];
  nodeStatus: Record<string, NodeStatus>;
  workItems: Record<string, WorkItem>;
  executionReport: ExecutionReport | null;
  evaluationReport: EvaluationReport | null;
  evaluationVideos: EvaluationVideo[];
  runBranches: RunBranch[];
  error: string;
};

export const EMPTY_GRAPH: Graph = { caption: "", nodes: [], edges: [] };

export const EMPTY_SETUP: BoardSetup = {
  envName: "",
  legacyRepo: "",
  targetRepo: "",
  legacyRef: "",
  targetRef: "",
  prompt: "",
  legacyBaseUrl: "",
  targetBaseUrl: "",
  fixtureCommand: "",
};

export function createInitialBoardStorage(
  setup: Partial<BoardSetup> = {},
): BoardStorage {
  return {
    ...EMPTY_SETUP,
    ...setup,
    phase: "analyzing_current",
    asIs: EMPTY_GRAPH,
    toBe: EMPTY_GRAPH,
    journeys: [],
    architectureVersion: 0,
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
  };
}

export function isCloudAgentId(id: string | undefined | null): boolean {
  return Boolean(id && id.startsWith("bc-"));
}

export const PHASE_LABEL: Record<Phase, string> = {
  analyzing_current: "Reading current architecture",
  analyzing_target: "Drafting target architecture",
  aligning: "Align on specs",
  executing: "Agents running",
  evaluating: "End-to-end user testing",
  parity_failed: "E2E user testing needs work",
  done: "E2E user testing passed",
};
