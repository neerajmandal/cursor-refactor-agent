import {
  attachedSpec,
  executionPlan,
  formatExecutionTree,
  type ExecutionPlan,
} from "@/lib/execution";
import type { ComponentRef } from "@/lib/graph";
import type {
  Graph,
  GraphNode,
  Journey,
  MigrationSnapshot,
} from "@/lib/types";

const SPEC_SHAPE = `{
      "purpose": "1-2 sentences, max 40 words. What this component is for. No flow, files, or retries.",
      "interface": "public types, functions, or HTTP routes only; one per line, max 4",
      "owns": "target files or modules only; max 4 short lines",
      "dependsOn": "neighbor components to call; max 4 short lines",
      "portFrom": "legacy files or symbols; max 4 short lines",
      "outOfScope": "what this subagent must not build; max 3 short lines",
      "doneWhen": "3-4 short testable checks, one per line"
    }`;

export const SAMPLE_UI_QUESTIONS = [
  "What does HelloDrive fault code FO48 mean?",
  "How do I clear a HelloDrive FO48 fault and get the line running again?",
] as const;

export const MODERN_UI_RULE =
  "Copy the legacy app UI into the modern app so a user can ask questions the same way. Keep the same screens, input, and submit flow. Add a visible V2 label in the modern UI (title or header) so testers can tell the two apps apart.";

export const OPENAI_GOAL_CHECK = "Questions sent via OpenAI";
export const NEON_GOAL_CHECK = "Answers persisted in Neon";
export const MAX_PROOF_CYCLES = 3;
const DEFAULT_MODERN_NEON_TARGET = {
  branchName: "modern",
  branchId: "br-dawn-night-aklu9v95",
  endpointId: "ep-flat-cake-akxv2lu8",
} as const;

export function modernNeonTarget(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): {
  branchName: string;
  branchId: string;
  endpointId: string;
} {
  return {
    branchName:
      environment.CURAL_MODERN_NEON_BRANCH?.trim() ||
      DEFAULT_MODERN_NEON_TARGET.branchName,
    branchId:
      environment.CURAL_MODERN_NEON_BRANCH_ID?.trim() ||
      DEFAULT_MODERN_NEON_TARGET.branchId,
    endpointId:
      environment.CURAL_MODERN_NEON_ENDPOINT_ID?.trim() ||
      DEFAULT_MODERN_NEON_TARGET.endpointId,
  };
}

const TREE_DIAGRAM_RULES = `Diagram rules — a talk slide, not an inventory:
- 5 to 7 boxes on 2 to 4 ranks. Top-to-bottom tree only.
- Exactly one root (HTTP or UI entrypoint). Every other node has exactly one parent — one incoming edge, no extras, no cycles, no back-edges.
- Children of the same parent sit on one rank. Typical shape: Controller → orchestrator → 2-4 leaf collaborators.
- Labels are short type names (ChatController, ChatService). No package paths.
- Omit databases, files, caches, queues, buses-as-infrastructure, and third parties (OpenAI, SQLite, S3) unless the story is about that store.
- Edges have no labels. caption is one sentence, like: "HTTP waits on correlation_id. Every hop publishes an event."
- Specs stay structured. Detail lives in the spec, not on the canvas.`;

export function asIsPrompt(legacyRepo: string, options?: { redraw?: boolean }): string {
  const redraw = options?.redraw
    ? `The diagram you already drew is too busy: too many boxes, databases, and crossing arrows. Discard it. Draw only the main request path as a clean top-to-bottom tree.\n\n`
    : "";
  return `${redraw}You are drawing a whiteboard diagram of how a request flows through the legacy system.

Repository: ${legacyRepo}

Inspect the checked-out default/main branch only. Do not create a branch, do not modify files, and do not write code. Explore just enough to find the main request path and one critical end-user journey. Static analysis is evidence, not proof of exhaustive feature coverage.

Return ONLY one JSON object in a fenced json code block:
{
  "caption": "One sentence of the runtime story",
  "nodes": [
    {
      "id": "stable-slug",
      "label": "ShortTypeName",
      "kind": "service|app|db|job|lib",
      "spec": ${SPEC_SHAPE}
    }
  ],
  "edges": [
    { "from": "id", "to": "id" }
  ],
  "journeys": [
    {
      "id": "stable-journey-slug",
      "title": "End-user behavior",
      "actor": "User role",
      "preconditions": ["Required state"],
      "steps": ["User action in order"],
      "outcomes": ["Observable result, not an implementation detail"],
      "fixtures": ["Deterministic test data or account"],
      "normalizationRules": ["omit:generatedId", "ISO-date-regex => <timestamp>"],
      "componentIds": ["node-id"],
      "sourceEvidence": ["path/to/file.ts:SymbolName"],
      "required": true
    }
  ]
}

${TREE_DIAGRAM_RULES}
- Specs are short cards, not essays. purpose is 1-2 sentences (max 40 words). Other fields are at most 4 short lines.

ids are unique kebab-case. Every edge and journey componentId references existing node ids. Return one journey for this proof, grounded in source evidence. No markdown outside the json fence.`;
}

export function toBePrompt(
  legacyRepo: string,
  targetRepo: string,
  prompt: string,
  journeys: Journey[] = [],
): string {
  return `Now propose the TARGET architecture for the migration.

Legacy repo (source of truth for current behavior): ${legacyRepo}
Empty target repo (do not write code yet): ${targetRepo}

Migration intent from the team:
${prompt}

Legacy behavior candidates to preserve:
${JSON.stringify(journeys, null, 2)}

Still do not modify files. Return ONLY one JSON object in a fenced json code block:
{
  "caption": "One sentence of how a request flows in the new system",
  "nodes": [
    {
      "id": "stable-slug",
      "label": "ShortTypeName",
      "kind": "service|app|db|job|lib",
      "spec": ${SPEC_SHAPE}
    }
  ],
  "edges": [
    { "from": "id", "to": "id" }
  ],
  "journeys": [
    {
      "id": "same-legacy-journey-id",
      "title": "Same user-visible behavior",
      "actor": "Same actor",
      "preconditions": ["Preserved precondition"],
      "steps": ["Preserved semantic step"],
      "outcomes": ["Preserved observable outcome"],
      "fixtures": ["Deterministic fixture"],
      "normalizationRules": ["Frozen normalization only"],
      "componentIds": ["target-node-id"],
      "sourceEvidence": ["Legacy source evidence"],
      "required": true
    }
  ]
}

${TREE_DIAGRAM_RULES}
- Same entrypoint name as legacy when it still exists.

Spec rules (required):
- Use that exact spec object. Do not collapse it into one paragraph.
- purpose is 1-2 sentences, never more than 40 words. No request flow, retries, or file paths.
- Each other field is at most 4 short lines. Prefer line breaks over a long sentence.
- interface names real symbols a subagent can implement, one per line.
- owns names files or modules in the target repo.
- portFrom names legacy files/symbols. outOfScope is mandatory.
- doneWhen is 3-4 concrete checks, one per line, no numbering. That is where acceptance belongs.
- Preserve every journey id and behavioral field. Remap only componentIds so every value references a node in this TARGET graph.`;
}

export function executePrompt(input: {
  legacyRepo: string;
  legacyRef?: string;
  targetRepo: string;
  targetRef?: string;
  executionBranch: string;
  prompt: string;
  extraPrompt?: string;
  components: GraphNode[];
  refs?: ComponentRef[];
  plan?: ExecutionPlan;
  snapshot?: MigrationSnapshot;
  legacyBaseUrl?: string;
  targetBaseUrl?: string;
  fixtureCommand?: string;
  neonTarget: {
    branchName: string;
    branchId: string;
    endpointId: string;
  };
}): string {
  const graph: Graph = input.snapshot?.toBe.nodes.length
    ? input.snapshot.toBe
    : { nodes: input.components, edges: input.snapshot?.toBe.edges ?? [] };
  const plan = input.plan ?? executionPlan(graph);
  const byId = new Map(plan.components.map((component) => [component.ref.id, component]));
  const roster = plan.components
    .map((component) => {
      const parent = component.parentId
        ? byId.get(component.parentId)
        : undefined;
      const children = component.childIds
        .map((id) => byId.get(id)?.ref.slug)
        .filter(Boolean)
        .join(", ");
      return `## ${component.node.label}
Component id: ${component.ref.id}
Component key: ${component.ref.slug}
Kind: ${component.node.kind ?? "component"}
Parent: ${parent ? `${parent.node.label} [${parent.ref.slug}]` : "none (root)"}
Direct child components: ${children || "none"}

${attachedSpec(component)}`;
    })
    .join("\n\n");
  const rootSlugs = plan.roots.map((component) => component.ref.slug).join(", ");
  const baseRef = input.targetRef?.trim() || "the default/main branch";
  const requiredJourneys = (input.snapshot?.journeys ?? []).filter(
    (journey) => journey.required,
  );
  const requiredJourneyIds = requiredJourneys.map((journey) => journey.id);
  const reportJourneyId = requiredJourneyIds[0] || "exact-journey-id";
  const questions = SAMPLE_UI_QUESTIONS.map(
    (question, index) => `${index + 1}. ${question}`,
  ).join("\n");
  const neonHostPrefix = `${input.neonTarget.endpointId}.`;

  return `You are the migration agent. Implement the frozen plan in the target repo and prove it works.

You may run at most ${MAX_PROOF_CYCLES} complete proof cycles. Do not emit passed reports or open a PR until every gate passes. If cycle ${MAX_PROOF_CYCLES} still fails, emit explicit failed reports and stop.

Environment hard stop
- DATABASE_URL and OPENAI_API_KEY must already exist in the selected Cursor cloud environment. Do not ask for them, invent them, copy them into source files, or print their values.
- Parse DATABASE_URL without logging credentials. Its hostname must start with ${neonHostPrefix}, proving it targets Neon branch ${input.neonTarget.branchName} (${input.neonTarget.branchId}). A different endpoint, a local database, SQLite, an in-memory store, or a file fallback is a failure.
- The modern app must use OPENAI_API_KEY for both live OpenAI requests and DATABASE_URL for both persisted question/answer rows.

Legacy reference repo: ${input.legacyRepo}${input.legacyRef ? ` at ${input.legacyRef}` : " on its default/main branch"} (read-only).
Write ALL new code in the empty target repo: ${input.targetRepo}

Orchestrator-assigned execution branch: ${input.executionBranch}
Checkout the target repo from ${baseRef}, then create or switch to ${input.executionBranch} from that ref. Commit and push only on ${input.executionBranch}. Do not commit to main or ${baseRef}.

Migration intent
${input.prompt}

UI requirement
${MODERN_UI_RULE}

Required journeys
${requiredJourneys.length ? JSON.stringify(requiredJourneys, null, 2) : "Use the required snapshot journey."}

Target architecture
${formatExecutionTree(plan) || "No target components."}

Start with: ${rootSlugs || "(none)"}

Frozen component specs
${roster}

Do this
1. Before coding, write a concise, plain-language target-spec summary. State the user goal, then give every component one short responsibility, its shared contracts, dependencies, acceptance checks, the execution order, and work that can run in parallel.
2. Delegate independent components to subagents. Give each subagent a minimal prompt containing only its component spec, required shared contracts and dependencies, and the target repo and branch. Review and integrate every result.
3. Checkout the target base ref, create or switch to ${input.executionBranch}, implement the frozen plan, run the target repo's checks, then commit and push progress only to that branch.
4. Run the environment hard stop. Start both apps only after DATABASE_URL, its Neon endpoint, and OPENAI_API_KEY pass.
5. For each proof cycle, reset fixtures, then use Cursor computer use through the visible browser UI only. Enter and submit both questions in the legacy UI first, capture the visible answers, then enter and submit the same questions in the modern V2 UI:
${questions}
   Directly calling either app's HTTP/API endpoint with curl, fetch, a script, Playwright request APIs, or another API client does not count and is forbidden for these two question checks.
6. Compare the answers for semantic parity: the diagnosis, operator actions, and safety constraints must agree; exact OpenAI wording need not match. Save computer-use video or screenshot artifacts that show each UI submission and visible answer.
7. Prove the modern app sent both UI-entered questions to live OpenAI using two provider response IDs or equally specific logs. Query through DATABASE_URL and prove the same two questions and their non-empty answers are rows in Neon branch ${input.neonTarget.branchName}; evidence must include the redacted endpoint ID ${input.neonTarget.endpointId}, branch ID ${input.neonTarget.branchId}, and matching row identifiers.
8. If any UI, semantic parity, OpenAI, or Neon gate fails, fix the modern app on ${input.executionBranch}, commit and push the repair, and repeat the full legacy-then-modern sequence. Stop after ${MAX_PROOF_CYCLES} total cycles.
9. Only when every gate passes, push the final branch and open a PR from ${input.executionBranch}. A failed run may leave its branch for inspection but must not open a PR.

Test setup
- Legacy URL: ${input.legacyBaseUrl || "Start it from the repo README"}
- Modern URL: ${input.targetBaseUrl || "Start it from the repo README"}
- Reset command: ${input.fixtureCommand || "Use the repo's seed/reset command"}

Emit one line when a component starts or finishes:
CURAL_STATUS {"id":"<id>","status":"running|done|error"}

End your final response with these two blocks:
CURAL_EXECUTION_REPORT
\`\`\`json
{
  "status": "passed|failed",
  "components": [
    { "id": "exact-component-id", "status": "done|error", "summary": "What changed or failed" }
  ]
}
\`\`\`
CURAL_EVALUATION_REPORT
\`\`\`json
{
  "status": "passed|failed",
  "summary": "Short result",
  "testCycles": 1,
  "videos": [
    {
      "journeyId": "${reportJourneyId}",
      "path": "artifacts/ui-walkthrough.mp4",
      "label": "Legacy and modern UI walkthrough"
    }
  ],
  "journeys": [
    {
      "journeyId": "${reportJourneyId}",
      "status": "passed|failed",
      "checks": [
        {
          "name": "${SAMPLE_UI_QUESTIONS[0]}",
          "status": "passed|failed",
          "legacy": "Legacy result",
          "target": "Modern result",
          "difference": "Mismatch or empty",
          "evidence": ["computer-use video or screenshot artifact path"]
        },
        {
          "name": "${SAMPLE_UI_QUESTIONS[1]}",
          "status": "passed|failed",
          "legacy": "Legacy result",
          "target": "Modern result",
          "difference": "Mismatch or empty",
          "evidence": ["computer-use video or screenshot artifact path"]
        },
        {
          "name": "${OPENAI_GOAL_CHECK}",
          "status": "passed|failed",
          "evidence": ["one redacted log or provider response id per question"]
        },
        {
          "name": "${NEON_GOAL_CHECK}",
          "status": "passed|failed",
          "evidence": ["branch and endpoint ids plus query results for both rows"]
        }
      ]
    }
  ]
}
\`\`\`
Include every component once in the execution report and every required journey (${requiredJourneyIds.join(", ") || "the required snapshot journey id"}) in the evaluation report. testCycles is the number of full legacy-then-modern computer-use cycles actually run and must be between 1 and ${MAX_PROOF_CYCLES}. Report passed only when all components, repo checks, both UI-only question checks, semantic comparisons, OpenAI proofs, and Neon proofs pass.${operatorNotes(input.extraPrompt)}`;
}

export function operatorNotes(extraPrompt?: string): string {
  const notes = extraPrompt?.trim();
  if (!notes) return "";
  return `

Operator notes for this run (do not override frozen specs, journey ids, the assigned branch, status markers, or the required report JSON):
${notes}`;
}
