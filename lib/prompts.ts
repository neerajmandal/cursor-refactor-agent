import type { ComponentRef } from "@/lib/graph";
import { formatSpec, parseSpec } from "@/lib/spec";
import type {
  GraphNode,
  Journey,
  MigrationSnapshot,
} from "@/lib/types";

const SPEC_SHAPE = `{
      "purpose": "2-3 sentences, max 200 words: what this component is for. No implementation flow.",
      "interface": "public types, functions, or HTTP routes only",
      "owns": "files, tables, or data this component is responsible for",
      "dependsOn": "neighbor components and how it calls them",
      "portFrom": "legacy files or symbols to reuse",
      "outOfScope": "what this subagent must not build",
      "doneWhen": "3-6 short, testable checks, one per line"
    }`;

export const SAMPLE_UI_QUESTIONS = [
  "What does HelloDrive fault code FO48 mean?",
  "How do I clear a HelloDrive FO48 fault and get the line running again?",
] as const;

export const MODERN_UI_RULE =
  "Copy the legacy app UI into the modern app so a user can ask questions the same way. Keep the same screens, input, and submit flow. Add a visible V2 label in the modern UI (title or header) so testers can tell the two apps apart.";

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
- purpose is 2-3 sentences, never more than 200 words. Do not put the request flow, retries, or file paths in purpose.
- Each other field is 1-4 short lines. Prefer line breaks over a long sentence.
- interface names real symbols a subagent can implement, one per line.
- owns names files or modules in the target repo.
- portFrom names legacy files/symbols. outOfScope is mandatory.
- doneWhen is 3-6 concrete checks, one per line, no numbering. That is where the flow and acceptance belong.
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
}): string {
  const refs = input.refs ?? input.components.map((node) => ({
    id: node.id,
    label: node.label,
    slug: node.id,
  }));
  const roster = refs
    .map((ref, index) => {
      const node = input.components[index];
      const spec = formatSpec(parseSpec(node?.spec));
      return `## ${ref.label}
Component id: ${ref.id}
Subagent slug: ${ref.slug}
Kind: ${node?.kind ?? "component"}

Frozen execution spec:
${spec || "No execution spec was provided."}`;
    })
    .join("\n");

  const baseRef = input.targetRef?.trim() || "the default/main branch";
  return `You are the parent migration agent. Delegate. Do not implement every component yourself.

Legacy reference repo: ${input.legacyRepo}${input.legacyRef ? ` at ${input.legacyRef}` : " on its default/main branch"} (read-only).
Write ALL new code in the empty target repo: ${input.targetRepo}

Orchestrator-assigned execution branch: ${input.executionBranch}
Checkout the target repo from ${baseRef}, then create or switch to ${input.executionBranch} from that ref. Commit and push only on ${input.executionBranch}. Do not commit to main or ${baseRef}.

Team migration intent:
${input.prompt}

UI (required for later testing):
${MODERN_UI_RULE}

You have named subagents, one per target component. Spawn the matching subagent (use the slug) for each component and let it implement that component in the target repo. Coordinate shared contracts, order work if there are dependencies, and keep the target repo consistent.

Components and frozen execution specs:
${roster}

Each time you start or finish a component, emit a status line on its own line so the board can light up that node:
CURAL_STATUS {"id":"<id>","status":"running"}
CURAL_STATUS {"id":"<id>","status":"done"}
CURAL_STATUS {"id":"<id>","status":"error"}

When a subagent finishes, review its diff briefly, then continue. Run the target repository's relevant checks. Open a PR on the target repo from ${input.executionBranch} when the migration slice is in place.

Your final response MUST end with this marker and one fenced JSON object:
CURAL_EXECUTION_REPORT
\`\`\`json
{
  "status": "passed|failed",
  "components": [
    { "id": "exact-component-id", "status": "done|error", "summary": "What changed or failed" }
  ]
}
\`\`\`
Include every component exactly once. Use passed only when every component is done and target checks pass.${operatorNotes(input.extraPrompt)}`;
}

export function subagentPrompt(node: GraphNode, input: {
  legacyRepo: string;
  targetRepo: string;
  executionBranch?: string;
  prompt: string;
  extraPrompt?: string;
}): string {
  const specText = formatSpec(parseSpec(node.spec));
  const branchLine = input.executionBranch
    ? `Work only on branch ${input.executionBranch} in the target repo. Do not commit to main.\n`
    : "";

  return `You implement one component of a migration.

Component id: ${node.id}
Component name: ${node.label}
Kind: ${node.kind ?? "component"}

Write code in the empty target repo: ${input.targetRepo}
Use the legacy repo only as reference: ${input.legacyRepo}
${branchLine}

Team intent:
${input.prompt}

UI (required for later testing):
${MODERN_UI_RULE}

Spec (source of truth, aligned by humans before execution):
${specText || "No spec provided. Infer a minimal, correct implementation from the legacy repo."}

Stay inside this component's boundary. Match existing target-repo conventions if any files already exist.${operatorNotes(input.extraPrompt)}`;
}

export function operatorNotes(extraPrompt?: string): string {
  const notes = extraPrompt?.trim();
  if (!notes) return "";
  return `

Operator notes for this run (do not override frozen specs, journey ids, the assigned branch, status markers, or the required report JSON):
${notes}`;
}

function journeyIds(snapshot: MigrationSnapshot): string[] {
  return snapshot.journeys
    .filter((journey) => journey.required)
    .map((journey) => journey.id);
}

export function evaluationPrompt(input: {
  legacyRepo: string;
  legacyRef?: string;
  targetRepo: string;
  targetRef?: string;
  legacyBaseUrl: string;
  targetBaseUrl: string;
  fixtureCommand: string;
  extraPrompt?: string;
  snapshot: MigrationSnapshot;
}): string {
  const targetBranch =
    input.snapshot.executionBranch?.trim() || input.targetRef?.trim() || "";
  const ids = journeyIds(input.snapshot).join(", ");
  const questions = SAMPLE_UI_QUESTIONS.map(
    (question, index) => `${index + 1}. ${question}`,
  ).join("\n");

  return `Do UI testing. Start both apps, open each in the browser, ask the same two questions, and compare what the user sees. Use the VM browser / computer use. Do not use Playwright, Cypress, or Selenium. Do not compare source code.

Legacy app: ${input.legacyRepo}${input.legacyRef ? ` at ${input.legacyRef}` : " on its default/main branch"}
Modern app: ${input.targetRepo}${targetBranch ? ` at ${targetBranch}` : ""}
${targetBranch ? `Run the modern app from branch ${targetBranch}. Do not test main.` : ""}
Legacy URL: ${input.legacyBaseUrl || "Start it from the repo README"}
Modern URL: ${input.targetBaseUrl || "Start it from the repo README"}
Reset if needed: ${input.fixtureCommand || "Use the repo's seed/reset command"}

The modern app should look like the legacy UI and show V2 in the header. Use that to tell the apps apart.

Ask these two questions in the UI of the legacy app, then again in the modern (V2) app:
${questions}

For each question, type it, submit, wait for the answer, and write down the visible result (answer text, error, empty state). Pass only when both apps show the same user-visible meaning. Fail if an app will not start, V2 is missing from the modern UI, or an answer cannot be seen.

Your final response MUST end with this marker and one fenced JSON object:
CURAL_EVALUATION_REPORT
\`\`\`json
{
  "status": "passed|failed",
  "summary": "Short comparison of the two UI answers",
  "videos": [
    {
      "journeyId": "exact-journey-id",
      "path": "artifacts/ui-walkthrough.mp4",
      "label": "Legacy and modern UI walkthrough"
    }
  ],
  "journeys": [
    {
      "journeyId": "exact-journey-id",
      "status": "passed|failed",
      "checks": [
        {
          "name": "What does HelloDrive fault code FO48 mean?",
          "status": "passed|failed",
          "legacy": "What the legacy UI showed",
          "target": "What the modern UI showed",
          "difference": "Empty when equal, otherwise the mismatch",
          "evidence": ["screenshot or video path"]
        },
        {
          "name": "How do I clear a HelloDrive FO48 fault and get the line running again?",
          "status": "passed|failed",
          "legacy": "What the legacy UI showed",
          "target": "What the modern UI showed",
          "difference": "Empty when equal, otherwise the mismatch",
          "evidence": ["screenshot or video path"]
        }
      ]
    }
  ]
}
\`\`\`
Use these journey ids: ${ids || "the required snapshot journey id"}. Include both sample questions as checks. Use passed only when every check passed.${operatorNotes(input.extraPrompt)}`;
}
