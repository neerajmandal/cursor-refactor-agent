import { executionBranchName } from "@/lib/branch";
import { normalizeGraph } from "@/lib/graph";
import { parseSpec } from "@/lib/spec";
import type { Graph, Journey, MigrationSnapshot, WorkItem } from "@/lib/types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function lines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value !== "string") return [];
  return value
    .split(/\n+/)
    .map((item) => item.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function slug(value: string, index: number): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || `journey-${index + 1}`
  );
}

export function normalizeJourneys(value: unknown): Journey[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();

  return value.flatMap((item, index) => {
    const record = asRecord(item);
    if (!record) return [];
    const title = text(record.title ?? record.name, `Journey ${index + 1}`);
    let id = slug(text(record.id, title), index);
    if (used.has(id)) id = `${id}-${index + 1}`;
    used.add(id);

    return [{
      id,
      title,
      actor: text(record.actor, "End user"),
      preconditions: lines(record.preconditions),
      steps: lines(record.steps),
      outcomes: lines(record.outcomes ?? record.expectedOutcomes ?? record.expected),
      fixtures: lines(record.fixtures ?? record.testData),
      normalizationRules: lines(record.normalizationRules ?? record.ignore),
      componentIds: lines(record.componentIds ?? record.components),
      sourceEvidence: lines(record.sourceEvidence ?? record.evidence),
      required: record.required !== false,
    }];
  });
}

function extractJson(textValue: string): Record<string, unknown> {
  const fence = textValue.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence?.[1] ?? textValue;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object in agent output");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown;
  const record = asRecord(parsed);
  if (!record) throw new Error("Agent output was not a JSON object");
  return record;
}

export function extractAnalysis(textValue: string): {
  graph: Graph;
  journeys: Journey[];
} {
  const record = extractJson(textValue);
  return {
    graph: normalizeGraph(record),
    journeys: normalizeJourneys(record.journeys),
  };
}

export function validateAlignment(graph: Graph, journeys: Journey[]): string[] {
  const errors: string[] = [];
  const componentIds = new Set(graph.nodes.map((node) => node.id));

  for (const node of graph.nodes) {
    const spec = parseSpec(node.spec);
    if (!spec.purpose) errors.push(`${node.label}: purpose is required`);
    if (!spec.interface) errors.push(`${node.label}: interface is required`);
    if (!spec.outOfScope) errors.push(`${node.label}: out of scope is required`);
    if (!spec.doneWhen) errors.push(`${node.label}: done when is required`);
  }

  if (!journeys.some((journey) => journey.required)) {
    errors.push("At least one required end-user journey is needed");
  }

  for (const journey of journeys) {
    if (!journey.steps.length) errors.push(`${journey.title}: steps are required`);
    if (!journey.outcomes.length) {
      errors.push(`${journey.title}: observable outcomes are required`);
    }
    if (!journey.componentIds.length) {
      errors.push(`${journey.title}: link at least one target component`);
    }
    const unknown = journey.componentIds.filter((id) => !componentIds.has(id));
    if (unknown.length) {
      errors.push(`${journey.title}: unknown components ${unknown.join(", ")}`);
    }
  }

  return errors;
}

export function reconcileJourneyComponents(
  asIs: Graph,
  toBe: Graph,
  journeys: Journey[],
): Journey[] {
  const targetIds = new Set(toBe.nodes.map((node) => node.id));

  return journeys.map((journey) => {
    const mapped = journey.componentIds.flatMap((componentId) => {
      if (targetIds.has(componentId)) return [componentId];
      const legacyNode = asIs.nodes.find((node) => node.id === componentId);
      if (!legacyNode) return [];
      const needles = [legacyNode.id, legacyNode.label]
        .map((value) => value.toLowerCase())
        .filter(Boolean);
      return toBe.nodes
        .filter((node) => {
          const portFrom = parseSpec(node.spec).portFrom.toLowerCase();
          return needles.some((needle) => portFrom.includes(needle));
        })
        .map((node) => node.id);
    });

    return {
      ...journey,
      componentIds: [...new Set(mapped)],
    };
  });
}

export function createMigrationSnapshot(input: {
  asIs: Graph;
  toBe: Graph;
  journeys: Journey[];
  architectureVersion: number;
}): MigrationSnapshot {
  const payload = JSON.stringify({
    architectureVersion: input.architectureVersion,
    asIs: input.asIs,
    toBe: input.toBe,
    journeys: input.journeys,
  });
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const id = `snapshot-${input.architectureVersion}-${(hash >>> 0).toString(36)}`;
  return {
    id,
    createdAt: new Date().toISOString(),
    architectureVersion: input.architectureVersion,
    asIs: structuredClone(input.asIs),
    toBe: structuredClone(input.toBe),
    journeys: structuredClone(input.journeys),
    executionBranch: executionBranchName(id),
  };
}

export function workItemsFromSnapshot(
  snapshot: MigrationSnapshot,
  previous: Record<string, WorkItem> = {},
  componentIds?: string[],
): Record<string, WorkItem> {
  const selected = componentIds ? new Set(componentIds) : null;
  const next = { ...previous };
  for (const node of snapshot.toBe.nodes) {
      if (selected && !selected.has(node.id)) continue;
      const prior = previous[node.id];
      const dependencies = snapshot.toBe.edges
        .filter((edge) => edge.to === node.id)
        .map((edge) => edge.from);
      next[node.id] = {
        componentId: node.id,
        label: node.label,
        status: "pending",
        attempts: (prior?.attempts ?? 0) + 1,
        specSnapshot: parseSpec(node.spec),
        dependsOn: dependencies,
        agentId: "",
        runId: "",
        branches: [],
        summary: "",
      };
  }
  return next;
}
