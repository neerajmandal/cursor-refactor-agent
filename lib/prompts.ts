import { formatSpec, parseSpec } from "@/lib/spec";
import type { GraphNode } from "@/lib/types";

const SPEC_SHAPE = `{
      "purpose": "2-3 sentences, max 200 words: what this component is for. No implementation flow.",
      "interface": "public types, functions, or HTTP routes only",
      "owns": "files, tables, or data this component is responsible for",
      "dependsOn": "neighbor components and how it calls them",
      "portFrom": "legacy files or symbols to reuse",
      "outOfScope": "what this subagent must not build",
      "doneWhen": "3-6 short, testable checks, one per line"
    }`;

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

Explore just enough to find the main request path. Do not modify files. Do not write code.

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
  ]
}

${TREE_DIAGRAM_RULES}

ids are unique kebab-case. Every edge references existing ids. No markdown outside the json fence.`;
}

export function toBePrompt(legacyRepo: string, targetRepo: string, prompt: string): string {
  return `Now propose the TARGET architecture for the migration.

Legacy repo (source of truth for current behavior): ${legacyRepo}
Empty target repo (do not write code yet): ${targetRepo}

Migration intent from the team:
${prompt}

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
- doneWhen is 3-6 concrete checks, one per line, no numbering. That is where the flow and acceptance belong.`;
}

export function executePrompt(input: {
  legacyRepo: string;
  targetRepo: string;
  prompt: string;
  components: GraphNode[];
}): string {
  const roster = input.components
    .map((node) => `- ${node.id}: ${node.label}`)
    .join("\n");

  return `You are the parent migration agent. Delegate. Do not implement every component yourself.

Legacy reference repo: ${input.legacyRepo}
Write ALL new code in the empty target repo: ${input.targetRepo}

Team migration intent:
${input.prompt}

You have named subagents, one per target component. Spawn the matching subagent for each component and let it implement that component in the target repo. Coordinate shared contracts, order work if there are dependencies, and keep the target repo consistent.

Components:
${roster}

When a subagent finishes, review its diff briefly, then continue. Open a PR on the target repo when the migration slice is in place.`;
}

export function subagentPrompt(node: GraphNode, input: {
  legacyRepo: string;
  targetRepo: string;
  prompt: string;
}): string {
  const specText = formatSpec(parseSpec(node.spec));

  return `You implement one component of a migration.

Component id: ${node.id}
Component name: ${node.label}
Kind: ${node.kind ?? "component"}

Write code in the empty target repo: ${input.targetRepo}
Use the legacy repo only as reference: ${input.legacyRepo}

Team intent:
${input.prompt}

Spec (source of truth, already aligned by humans):
${specText || "No spec provided. Infer a minimal, correct implementation from the legacy repo."}

Stay inside this component's boundary. Match existing target-repo conventions if any files already exist.`;
}
