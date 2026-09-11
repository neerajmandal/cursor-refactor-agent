import type {
  EvaluationCheck,
  EvaluationReport,
  ExecutionReport,
  JourneyEvaluation,
  NodeStatus,
  RunBranch,
} from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseMarkedJson(text: string, marker: string): Record<string, unknown> | null {
  const expression = new RegExp(
    `${marker}\\s*\\n?\\s*\`\`\`(?:json)?\\s*([\\s\\S]*?)\`\`\``,
    "i",
  );
  const matches = [...text.matchAll(new RegExp(expression.source, "gi"))];
  const raw = matches.at(-1)?.[1];
  if (!raw) return null;
  try {
    return asRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function extractProgress(
  text: string,
  componentIds: string[],
): Record<string, NodeStatus> {
  const known = new Set(componentIds);
  const statuses = Object.fromEntries(
    componentIds.map((id) => [id, "pending" as NodeStatus]),
  );
  const marker =
    /CURAL_STATUS\s+(\{[^\n]*"id"[^\n]*"status"[^\n]*\})/gi;

  for (const match of text.matchAll(marker)) {
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
      // Ignore malformed progress lines; terminal reports remain authoritative.
    }
  }

  return statuses;
}

export function extractExecutionReport(text: string): ExecutionReport | null {
  const record = parseMarkedJson(text, "CURAL_EXECUTION_REPORT");
  if (!record || !Array.isArray(record.components)) return null;

  const components = record.components.flatMap((item) => {
    const value = asRecord(item);
    if (!value) return [];
    const id = typeof value.id === "string" ? value.id.trim() : "";
    const status = value.status;
    if (!id || (status !== "done" && status !== "error")) return [];
    return [{
      id,
      status: status as "done" | "error",
      summary: typeof value.summary === "string" ? value.summary.trim() : "",
    }];
  });
  if (!components.length) return null;

  return {
    status:
      record.status === "passed" &&
      components.every((component) => component.status === "done")
        ? "passed"
        : "failed",
    components,
  };
}

function normalizeCheck(value: unknown): EvaluationCheck | null {
  const record = asRecord(value);
  const status = record?.status;
  if (!record || (status !== "passed" && status !== "failed")) return null;
  return {
    name: typeof record.name === "string" ? record.name : "Unnamed check",
    status,
    legacy: typeof record.legacy === "string" ? record.legacy : "",
    target: typeof record.target === "string" ? record.target : "",
    difference: typeof record.difference === "string" ? record.difference : "",
    evidence: Array.isArray(record.evidence)
      ? record.evidence.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function normalizeJourneyEvaluation(value: unknown): JourneyEvaluation | null {
  const record = asRecord(value);
  const status = record?.status;
  if (
    !record ||
    typeof record.journeyId !== "string" ||
    (status !== "passed" && status !== "failed")
  ) {
    return null;
  }
  return {
    journeyId: record.journeyId,
    status,
    checks: Array.isArray(record.checks)
      ? record.checks.flatMap((item) => {
          const check = normalizeCheck(item);
          return check ? [check] : [];
        })
      : [],
  };
}

export function extractEvaluationReport(text: string): EvaluationReport | null {
  const record = parseMarkedJson(text, "CURAL_EVALUATION_REPORT");
  if (!record || !Array.isArray(record.journeys)) return null;
  const journeys = record.journeys.flatMap((item) => {
    const journey = normalizeJourneyEvaluation(item);
    return journey ? [journey] : [];
  });
  if (!journeys.length) return null;

  return {
    status:
      record.status === "passed" &&
      journeys.every((journey) => journey.status === "passed")
        ? "passed"
        : "failed",
    summary: typeof record.summary === "string" ? record.summary : "",
    journeys,
  };
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
