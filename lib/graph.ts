import { parseSpec } from "@/lib/spec";
import type { Graph, GraphEdge, GraphNode } from "@/lib/types";

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const GAP_X = 32;
const GAP_Y = 88;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function collectText(value: unknown, out: string[]) {
  if (!value) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return;
  }
  const record = asRecord(value);
  if (!record) return;
  if (typeof record.text === "string") out.push(record.text);
  if (typeof record.result === "string") out.push(record.result);
  for (const nested of Object.values(record)) collectText(nested, out);
}

export function flattenAgentText(payload: unknown): string {
  const parts: string[] = [];
  collectText(payload, parts);
  return parts.join("\n");
}

function normalizeNodes(raw: unknown): GraphNode[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    const record = asRecord(item);
    if (!record) return [];
    const id =
      asString(record.id) ??
      asString(record.name) ??
      asString(record.key) ??
      `n${index + 1}`;
    const label =
      asString(record.label) ??
      asString(record.name) ??
      asString(record.title) ??
      id;
    return [
      {
        id,
        label,
        kind: asString(record.kind) ?? asString(record.type),
        spec: parseSpec(record.spec ?? record.description),
        x: typeof record.x === "number" ? record.x : undefined,
        y: typeof record.y === "number" ? record.y : undefined,
      },
    ];
  });
}

function normalizeEdges(raw: unknown): GraphEdge[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const from =
      asString(record.from) ?? asString(record.source) ?? asString(record.src);
    const to =
      asString(record.to) ?? asString(record.target) ?? asString(record.dst);
    if (!from || !to) return [];
    return [{ from, to, label: asString(record.label) }];
  });
}

export function normalizeGraph(raw: unknown): Graph {
  const record = asRecord(raw);
  if (!record) {
    throw new Error("Agent output was not a JSON object");
  }
  const nodes = normalizeNodes(
    record.nodes ?? record.components ?? record.services,
  );
  const edges = normalizeEdges(record.edges ?? record.connections);
  if (nodes.length === 0) {
    throw new Error("Agent output had no components");
  }
  return {
    caption: asString(record.caption) ?? asString(record.summary) ?? "",
    nodes,
    edges,
  };
}

export function extractGraph(text: string): Graph {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object in agent output");
  }
  return normalizeGraph(JSON.parse(raw.slice(start, end + 1)));
}

function childrenMap(edges: GraphEdge[]): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const edge of edges) {
    const list = children.get(edge.from) ?? [];
    list.push(edge.to);
    children.set(edge.from, list);
  }
  return children;
}

function pickRoot(nodes: GraphNode[], incoming: Map<string, number>, outgoing: Map<string, number>): string {
  const ranked = [...nodes].sort((a, b) => {
    const aIn = incoming.get(a.id) ?? 0;
    const bIn = incoming.get(b.id) ?? 0;
    if (aIn !== bIn) return aIn - bIn;
    const aOut = outgoing.get(a.id) ?? 0;
    const bOut = outgoing.get(b.id) ?? 0;
    return bOut - aOut;
  });
  return ranked[0]?.id ?? nodes[0].id;
}

export function toSpanningTree(graph: Graph): Graph {
  const ids = new Set(graph.nodes.map((node) => node.id));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) continue;
    adjacency.get(edge.from)!.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
  }

  const roots = graph.nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id);
  if (roots.length === 0 && graph.nodes.length > 0) {
    roots.push(pickRoot(graph.nodes, incoming, outgoing));
  }

  const parent = new Map<string, string>();
  const seen = new Set<string>(roots);
  const queue = [...roots];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const child of adjacency.get(id) ?? []) {
      if (seen.has(child)) continue;
      seen.add(child);
      parent.set(child, id);
      queue.push(child);
    }
  }

  const primary = roots[0];
  if (primary) {
    for (const node of graph.nodes) {
      if (!seen.has(node.id)) {
        parent.set(node.id, primary);
        seen.add(node.id);
      }
    }
  }

  return {
    caption: graph.caption ?? "",
    nodes: graph.nodes,
    edges: [...parent.entries()].map(([to, from]) => ({ from, to })),
  };
}

const INFRA_RE =
  /sqlite|openai|embedding|pdf lib|pdf document|cache|s3\b|postgres|mongodb|redis|queue/i;

function isInfraNode(node: GraphNode): boolean {
  if (node.kind === "db") return true;
  return INFRA_RE.test(node.label) || INFRA_RE.test(node.id);
}

function pruneInfraLeaves(graph: Graph, maxNodes = 7): Graph {
  let nodes = graph.nodes;
  let edges = graph.edges;
  while (nodes.length > maxNodes) {
    const ids = new Set(nodes.map((node) => node.id));
    const hasOut = new Set(
      edges
        .filter((edge) => ids.has(edge.from) && ids.has(edge.to))
        .map((edge) => edge.from),
    );
    const drop = new Set(
      nodes
        .filter((node) => !hasOut.has(node.id) && isInfraNode(node))
        .map((node) => node.id),
    );
    if (drop.size === 0) break;
    nodes = nodes.filter((node) => !drop.has(node.id));
    edges = edges.filter((edge) => !drop.has(edge.from) && !drop.has(edge.to));
  }
  return { caption: graph.caption, nodes, edges };
}

function subtreeWidth(id: string, children: Map<string, string[]>): number {
  const kids = children.get(id) ?? [];
  if (kids.length === 0) return NODE_WIDTH;
  const inner = kids.reduce(
    (sum, child, index) => sum + subtreeWidth(child, children) + (index > 0 ? GAP_X : 0),
    0,
  );
  return Math.max(NODE_WIDTH, inner);
}

function placeTree(
  id: string,
  centerX: number,
  depth: number,
  children: Map<string, string[]>,
  positions: Map<string, { x: number; y: number }>,
) {
  positions.set(id, {
    x: centerX - NODE_WIDTH / 2,
    y: depth * (NODE_HEIGHT + GAP_Y),
  });
  const kids = children.get(id) ?? [];
  if (kids.length === 0) return;
  const total = kids.reduce(
    (sum, child, index) => sum + subtreeWidth(child, children) + (index > 0 ? GAP_X : 0),
    0,
  );
  let cursor = centerX - total / 2;
  for (const child of kids) {
    const width = subtreeWidth(child, children);
    placeTree(child, cursor + width / 2, depth + 1, children, positions);
    cursor += width + GAP_X;
  }
}

export function layoutGraph(graph: Graph): Graph {
  const tree = toSpanningTree(pruneInfraLeaves(graph));
  const children = childrenMap(tree.edges);
  const childIds = new Set(tree.edges.map((edge) => edge.to));
  const roots = tree.nodes.map((node) => node.id).filter((id) => !childIds.has(id));
  const positions = new Map<string, { x: number; y: number }>();

  if (roots.length === 0 && tree.nodes[0]) {
    placeTree(tree.nodes[0].id, NODE_WIDTH / 2, 0, children, positions);
  } else {
    const widths = roots.map((id) => subtreeWidth(id, children));
    let cursor = 24;
    roots.forEach((id, index) => {
      const width = widths[index];
      placeTree(id, cursor + width / 2, 0, children, positions);
      cursor += width + GAP_X * 2;
    });
  }

  return {
    caption: tree.caption,
    nodes: tree.nodes.map((node) => {
      const placed = positions.get(node.id);
      return {
        ...node,
        x: placed?.x ?? 0,
        y: placed?.y ?? 0,
      };
    }),
    edges: tree.edges,
  };
}

export function slugAgentName(id: string, index: number): string {
  const slug = id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  return slug || `component_${index + 1}`;
}

export type ComponentRef = {
  id: string;
  label: string;
  slug: string;
};

export function componentRefs(
  nodes: { id: string; label: string }[],
): ComponentRef[] {
  const used = new Set<string>();
  return nodes.map((node, index) => {
    let slug = slugAgentName(node.id, index);
    if (used.has(slug)) slug = `${slug}_${index + 1}`;
    used.add(slug);
    return { id: node.id, label: node.label, slug };
  });
}

export function inferNodeStatus(
  payload: unknown,
  refs: ComponentRef[] | string[],
): Record<string, "pending" | "running" | "done" | "error"> {
  const list: ComponentRef[] = refs.map((item, index) =>
    typeof item === "string"
      ? { id: item, label: item, slug: slugAgentName(item, index) }
      : item,
  );
  const status: Record<string, "pending" | "running" | "done" | "error"> = {};
  for (const ref of list) status[ref.id] = "pending";

  const blob =
    typeof payload === "string" ? payload : JSON.stringify(payload ?? "");
  const marker =
    /CURAL_STATUS\s+(\{[^\n]*"id"[^\n]*"status"[^\n]*\})/gi;
  for (const match of blob.matchAll(marker)) {
    try {
      const value = JSON.parse(match[1]) as { id?: unknown; status?: unknown };
      const ref = list.find((item) => item.id === value.id);
      if (
        ref &&
        (value.status === "pending" ||
          value.status === "running" ||
          value.status === "done" ||
          value.status === "error")
      ) {
        status[ref.id] = value.status;
      }
    } catch {
      // Ignore malformed protocol lines.
    }
  }

  return status;
}
