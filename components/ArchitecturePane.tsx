"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MarkerType,
  Position,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { ComponentNode, type ComponentFlowNode } from "@/components/ComponentNode";
import { PresenceCursors } from "@/components/PresenceCursors";
import { layoutGraph } from "@/lib/graph";
import type { Graph, NodeStatus } from "@/lib/types";

const nodeTypes = { component: ComponentNode };

function topologyKey(graph: Graph): string {
  return [
    graph.caption ?? "",
    graph.nodes.map((node) => node.id).join(","),
    graph.edges.map((edge) => `${edge.from}>${edge.to}`).join(","),
  ].join("|");
}

function graphToFlow(
  graph: Graph,
  nodeStatus: Record<string, NodeStatus>,
  selectedId: string | null,
): { nodes: ComponentFlowNode[]; edges: Edge[] } {
  const tree = layoutGraph({
    caption: graph.caption,
    nodes: graph.nodes.map(({ x: _x, y: _y, ...node }) => node),
    edges: graph.edges,
  });
  const childCount = new Map<string, number>();
  for (const edge of tree.edges) {
    childCount.set(edge.from, (childCount.get(edge.from) ?? 0) + 1);
  }
  let emphasizedId: string | null = null;
  let maxChildren = 1;
  for (const [id, count] of childCount) {
    if (count > maxChildren) {
      maxChildren = count;
      emphasizedId = id;
    }
  }
  return {
    nodes: tree.nodes.map((node) => ({
      id: node.id,
      type: "component" as const,
      position: { x: node.x ?? 0, y: node.y ?? 0 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      selected: node.id === selectedId,
      data: {
        label: node.label,
        kind: node.kind,
        status: nodeStatus[node.id],
        emphasized: node.id === emphasizedId,
      },
    })),
    edges: tree.edges.map((edge, index) => ({
      id: `${edge.from}-${edge.to}-${index}`,
      source: edge.from,
      target: edge.to,
      type: "step",
      style: { stroke: "#8a7d6f", strokeDasharray: "5 4" },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "#8a7d6f",
        width: 16,
        height: 16,
      },
    })),
  };
}

function PaneInner({
  pane,
  title,
  graph,
  selectable,
  selectedId,
  nodeStatus,
  collab,
  onSelect,
  onMove,
  onCursor,
}: {
  pane: "asIs" | "toBe";
  title: string;
  graph: Graph;
  selectable: boolean;
  selectedId: string | null;
  nodeStatus: Record<string, NodeStatus>;
  collab?: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onCursor?: (
    cursor: { pane: "asIs" | "toBe"; x: number; y: number } | null,
  ) => void;
}) {
  const { fitView, getViewport, setViewport, screenToFlowPosition } = useReactFlow();
  const previousKey = useRef("");
  const layoutKey = topologyKey(graph);
  const { nodes, edges } = useMemo(
    () => graphToFlow(graph, nodeStatus, selectedId),
    [graph, nodeStatus, selectedId],
  );

  useEffect(() => {
    if (graph.nodes.length === 0) {
      previousKey.current = "";
      return;
    }
    if (layoutKey === previousKey.current) return;
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.1, maxZoom: 1, duration: 0 }).then(() => {
        const viewport = getViewport();
        void setViewport({ x: viewport.x, y: 36, zoom: viewport.zoom }, { duration: 200 });
      });
    });
    previousKey.current = layoutKey;
    return () => cancelAnimationFrame(frame);
  }, [fitView, getViewport, graph.nodes.length, layoutKey, setViewport]);

  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-9 shrink-0 flex-col justify-center gap-0.5 border-b border-line px-4 py-2">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          {title}
        </h2>
        {graph.caption ? (
          <p className="line-clamp-2 text-[13px] leading-5 text-ink" title={graph.caption}>
            {graph.caption}
          </p>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1">
        {graph.nodes.length === 0 ? (
          <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-muted">
            Waiting for architecture
          </p>
        ) : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={selectable}
          panOnScroll
          fitView
          fitViewOptions={{ padding: 0.14 }}
          proOptions={{ hideAttribution: true }}
          onPaneClick={() => onSelect(null)}
          onNodeClick={(_, node) => {
            if (selectable) onSelect(node.id);
          }}
          onNodeDragStop={(_, node: Node) => {
            onMove(node.id, node.position.x, node.position.y);
          }}
          onPointerMove={(event) => {
            if (!onCursor) return;
            const position = screenToFlowPosition({
              x: event.clientX,
              y: event.clientY,
            });
            onCursor({ pane, x: position.x, y: position.y });
          }}
          onPointerLeave={() => onCursor?.(null)}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color="#d4c8b8"
          />
          <Controls showInteractive={false} />
          {collab ? <PresenceCursors pane={pane} /> : null}
        </ReactFlow>
      </div>
    </section>
  );
}

export function ArchitecturePane(props: {
  pane: "asIs" | "toBe";
  title: string;
  graph: Graph;
  selectable: boolean;
  selectedId: string | null;
  nodeStatus: Record<string, NodeStatus>;
  collab?: boolean;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onCursor?: (
    cursor: { pane: "asIs" | "toBe"; x: number; y: number } | null,
  ) => void;
}) {
  return (
    <ReactFlowProvider>
      <PaneInner {...props} />
    </ReactFlowProvider>
  );
}
