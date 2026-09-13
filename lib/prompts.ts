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

export const OPENAI_GOAL_CHECK = "Questions sent via OpenAI";
export const NEON_GOAL_CHECK = "Answers persisted in Neon";

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
  snapshot?: MigrationSnapshot;
  legacyBaseUrl?: string;
  targetBaseUrl?: string;
  fixtureCommand?: string;
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
  const goal = goalSection({
    legacyRepo: input.legacyRepo,
    legacyRef: input.legacyRef,
    targetRepo: input.targetRepo,
    targetBranch: input.executionBranch,
    legacyBaseUrl: input.legacyBaseUrl ?? "",
    targetBaseUrl: input.targetBaseUrl ?? "",
    fixtureCommand: input.fixtureCommand ?? "",
    snapshot: input.snapshot,
    journeys: input.snapshot?.journeys,
  });
  return `You are the parent migration agent. Delegate implementation. Do not stop after writing code.

Execute the frozen plan first. Only after the plan is in place, prove it with computer use: send the two sample questions in the UI.

Hard stop — loop until both of these are true. Do not finish, do not open a PR, and do not emit passed reports until they are:
- The two questions went through OpenAI (live API).
- The two answers landed in Neon (queryable rows, not just the screen).

If either is missing, fix the modern app and run the computer-use test again. Keep that loop going. Do not hand off to a later testing step.

Legacy reference repo: ${input.legacyRepo}${input.legacyRef ? ` at ${input.legacyRef}` : " on its default/main branch"} (read-only).
Write ALL new code in the empty target repo: ${input.targetRepo}

Orchestrator-assigned execution branch: ${input.executionBranch}
Checkout the target repo from ${baseRef}, then create or switch to ${input.executionBranch} from that ref. Commit and push only on ${input.executionBranch}. Do not commit to main or ${baseRef}.

Team migration intent:
${input.prompt}

UI (part of the goal):
${MODERN_UI_RULE}

${goal}

You have named subagents, one per target component. Spawn the matching subagent (use the slug) for each component and let it implement that component in the target repo. Coordinate shared contracts, order work if there are dependencies, and keep the target repo consistent.

Components and frozen execution specs:
${roster}

Each time you start or finish a component, emit a status line on its own line so the board can light up that node:
CURAL_STATUS {"id":"<id>","status":"running"}
CURAL_STATUS {"id":"<id>","status":"done"}
CURAL_STATUS {"id":"<id>","status":"error"}

Work loop (required):
1. Execute the frozen plan. Spawn subagents for remaining components, review each diff, and keep the target repo consistent.
2. Run the target repository's relevant checks.
3. Then test with computer use (VM browser / computer use only). Do not use Playwright, Cypress, or Selenium. Do not compare source code. Start both apps and send the two sample questions as specified in the goal.
4. Gate A — OpenAI: prove both questions were sent to the live OpenAI API. If not, you are not done.
5. Gate B — Neon: prove both answers were written to the modern app's Neon database. If not, you are not done.
6. If Gate A or Gate B failed (or the UI did not show answers): fix the modern app on ${input.executionBranch} and go back to step 3. Do not stop. Do not mark passed.
7. Repeat until Gate A and Gate B both pass and every component is done.

Open a PR on the target repo from ${input.executionBranch} only after Gate A and Gate B both pass.

Your final response MUST end with these two markers and fenced JSON objects, in this order:
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
${goalReportShape(input.snapshot)}
\`\`\`
Include every component exactly once. Use passed on both reports only when every component is done, target checks pass, Gate A (OpenAI) passed, and Gate B (Neon) passed. If either gate failed, status must be failed and you must keep looping instead of stopping.${operatorNotes(input.extraPrompt)}`;
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

UI (part of the parent goal — keep going until it holds):
${MODERN_UI_RULE}
Questions must be sent through OpenAI. Answers must be persisted in the modern app's Neon database. Do not stub either.

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

function journeyIds(snapshot?: MigrationSnapshot, journeys?: Journey[]): string[] {
  const source = snapshot?.journeys ?? journeys ?? [];
  return source
    .filter((journey) => journey.required)
    .map((journey) => journey.id);
}

function goalSection(input: {
  legacyRepo: string;
  legacyRef?: string;
  targetRepo: string;
  targetBranch?: string;
  legacyBaseUrl: string;
  targetBaseUrl: string;
  fixtureCommand: string;
  snapshot?: MigrationSnapshot;
  journeys?: Journey[];
}): string {
  const targetBranch = input.targetBranch?.trim() || "";
  const ids = journeyIds(input.snapshot, input.journeys);
  const questions = SAMPLE_UI_QUESTIONS.map(
    (question, index) => `${index + 1}. ${question}`,
  ).join("\n");
  const frozenJourneys = (input.snapshot?.journeys ?? input.journeys ?? [])
    .filter((journey) => journey.required);
  return `Goal (keep working until this is true):
1. The frozen plan is implemented in the modern app.
2. Computer use can ask the two sample questions in the UI.
3. The modern app sends those questions through OpenAI.
4. The modern app persists the answers in Neon.

Frozen journeys:
${frozenJourneys.length ? JSON.stringify(frozenJourneys, null, 2) : "Use the required snapshot journey."}

Legacy app: ${input.legacyRepo}${input.legacyRef ? ` at ${input.legacyRef}` : " on its default/main branch"}
Modern app: ${input.targetRepo}${targetBranch ? ` at ${targetBranch}` : ""}
${targetBranch ? `Run the modern app from branch ${targetBranch}. Do not verify main.` : ""}
Legacy URL: ${input.legacyBaseUrl || "Start it from the repo README"}
Modern URL: ${input.targetBaseUrl || "Start it from the repo README"}
Reset if needed: ${input.fixtureCommand || "Use the repo's seed/reset command"}

The modern app should look like the legacy UI and show V2 in the header. Use that to tell the apps apart.

Computer-use test (required after the plan is implemented):
Ask these two questions in the UI of the legacy app, then again in the modern (V2) app:
${questions}

For each question, type it, submit, wait for the answer, and write down the visible result (answer text, error, empty state).

OpenAI (required for the modern app):
Those two questions must be sent to OpenAI — a live chat/completions (or Responses) call with the operator question in the request. Do not accept a stub, fixture, canned string, or local model. Prove it with runtime evidence: server logs showing the OpenAI client call, or an outbound request to api.openai.com, plus a provider response id. Fail if the screen shows an answer but OpenAI was not called.

Neon (required for the modern app):
After each answer is visible, that question and answer must be persisted in the modern app's Neon Postgres database (conversation/message/history rows). Use the target repo's DATABASE_URL / Neon config, not Cural's archive database. Prove it by querying Neon (or the app's own history API backed by Neon) and finding both questions with their answers. Fail if answers exist only on screen or only in memory.

Loop rule: if OpenAI was not used or Neon has no matching rows, the goal is not achieved. Fix the modern app and send the two questions again. Keep looping until both gates pass. Visible answers alone are not enough.

The goal is achieved only when both apps show the same user-visible meaning AND Gate A (OpenAI) AND Gate B (Neon) pass. The goal is not achieved if an app will not start, V2 is missing, an answer cannot be seen, OpenAI was skipped, or Neon has no matching rows.

Use these journey ids in the evaluation report: ${ids.join(", ") || "the required snapshot journey id"}.`;
}

function goalReportShape(snapshot?: MigrationSnapshot): string {
  const firstId = journeyIds(snapshot)[0] || "exact-journey-id";
  return `{
  "status": "passed|failed",
  "summary": "Short comparison of the two UI answers",
  "videos": [
    {
      "journeyId": "${firstId}",
      "path": "artifacts/ui-walkthrough.mp4",
      "label": "Legacy and modern UI walkthrough"
    }
  ],
  "journeys": [
    {
      "journeyId": "${firstId}",
      "status": "passed|failed",
      "checks": [
        {
          "name": "${SAMPLE_UI_QUESTIONS[0]}",
          "status": "passed|failed",
          "legacy": "What the legacy UI showed",
          "target": "What the modern UI showed",
          "difference": "Empty when equal, otherwise the mismatch",
          "evidence": ["screenshot or video path"]
        },
        {
          "name": "${SAMPLE_UI_QUESTIONS[1]}",
          "status": "passed|failed",
          "legacy": "What the legacy UI showed",
          "target": "What the modern UI showed",
          "difference": "Empty when equal, otherwise the mismatch",
          "evidence": ["screenshot or video path"]
        },
        {
          "name": "${OPENAI_GOAL_CHECK}",
          "status": "passed|failed",
          "legacy": "How the legacy path generated the answer",
          "target": "OpenAI request/response evidence for both questions",
          "difference": "Empty when OpenAI was used for both",
          "evidence": ["log line, request id, or network trace"]
        },
        {
          "name": "${NEON_GOAL_CHECK}",
          "status": "passed|failed",
          "legacy": "How the legacy path stored the turn",
          "target": "Neon rows for both questions and answers",
          "difference": "Empty when both turns are in Neon",
          "evidence": ["query result or history API payload"]
        }
      ]
    }
  ]
}`;
}
