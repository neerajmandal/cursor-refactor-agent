"use client";

import { useMutation, useStorage } from "@liveblocks/react/suspense";
import { SpecPanel } from "@/components/SpecPanel";
import type { ComponentSpec } from "@/lib/spec";

export function SpecInspector({
  pane,
  selectedId,
  onClose,
  locked = false,
}: {
  pane: "asIs" | "toBe";
  selectedId: string | null;
  onClose: () => void;
  locked?: boolean;
}) {
  const node = useStorage((root) =>
    selectedId ? root[pane].nodes.find((item) => item.id === selectedId) : null,
  );
  const saveSpec = useMutation(
    ({ storage }, id: string, spec: ComponentSpec) => {
      const graph = storage.get("toBe");
      storage.set("toBe", {
        ...graph,
        nodes: graph.nodes.map((item) =>
          item.id === id ? { ...item, spec } : item,
        ),
      });
      storage.set("executionSnapshot", null);
      storage.set("evaluationReport", null);
      storage.set("phase", "aligning");
    },
    [],
  );

  if (!selectedId || !node) return null;

  return (
    <SpecPanel
      key={selectedId}
      title={node.label}
      spec={node.spec}
      onSave={(spec) => saveSpec(node.id, spec)}
      onClose={onClose}
      readOnly={pane === "asIs" || locked}
    />
  );
}
