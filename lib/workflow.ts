import {
  EMPTY_GRAPH,
  type Graph,
  type ImplementationPlanReport,
  type ImplementationReport,
  type Phase,
  type PhaseStatuses,
  type ResearchReport,
} from "@/lib/types";

export const WORKFLOW_PHASES: Phase[] = ["research", "plan", "implement"];

export const WORKFLOW_DOCUMENTS = [
  "research-plan.md",
  "implementation-plan.md",
  "implementation-summary.md",
  "verification-report.md",
] as const;

export function legacyPhase(value: unknown): Phase {
  if (value === "plan" || value === "aligning" || value === "analyzing_target") {
    return "plan";
  }
  if (
    value === "implement" ||
    value === "executing" ||
    value === "evaluating" ||
    value === "parity_failed" ||
    value === "done"
  ) {
    return "implement";
  }
  return "research";
}

export function defaultPhaseStatuses(
  phase: Phase = "research",
  complete = false,
): PhaseStatuses {
  if (complete) {
    return { research: "complete", plan: "complete", implement: "complete" };
  }
  if (phase === "implement") {
    return { research: "complete", plan: "complete", implement: "running" };
  }
  if (phase === "plan") {
    return { research: "complete", plan: "running", implement: "pending" };
  }
  return { research: "running", plan: "pending", implement: "pending" };
}

export function isResearchReport(value: ResearchReport | null): value is ResearchReport {
  return Boolean(
    value &&
      value.goal.trim() &&
      value.scope.trim() &&
      value.questions.length === 2 &&
      value.questions.every(
        (item) => item.question.trim() && item.legacyAnswer.trim(),
      ),
  );
}

export function isImplementationPlan(
  value: ImplementationPlanReport | null,
  research: ResearchReport | null,
): value is ImplementationPlanReport {
  if (!value || !isResearchReport(research) || !value.phases.length) return false;
  const expected = research.questions.map((item) => ({
    question: item.question,
    legacyAnswer: item.legacyAnswer,
  }));
  if (JSON.stringify(value.verify.questions) !== JSON.stringify(expected)) return false;
  const steps = value.phases.flatMap((phase) => phase.steps);
  const ids = new Set(steps.map((step) => step.id));
  return Boolean(
    steps.length &&
      ids.size === steps.length &&
      steps.every(
        (step) =>
          step.title.trim() &&
          step.changes.trim() &&
          step.doneWhen.length &&
          step.dependsOn.every((id) => ids.has(id)),
      ),
  );
}

export function failedImplementationGates(
  report: ImplementationReport | null,
  plan: ImplementationPlanReport | null,
): string[] {
  if (!report || !plan) return ["Implementation report"];
  const failures: string[] = [];
  const questions = plan.verify.questions.map((item) => item.question);
  if (report.status !== "passed") failures.push("Verification report");
  if (
    report.observations.length !== 2 ||
    !report.observations.every(
      (item, index) =>
        item.question === questions[index] &&
        item.modernAnswer.trim() &&
        item.evidence.length,
    )
  ) {
    failures.push("Modern UI question-and-answer proof");
  }
  if (
    report.openAiEvidence.filter((item) =>
      /(resp[_-]|chatcmpl-|response\s*id|openai)/i.test(item),
    ).length < 2
  ) {
    failures.push("Two OpenAI response proofs");
  }
  const neon = report.neonEvidence.join("\n").toLowerCase();
  if (
    !report.neonEvidence.some((item) => /\bep-[a-z0-9-]+\b/i.test(item)) ||
    !questions.every((question) => neon.includes(question.toLowerCase()))
  ) {
    failures.push("Neon rows for both questions");
  }
  if (!report.recording?.path || !/\.(mp4|webm|mov|m4v)$/i.test(report.recording.path)) {
    failures.push("Computer-use recording");
  }
  if (
    !report.targetBranch.pushed ||
    !report.targetBranch.name.startsWith("cural/exec-") ||
    !/^[0-9a-f]{7,40}$/i.test(report.targetBranch.commit)
  ) {
    failures.push("Pushed implementation branch");
  }
  const steps = plan.phases.flatMap((phase) => phase.steps);
  if (steps.some((step) => step.status !== "done")) {
    failures.push("All implementation steps");
  }
  return failures;
}

export function canCreatePlan(
  report: ResearchReport | null,
  documentContent: string | undefined,
): boolean {
  return isResearchReport(report) && Boolean(documentContent?.trim());
}

export function canApprovePlan(
  plan: ImplementationPlanReport | null,
  research: ResearchReport | null,
  documentContent: string | undefined,
): boolean {
  return (
    isImplementationPlan(plan, research) &&
    Boolean(documentContent?.trim())
  );
}

export function graphOrEmpty(value: unknown): Graph {
  if (!value || typeof value !== "object") return EMPTY_GRAPH;
  const graph = value as Partial<Graph>;
  return Array.isArray(graph.nodes) && Array.isArray(graph.edges)
    ? { caption: graph.caption ?? "", nodes: graph.nodes, edges: graph.edges }
    : EMPTY_GRAPH;
}
