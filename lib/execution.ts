import {
  componentRefs,
  toSpanningTree,
  type ComponentRef,
} from "@/lib/graph";
import { formatSpec, parseSpec, type ComponentSpec } from "@/lib/spec";
import type { Graph, GraphNode } from "@/lib/types";

export type ExecutionComponent = {
  ref: ComponentRef;
  node: GraphNode;
  spec: ComponentSpec;
  parentId: string | null;
  childIds: string[];
  depth: number;
};

export type ExecutionPlan = {
  tree: Graph;
  components: ExecutionComponent[];
  roots: ExecutionComponent[];
};

export function executionPlan(graph: Graph): ExecutionPlan {
  const tree = toSpanningTree(graph);
  const refs = componentRefs(tree.nodes);
  const byId = new Map(refs.map((ref) => [ref.id, ref]));
  const children = new Map<string, string[]>();
  const parent = new Map<string, string>();

  for (const node of tree.nodes) {
    children.set(node.id, []);
  }
  for (const edge of tree.edges) {
    children.get(edge.from)?.push(edge.to);
    parent.set(edge.to, edge.from);
  }

  const depths = new Map<string, number>();
  const roots = tree.nodes
    .map((node) => node.id)
    .filter((id) => !parent.has(id));
  const queue = roots.map((id) => ({ id, depth: 0 }));
  while (queue.length) {
    const current = queue.shift()!;
    if (depths.has(current.id)) continue;
    depths.set(current.id, current.depth);
    for (const childId of children.get(current.id) ?? []) {
      queue.push({ id: childId, depth: current.depth + 1 });
    }
  }

  const components = tree.nodes.map((node) => ({
    ref: byId.get(node.id) ?? { id: node.id, label: node.label, slug: node.id },
    node,
    spec: parseSpec(node.spec),
    parentId: parent.get(node.id) ?? null,
    childIds: children.get(node.id) ?? [],
    depth: depths.get(node.id) ?? 0,
  }));

  return {
    tree,
    components,
    roots: components.filter((component) => component.parentId === null),
  };
}

export function attachedSpec(component: ExecutionComponent): string {
  const formatted = formatSpec(component.spec);
  const json = JSON.stringify(component.spec, null, 2);
  return `Frozen target-architecture spec for ${component.node.label} (${component.ref.id}):
${formatted || "No execution spec was provided."}

\`\`\`json
${json}
\`\`\``;
}

export function formatExecutionTree(plan: ExecutionPlan): string {
  const byId = new Map(plan.components.map((component) => [component.ref.id, component]));

  function render(component: ExecutionComponent): string[] {
    const indent = "  ".repeat(component.depth);
    const role = component.parentId === null ? "root" : "child";
    const line = `${indent}- ${component.node.label} [${component.ref.slug}] (${role})`;
    return [
      line,
      ...component.childIds.flatMap((childId) => {
        const child = byId.get(childId);
        return child ? render(child) : [];
      }),
    ];
  }

  return plan.roots.flatMap(render).join("\n");
}

export function findComponent(
  plan: ExecutionPlan,
  id: string,
): ExecutionComponent | undefined {
  return plan.components.find((component) => component.ref.id === id);
}
