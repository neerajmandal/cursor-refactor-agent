import type {
  BoardStorage,
  EvaluationReport,
  EvaluationVideo,
  ExecutionReport,
  Graph,
  ImplementationPlanReport,
  ImplementationReport,
  Journey,
  MigrationSnapshot,
  Phase,
  PhaseStatuses,
  ResearchReport,
  RunBranch,
  WorkflowBlocker,
  WorkflowDocument,
  WorkItem,
} from "@/lib/types";
import { defaultPhaseStatuses, legacyPhase } from "@/lib/workflow";

export type ArtifactKind = "video" | "image" | "file";

export type ArchiveArtifact = {
  id: string;
  refactorId: string;
  kind: ArtifactKind;
  label: string;
  mime: string;
  sizeBytes: number;
  sourcePath: string;
  blobPathname?: string;
};

export type RefactorArchive = {
  id: string;
  createdAt: string;
  updatedAt: string;
  envName: string;
  legacyRepo: string;
  targetRepo: string;
  legacyRef: string;
  targetRef: string;
  prompt: string;
  legacyBaseUrl: string;
  targetBaseUrl: string;
  fixtureCommand: string;
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
  workItems: Record<string, WorkItem>;
  executionReport: ExecutionReport | null;
  evaluationReport: EvaluationReport | null;
  evaluationVideos: EvaluationVideo[];
  runBranches: RunBranch[];
  error: string;
  artifacts: ArchiveArtifact[];
};

export type ArchiveSummary = {
  id: string;
  envName: string;
  legacyRepo: string;
  targetRepo: string;
  prompt: string;
  phase: Phase;
  createdAt: string;
  updatedAt: string;
  evaluationStatus: EvaluationReport["status"] | null;
  verificationStatus: ImplementationReport["status"] | null;
};

export type ArchiveUpsert = Omit<
  RefactorArchive,
  "createdAt" | "updatedAt" | "artifacts"
> & {
  createdAt?: string;
  updatedAt?: string;
  artifacts?: ArchiveArtifact[];
};

export type ArchiveStore = {
  list(): Promise<ArchiveSummary[]>;
  get(id: string): Promise<RefactorArchive | null>;
  remove(id: string): Promise<boolean>;
  upsert(archive: ArchiveUpsert): Promise<RefactorArchive>;
  putArtifact(input: {
    refactorId: string;
    sourcePath: string;
    label: string;
    mime: string;
    body: Buffer;
  }): Promise<ArchiveArtifact>;
  getArtifact(
    refactorId: string,
    sourcePath: string,
  ): Promise<{ buffer: Buffer; contentType: string; label: string } | null>;
};

export function archiveArtifactUrl(refactorId: string, sourcePath: string): string {
  return `/api/archives/${encodeURIComponent(refactorId)}/artifacts?path=${encodeURIComponent(sourcePath)}`;
}

export function artifactKindFor(path: string, mime: string): ArtifactKind {
  if (mime.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(path)) {
    return "video";
  }
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(path)) {
    return "image";
  }
  return "file";
}

export function mimeFromPath(path: string, fallback = "application/octet-stream"): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".md")) return "text/markdown; charset=utf-8";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return fallback;
}

export function sanitizeArtifactPath(path: string): string {
  const trimmed = path.trim().replace(/^\/+/, "");
  if (!trimmed || trimmed.includes("..") || trimmed.startsWith("/")) {
    throw new Error("Invalid artifact path");
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(trimmed)) {
    throw new Error("Invalid artifact path");
  }
  return trimmed;
}

export function summarizeArchive(archive: RefactorArchive): ArchiveSummary {
  return {
    id: archive.id,
    envName: archive.envName,
    legacyRepo: archive.legacyRepo,
    targetRepo: archive.targetRepo,
    prompt: archive.prompt,
    phase: archive.phase,
    createdAt: archive.createdAt,
    updatedAt: archive.updatedAt,
    evaluationStatus: archive.evaluationReport?.status ?? null,
    verificationStatus: archive.implementationReport?.status ?? null,
  };
}

export function archiveFromBoard(
  id: string,
  board: Partial<BoardStorage> & { id?: string },
  previous?: RefactorArchive | null,
): ArchiveUpsert {
  return {
    id,
    createdAt: previous?.createdAt,
    envName: board.envName ?? previous?.envName ?? "",
    legacyRepo: board.legacyRepo ?? previous?.legacyRepo ?? "",
    targetRepo: board.targetRepo ?? previous?.targetRepo ?? "",
    legacyRef: board.legacyRef ?? previous?.legacyRef ?? "",
    targetRef: board.targetRef ?? previous?.targetRef ?? "",
    prompt: board.prompt ?? previous?.prompt ?? "",
    legacyBaseUrl: board.legacyBaseUrl ?? previous?.legacyBaseUrl ?? "",
    targetBaseUrl: board.targetBaseUrl ?? previous?.targetBaseUrl ?? "",
    fixtureCommand: board.fixtureCommand ?? previous?.fixtureCommand ?? "",
    phase: legacyPhase(board.phase ?? previous?.phase),
    phaseStatuses:
      board.phaseStatuses ??
      previous?.phaseStatuses ??
      defaultPhaseStatuses(legacyPhase(board.phase ?? previous?.phase)),
    documents: board.documents ?? previous?.documents ?? {},
    researchReport: board.researchReport ?? previous?.researchReport ?? null,
    implementationPlan:
      board.implementationPlan ?? previous?.implementationPlan ?? null,
    implementationReport:
      board.implementationReport ?? previous?.implementationReport ?? null,
    blockers: board.blockers ?? previous?.blockers ?? [],
    researchAgentId:
      board.researchAgentId ??
      previous?.researchAgentId ??
      board.analyzeAgentId ??
      previous?.analyzeAgentId ??
      "",
    researchRunId:
      board.researchRunId ??
      previous?.researchRunId ??
      board.analyzeRunId ??
      previous?.analyzeRunId ??
      "",
    planAgentId: board.planAgentId ?? previous?.planAgentId ?? "",
    planRunId: board.planRunId ?? previous?.planRunId ?? "",
    implementAgentId:
      board.implementAgentId ??
      previous?.implementAgentId ??
      board.executeAgentId ??
      previous?.executeAgentId ??
      "",
    implementRunId:
      board.implementRunId ??
      previous?.implementRunId ??
      board.executeRunId ??
      previous?.executeRunId ??
      "",
    asIs: board.asIs ?? previous?.asIs ?? { caption: "", nodes: [], edges: [] },
    toBe: board.toBe ?? previous?.toBe ?? { caption: "", nodes: [], edges: [] },
    journeys: board.journeys ?? previous?.journeys ?? [],
    architectureVersion:
      board.architectureVersion ?? previous?.architectureVersion ?? 0,
    executionSnapshot: board.executionSnapshot ?? previous?.executionSnapshot ?? null,
    analyzeAgentId: board.analyzeAgentId ?? previous?.analyzeAgentId ?? "",
    analyzeRunId: board.analyzeRunId ?? previous?.analyzeRunId ?? "",
    executeAgentId: board.executeAgentId ?? previous?.executeAgentId ?? "",
    executeRunId: board.executeRunId ?? previous?.executeRunId ?? "",
    evaluationAgentId: board.evaluationAgentId ?? previous?.evaluationAgentId ?? "",
    evaluationRunId: board.evaluationRunId ?? previous?.evaluationRunId ?? "",
    workItems: board.workItems ?? previous?.workItems ?? {},
    executionReport: board.executionReport ?? previous?.executionReport ?? null,
    evaluationReport: board.evaluationReport ?? previous?.evaluationReport ?? null,
    evaluationVideos: board.evaluationVideos ?? previous?.evaluationVideos ?? [],
    runBranches: board.runBranches ?? previous?.runBranches ?? [],
    error: board.error ?? previous?.error ?? "",
  };
}
