import type {
  Graph,
  ImplementationPlanReport,
  ImplementationReport,
  NodeStatus,
  ResearchReport,
  RunBranch,
  WorkflowDocument,
} from "@/lib/types";
import {
  failedImplementationGates,
  isImplementationPlan,
  isResearchReport,
} from "@/lib/workflow";

type RecordValue = Record<string, unknown>;

export type ResearchRunResult = {
  graph: Graph;
  report: ResearchReport;
  document: Omit<WorkflowDocument, "agentId" | "runId" | "updatedAt">;
};

export type PlanRunResult = {
  graph: Graph;
  report: ImplementationPlanReport;
  document: Omit<WorkflowDocument, "agentId" | "runId" | "updatedAt">;
};

export type ImplementRunResult = {
  report: ImplementationReport;
  steps: { id: string; status: "done" | "error"; summary: string }[];
  documents: Omit<WorkflowDocument, "agentId" | "runId" | "updatedAt">[];
};

export function redactSecrets(value: string): string {
  return value
    .replace(
      /\b(?:OPENAI_API_KEY|DATABASE_URL)\s*=\s*[^\s]+/gi,
      "[REDACTED_ENV_VALUE]",
    )
    .replace(/\bpostgres(?:ql)?:\/\/[^\s"'<>]+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_OPENAI_KEY]");
}

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

function parseJsonObject(text: string): unknown {
  const start = text.search(/\{/);
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (character === "\\") {
        escape = true;
        continue;
      }
      if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function markedJson(text: string, marker: string): RecordValue | null {
  const index = text.toUpperCase().lastIndexOf(marker.toUpperCase());
  if (index >= 0) {
    const after = text.slice(index + marker.length);
    const fence = after.match(/```(?:json)?\s*([\s\S]*)/i)?.[1];
    const fromFence = asRecord(parseJsonObject(fence ?? ""));
    if (fromFence) return fromFence;
    const fromMarker = asRecord(parseJsonObject(after));
    if (fromMarker) return fromMarker;
  }
  const trimmed = text.trim();
  return trimmed.startsWith("{") ? asRecord(parseJsonObject(trimmed)) : null;
}

function documentValue(
  value: unknown,
): Omit<WorkflowDocument, "agentId" | "runId" | "updatedAt"> | null {
  const record = asRecord(value);
  if (
    !record ||
    typeof record.filename !== "string" ||
    typeof record.artifactPath !== "string" ||
    typeof record.content !== "string" ||
    !record.content.trim()
  ) {
    return null;
  }
  return {
    filename: record.filename,
    artifactPath: record.artifactPath,
    content: redactSecrets(record.content),
  };
}

function researchFromRecord(value: RecordValue | null): ResearchRunResult | null {
  const graph = asRecord(value?.graph) as Graph | null;
  const report = asRecord(value?.report) as ResearchReport | null;
  const document = documentValue(value?.document);
  if (
    !graph ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    !isResearchReport(report) ||
    !document ||
    document.filename !== "research-plan.md"
  ) {
    return null;
  }
  return { graph, report, document };
}

export function extractResearchResult(text: string): ResearchRunResult | null {
  return researchFromRecord(markedJson(text, "CURAL_RESEARCH_REPORT"));
}

export function isStubResearchDocument(content: string): boolean {
  return /see\s+.+\bresearch-plan\.md\b/i.test(content);
}

export function isStubPlanDocument(content: string): boolean {
  return /see\s+.+\bimplementation-plan\.md\b/i.test(content);
}

function withHostVerifyQuestions(
  report: ImplementationPlanReport | null,
  research: ResearchReport,
): ImplementationPlanReport | null {
  if (!report || !asRecord(report.verify) || !isResearchReport(research)) {
    return null;
  }
  const [first, second] = research.questions;
  return {
    ...report,
    verify: {
      ...report.verify,
      questions: [
        { question: first.question, legacyAnswer: first.legacyAnswer },
        { question: second.question, legacyAnswer: second.legacyAnswer },
      ],
    },
  };
}

export function extractPlanResult(
  text: string,
  research: ResearchReport,
): PlanRunResult | null {
  const value = markedJson(text, "CURAL_PLAN_REPORT");
  const graph = asRecord(value?.graph) as Graph | null;
  const report = withHostVerifyQuestions(
    asRecord(value?.report) as ImplementationPlanReport | null,
    research,
  );
  const document = documentValue(value?.document);
  if (
    !graph ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.edges) ||
    !isImplementationPlan(report, research) ||
    !document ||
    document.filename !== "implementation-plan.md"
  ) {
    return null;
  }
  return { graph, report, document };
}

export function extractImplementationResult(
  text: string,
  plan: ImplementationPlanReport,
): ImplementRunResult | null {
  const value = markedJson(text, "CURAL_IMPLEMENTATION_REPORT");
  if (!value) return null;
  const observations = Array.isArray(value.observations)
    ? value.observations
    : [];
  const recording = asRecord(value.recording);
  const branch = asRecord(value.targetBranch);
  const report: ImplementationReport = {
    status: value.status === "passed" ? "passed" : "failed",
    summary:
      typeof value.summary === "string" ? redactSecrets(value.summary) : "",
    testCycles:
      typeof value.testCycles === "number" && Number.isInteger(value.testCycles)
        ? value.testCycles
        : 0,
    observations: observations.map((item) => {
      const record = asRecord(item) ?? {};
      return {
        question: String(record.question ?? ""),
        legacyAnswer: redactSecrets(String(record.legacyAnswer ?? "")),
        modernAnswer: redactSecrets(String(record.modernAnswer ?? "")),
        evidence: Array.isArray(record.evidence)
          ? record.evidence
              .filter((evidence): evidence is string => typeof evidence === "string")
              .map(redactSecrets)
          : [],
      };
    }) as ImplementationReport["observations"],
    openAiEvidence: Array.isArray(value.openAiEvidence)
      ? value.openAiEvidence
          .filter((item): item is string => typeof item === "string")
          .map(redactSecrets)
      : [],
    neonEvidence: Array.isArray(value.neonEvidence)
      ? value.neonEvidence
          .filter((item): item is string => typeof item === "string")
          .map(redactSecrets)
      : [],
    recording:
      recording && typeof recording.path === "string"
        ? {
            path: recording.path,
            label:
              typeof recording.label === "string"
                ? recording.label
                : "Modern UI verification",
          }
        : null,
    targetBranch: {
      name: typeof branch?.name === "string" ? branch.name : "",
      commit: typeof branch?.commit === "string" ? branch.commit : "",
      pushed: branch?.pushed === true,
    },
  };
  const steps = Array.isArray(value.steps)
    ? value.steps.flatMap((item) => {
        const record = asRecord(item);
        if (
          !record ||
          typeof record.id !== "string" ||
          (record.status !== "done" && record.status !== "error")
        ) {
          return [];
        }
        return [{
          id: record.id,
          status: record.status as "done" | "error",
          summary:
            typeof record.summary === "string"
              ? redactSecrets(record.summary)
              : "",
        }];
      })
    : [];
  const documents = Array.isArray(value.documents)
    ? value.documents.flatMap((item) => {
        const document = documentValue(item);
        return document ? [document] : [];
      })
    : [];

  const planSteps = plan.phases.flatMap((phase) => phase.steps);
  const stepStatus = new Map(steps.map((step) => [step.id, step.status]));
  const validatedPlan: ImplementationPlanReport = {
    ...plan,
    phases: plan.phases.map((phase) => ({
      ...phase,
      steps: phase.steps.map((step) => ({
        ...step,
        status: (stepStatus.get(step.id) ?? "error") as NodeStatus,
      })),
    })),
  };
  if (
    documents.length < 2 ||
    report.testCycles < 1 ||
    report.testCycles > 3 ||
    steps.length !== planSteps.length ||
    failedImplementationGates(report, validatedPlan).length
  ) {
    report.status = "failed";
  }
  return { report, steps, documents };
}

export function extractProgress(
  text: string,
  stepIds: string[],
): Record<string, NodeStatus> {
  const known = new Set(stepIds);
  const statuses = Object.fromEntries(
    stepIds.map((id) => [id, "pending" as NodeStatus]),
  );
  for (const match of text.matchAll(
    /CURAL_STEP_STATUS\s+(\{[^\n]*"id"[^\n]*"status"[^\n]*\})/gi,
  )) {
    try {
      const value = asRecord(JSON.parse(match[1]));
      const id = typeof value?.id === "string" ? value.id : "";
      const status = value?.status;
      if (
        known.has(id) &&
        (status === "pending" ||
          status === "running" ||
          status === "done" ||
          status === "error")
      ) {
        statuses[id] = status;
      }
    } catch {
      // Malformed progress lines are ignored; the terminal report is authoritative.
    }
  }
  return statuses;
}

export function isVideoArtifactPath(path: string): boolean {
  return /\.(mp4|webm|mov|m4v)$/i.test(path);
}

export function runBranches(value: unknown): RunBranch[] {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.branches)) return [];
  return record.branches.flatMap((item) => {
    const branch = asRecord(item);
    if (!branch || typeof branch.repoUrl !== "string") return [];
    return [{
      repoUrl: branch.repoUrl,
      branch: typeof branch.branch === "string" ? branch.branch : undefined,
      prUrl: typeof branch.prUrl === "string" ? branch.prUrl : undefined,
    }];
  });
}

export function videoContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v")) return "video/x-m4v";
  return "video/mp4";
}
