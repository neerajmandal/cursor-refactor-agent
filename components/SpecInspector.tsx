"use client";

import { useMutation, useStorage } from "@liveblocks/react/suspense";
import { SpecPanel } from "@/components/SpecPanel";
import type { ComponentSpec } from "@/lib/spec";

export function SpecInspector({
  selectedId,
  onClose,
}: {
  selectedId: string | null;
  onClose: () => void;
}) {
  const node = useStorage((root) =>
    selectedId ? root.toBe.nodes.find((item) => item.id === selectedId) : null,
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
    />
  );
}
