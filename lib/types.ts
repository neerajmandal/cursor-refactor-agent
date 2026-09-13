import type { ComponentSpec } from "@/lib/spec";

export type Phase = "research" | "plan" | "implement";

export type PhaseStatus = "pending" | "running" | "ready" | "blocked" | "complete";

export type PhaseStatuses = Record<Phase, PhaseStatus>;

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

export type WorkflowDocument = {
  filename: string;
  content: string;
  artifactPath: string;
  agentId: string;
  runId: string;
  updatedAt: string;
};

export type ResearchQuestion = {
  question: string;
  legacyAnswer: string;
  generation: string;
  display: string;
  storage: string;
  evidence: string[];
};

export type ResearchFinding = {
  id: string;
  title: string;
  summary: string;
  componentIds: string[];
  evidence: string[];
};

export type ResearchReport = {
  goal: string;
  scope: string;
  requestFlow: string[];
  findings: ResearchFinding[];
  questions: [ResearchQuestion, ResearchQuestion];
  risks: string[];
  openQuestions: string[];
};

export type ComponentDecision = {
  componentId: string;
  action: "retain" | "replace" | "remove" | "introduce";
  rationale: string;
};

export type ImplementationStep = {
  id: string;
  title: string;
  changes: string;
  componentIds: string[];
  dependsOn: string[];
  doneWhen: string[];
  status: NodeStatus;
  summary?: string;
};

export type ImplementationPhase = {
  id: string;
  title: string;
  steps: ImplementationStep[];
};

export type VerifyPlan = {
  questions: [Pick<ResearchQuestion, "question" | "legacyAnswer">, Pick<ResearchQuestion, "question" | "legacyAnswer">];
  instructions: string[];
  successCriteria: string[];
};

export type ImplementationPlanReport = {
  architectureReasoning: string;
  decisions: ComponentDecision[];
  phases: ImplementationPhase[];
  verify: VerifyPlan;
};

export type VerificationObservation = {
  question: string;
  legacyAnswer: string;
  modernAnswer: string;
  evidence: string[];
};

export type ImplementationReport = {
  status: "passed" | "failed";
  summary: string;
  testCycles: number;
  observations: [VerificationObservation, VerificationObservation];
  openAiEvidence: string[];
  neonEvidence: string[];
  recording: EvaluationVideo | null;
  targetBranch: {
    name: string;
    commit: string;
    pushed: boolean;
  };
};

export type WorkflowBlocker = {
  id: string;
  phase: Phase;
  message: string;
  resolution?: string;
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
  /** Orchestrator-assigned target branch for execute (implement until the goal holds). */
  executionBranch: string;
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
  targetBranch: {
    name: string;
    commit: string;
    pushed: boolean;
  };
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
  testCycles: number;
  journeys: JourneyEvaluation[];
  videos: EvaluationVideo[];
};

export type BoardStorage = BoardSetup & {
  extraPrompt: string;
  phase: Phase;
  phaseStatuses: PhaseStatuses;
  documents: Record<string, WorkflowDocument>;
  researchReport: ResearchReport | null;
  implementationPlan: ImplementationPlanReport | null;
  implementationReport: ImplementationReport | null;
  blockers: WorkflowBlocker[];
  researchAgentId: string;
  researchRunId: string;
  planAgentId: string;
  planRunId: string;
  implementAgentId: string;
  implementRunId: string;
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
    extraPrompt: "",
    phase: "research",
    phaseStatuses: {
      research: "running",
      plan: "pending",
      implement: "pending",
    },
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

export const RECOVER_RUN_ID = "recover";

export function isCloudAgentId(id: string | undefined | null): boolean {
  return Boolean(id && id.startsWith("bc-"));
}

export const PHASE_LABEL: Record<Phase, string> = {
  research: "Research legacy application",
  plan: "Define implementation plan",
  implement: "Implement and verify",
};
