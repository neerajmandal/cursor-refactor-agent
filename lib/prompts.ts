import { formatExecutionTree, executionPlan } from "@/lib/execution";
import type {
  GraphNode,
  ImplementationPlanReport,
  MigrationSnapshot,
  ResearchReport,
} from "@/lib/types";

export const OPENAI_GOAL_CHECK = "Questions sent via OpenAI";
export const NEON_GOAL_CHECK = "Answers persisted in Neon";
export const MAX_PROOF_CYCLES = 3;

const SPEC_SHAPE = `{
  "purpose": "What this component does",
  "interface": "Public routes, types, or functions",
  "owns": "Files or modules it owns",
  "dependsOn": "Neighboring components",
  "portFrom": "Relevant legacy files or symbols",
  "outOfScope": "What it must not build",
  "doneWhen": "Concrete completion checks"
}`;

const GRAPH_RULES = `Keep the diagram focused: 5–9 components on a clean top-to-bottom request path. Use stable kebab-case IDs. Every edge must reference an existing node. Put detail in component specs and findings, not labels.`;

export function researchPrompt(input: {
  legacyRepo: string;
  legacyRef?: string;
  legacyBaseUrl?: string;
  prompt: string;
}): string {
  return `You are the Research agent for Cural. Understand and document the legacy application without modifying it.

Legacy repository: ${input.legacyRepo}${input.legacyRef ? ` at ${input.legacyRef}` : ""}
Legacy application URL: ${input.legacyBaseUrl || "Start the application using its documented commands."}
Refactoring goal:
${input.prompt}

Required work
1. Inspect the repository to identify components, dependencies, integrations, data stores, and the main question request flow.
2. Use Cursor computer use in the visible browser UI. Choose exactly two representative questions grounded in the application's domain, type and submit each question through the legacy UI, and capture the exact visible question and answer text. Direct API calls do not count.
3. Trace how each submitted question moves from UI to API through processing, generation, display, and storage. Cite concrete files, symbols, logs, database evidence, or screenshots.
4. Write artifacts/research-plan.md with: refactoring goal and scope; legacy architecture and component responsibilities; request flow; the exact two questions and answers; generation/display/storage details; evidence; risks; open questions.
5. Do not create a branch, edit the legacy repository, propose target architecture, or implement code.

${GRAPH_RULES}
Each graph node must use this spec shape:
${SPEC_SHAPE}

End with exactly one marked JSON block. Put the fence immediately after the marker. Also write the same object to artifacts/cural-research-report.json so the host can recover if the chat block is truncated.
CURAL_RESEARCH_REPORT
\`\`\`json
{
  "document": {
    "filename": "research-plan.md",
    "artifactPath": "artifacts/research-plan.md",
    "content": "Complete Markdown content"
  },
  "graph": {
    "caption": "One-sentence request flow",
    "nodes": [{ "id": "component-id", "label": "Component", "kind": "app|service|db|external|job|lib", "spec": ${SPEC_SHAPE} }],
    "edges": [{ "from": "component-id", "to": "component-id", "label": "optional" }]
  },
  "report": {
    "goal": "Refactoring goal",
    "scope": "Research scope",
    "requestFlow": ["Ordered runtime step"],
    "findings": [{
      "id": "finding-id",
      "title": "Finding",
      "summary": "What was learned",
      "componentIds": ["component-id"],
      "evidence": ["path/to/file:Symbol or artifact path"]
    }],
    "questions": [
      {
        "question": "Exact first submitted question",
        "legacyAnswer": "Exact visible answer",
        "generation": "How it was generated",
        "display": "How it was displayed",
        "storage": "How/where it was stored, or not stored",
        "evidence": ["Concrete evidence"]
      },
      {
        "question": "Exact second submitted question",
        "legacyAnswer": "Exact visible answer",
        "generation": "How it was generated",
        "display": "How it was displayed",
        "storage": "How/where it was stored, or not stored",
        "evidence": ["Concrete evidence"]
      }
    ],
    "risks": ["Risk"],
    "openQuestions": ["Open question"]
  }
}
\`\`\``;
}

export function planPrompt(input: {
  legacyRepo: string;
  targetRepo: string;
  prompt: string;
  research: ResearchReport;
  researchDocument: string;
}): string {
  return `You are the Plan agent for Cural. Define the target architecture and a concrete implementation plan. Do not modify either repository.

Legacy repository: ${input.legacyRepo}
Target repository: ${input.targetRepo}
Refactoring goal:
${input.prompt}

Authoritative research-plan.md:
--- BEGIN RESEARCH PLAN ---
${input.researchDocument}
--- END RESEARCH PLAN ---

Structured research observations:
${JSON.stringify(input.research, null, 2)}

Required work
1. Design the intended target architecture and explain the reasoning.
2. Identify components to retain, replace, remove, or introduce.
3. Break implementation into ordered phases containing small steps. Every step must name its changes, affected component IDs, step dependencies, and concrete done conditions.
4. Finish with a Verify phase. Copy the exact two questions and exact legacy answers below into that section:
${input.research.questions
  .map(
    (item, index) =>
      `${index + 1}. Question: ${item.question}\n   Legacy answer: ${item.legacyAnswer}`,
  )
  .join("\n")}
5. Verification must use computer use to submit those questions through the modern UI so they reach the modern API, capture the new answers, record the interaction, prove two OpenAI calls, and prove both question/answer rows were persisted in Neon.
6. Define success from the intended modern behavior. Legacy answers are context only and must not be used as parity expectations.
7. Write artifacts/implementation-plan.md with the complete plan.

${GRAPH_RULES}
Each target node must use this spec shape:
${SPEC_SHAPE}

End with exactly one marked JSON block. Put the fence immediately after the marker. Also write the same object to artifacts/cural-plan-report.json so the host can recover if the chat block is truncated.
CURAL_PLAN_REPORT
\`\`\`json
{
  "document": {
    "filename": "implementation-plan.md",
    "artifactPath": "artifacts/implementation-plan.md",
    "content": "Complete Markdown content"
  },
  "graph": {
    "caption": "One-sentence target request flow",
    "nodes": [{ "id": "component-id", "label": "Component", "kind": "app|service|db|external|lib", "spec": ${SPEC_SHAPE} }],
    "edges": [{ "from": "component-id", "to": "component-id", "label": "optional" }]
  },
  "report": {
    "architectureReasoning": "Why this architecture",
    "decisions": [{ "componentId": "component-id", "action": "retain|replace|remove|introduce", "rationale": "Reason" }],
    "phases": [{
      "id": "phase-id",
      "title": "Implementation phase",
      "steps": [{
        "id": "step-id",
        "title": "Small actionable step",
        "changes": "What changes",
        "componentIds": ["component-id"],
        "dependsOn": ["earlier-step-id"],
        "doneWhen": ["Testable completion condition"],
        "status": "pending"
      }]
    }],
    "verify": {
      "questions": ${JSON.stringify(
        input.research.questions.map(({ question, legacyAnswer }) => ({
          question,
          legacyAnswer,
        })),
        null,
        2,
      )},
      "instructions": ["Modern UI and API verification instruction"],
      "successCriteria": ["Intended modern behavior criterion", "Two OpenAI responses", "Both rows persisted in Neon", "Computer-use recording saved"]
    }
  }
}
\`\`\``;
}

export function implementPrompt(input: {
  legacyRepo: string;
  legacyRef?: string;
  targetRepo: string;
  targetRef?: string;
  executionBranch: string;
  prompt: string;
  plan: ImplementationPlanReport;
  planDocument: string;
  components: GraphNode[];
  snapshot?: MigrationSnapshot;
  targetBaseUrl?: string;
  fixtureCommand?: string;
}): string {
  const graph = input.snapshot?.toBe ?? { nodes: input.components, edges: [] };
  const tree = executionPlan(graph);
  const baseRef = input.targetRef?.trim() || "the default branch";
  const questions = input.plan.verify.questions;

  return `You are the Implement agent for Cural. Execute the approved implementation plan in order and verify the modern application.

Read-only legacy reference: ${input.legacyRepo}${input.legacyRef ? ` at ${input.legacyRef}` : ""}
Target repository: ${input.targetRepo}
Target base ref: ${baseRef}
Orchestrator-assigned branch: ${input.executionBranch}
Modern application URL: ${input.targetBaseUrl || "Start it using the target repository documentation."}
Fixture/reset command: ${input.fixtureCommand || "Use the target repository's documented reset command if needed."}

Refactoring goal:
${input.prompt}

Approved implementation-plan.md:
--- BEGIN IMPLEMENTATION PLAN ---
${input.planDocument}
--- END IMPLEMENTATION PLAN ---

Structured plan:
${JSON.stringify(input.plan, null, 2)}

Target component tree:
${formatExecutionTree(tree)}

Hard requirements
- DATABASE_URL and OPENAI_API_KEY must already exist. Do not print their values.
- DATABASE_URL must identify Neon Postgres. Use its default database; do not create a separate branch or use a local/file/in-memory fallback.
- Verify the target origin, create ${input.executionBranch} from ${baseRef}, publish it immediately, and only commit/push there.
- Execute every approved phase and step in dependency order. Emit CURAL_STEP_STATUS for each transition.
- After implementation, run repository checks and start the modern app.
- Use Cursor computer use through the visible modern UI. Submit exactly these two questions:
${questions.map((item, index) => `${index + 1}. ${item.question}`).join("\n")}
- Both submissions must travel through the modern API, produce visible non-empty new answers, call live OpenAI, and persist the exact question/answer rows in Neon.
- Record the complete modern UI verification and save it as artifacts/modern-ui-verification.mp4 (or .webm).
- Inspect code, logs, and Neon only as supporting proof. They cannot replace the recorded UI interaction.
- Do not reopen or test the legacy UI. Do not compare modern answers with legacy answers. The legacy answers in the plan are context only.
- If a modern behavior gate fails, repair and rerun the modern verification, up to ${MAX_PROOF_CYCLES} cycles.
- Write artifacts/implementation-summary.md and artifacts/verification-report.md.
- Run git ls-remote against the target origin and report the pushed branch commit. Open a PR only after every gate passes.

End with exactly one marked JSON block:
CURAL_IMPLEMENTATION_REPORT
\`\`\`json
{
  "status": "passed|failed",
  "summary": "Implementation and verification result",
  "testCycles": 1,
  "steps": [{ "id": "exact-plan-step-id", "status": "done|error", "summary": "Result" }],
  "observations": [
    {
      "question": ${JSON.stringify(questions[0]?.question ?? "")},
      "legacyAnswer": ${JSON.stringify(questions[0]?.legacyAnswer ?? "")},
      "modernAnswer": "Exact visible modern answer",
      "evidence": ["artifacts/modern-ui-verification.mp4"]
    },
    {
      "question": ${JSON.stringify(questions[1]?.question ?? "")},
      "legacyAnswer": ${JSON.stringify(questions[1]?.legacyAnswer ?? "")},
      "modernAnswer": "Exact visible modern answer",
      "evidence": ["artifacts/modern-ui-verification.mp4"]
    }
  ],
  "openAiEvidence": ["response id for question one", "response id for question two"],
  "neonEvidence": ["redacted endpoint ep-example", "row containing exact question one", "row containing exact question two"],
  "recording": { "path": "artifacts/modern-ui-verification.mp4", "label": "Modern UI verification" },
  "targetBranch": { "name": "${input.executionBranch}", "commit": "pushed commit SHA", "pushed": true },
  "documents": [
    { "filename": "implementation-summary.md", "artifactPath": "artifacts/implementation-summary.md", "content": "Complete Markdown content" },
    { "filename": "verification-report.md", "artifactPath": "artifacts/verification-report.md", "content": "Complete Markdown content" }
  ]
}
\`\`\`

Report passed only if every plan step, repository check, modern UI/API submission, OpenAI proof, Neon proof, pushed branch, and recording passes.`;
}

// Compatibility for callers/tests while the public terminology transitions.
export function asIsPrompt(legacyRepo: string): string {
  return researchPrompt({ legacyRepo, prompt: "Document the legacy application." });
}

export function toBePrompt(
  legacyRepo: string,
  targetRepo: string,
  prompt: string,
): string {
  return `Use planPrompt with a completed research report. Legacy: ${legacyRepo}. Target: ${targetRepo}. Goal: ${prompt}.`;
}

export function executePrompt(input: {
  legacyRepo: string;
  legacyRef?: string;
  targetRepo: string;
  targetRef?: string;
  executionBranch: string;
  prompt: string;
  components: GraphNode[];
  snapshot?: MigrationSnapshot;
  targetBaseUrl?: string;
  fixtureCommand?: string;
  plan?: ImplementationPlanReport;
}): string {
  const questions = [
    { question: "Question one", legacyAnswer: "Legacy context one" },
    { question: "Question two", legacyAnswer: "Legacy context two" },
  ] as const;
  const plan =
    input.plan ??
    ({
      architectureReasoning: "Approved target architecture",
      decisions: [],
      phases: [],
      verify: {
        questions: [...questions],
        instructions: [],
        successCriteria: [],
      },
    } as ImplementationPlanReport);
  return implementPrompt({
    ...input,
    plan,
    planDocument: "# Implementation plan",
  });
}

export function operatorNotes(extraPrompt?: string): string {
  const notes = extraPrompt?.trim();
  return notes ? `\nOperator notes:\n${notes}` : "";
}
