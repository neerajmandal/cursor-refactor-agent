"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { ArtifactDrawer } from "@/components/ArtifactDrawer";
import { BoardChrome, BoardOverflowItem } from "@/components/BoardChrome";
import { WorkflowDocumentPanel } from "@/components/WorkflowDocumentPanel";
import { boardViewHref, type BoardView } from "@/lib/board-view";
import type { RefactorArchive } from "@/lib/archive/types";
import { archiveArtifactUrl } from "@/lib/archive/types";
import type { NodeStatus } from "@/lib/types";

export function ArchiveBoard({
  archive,
  initialView,
}: {
  archive: RefactorArchive;
  initialView: BoardView;
}) {
  const router = useRouter();
  const [view, setView] = useState<BoardView>(
    archive.phaseStatuses[initialView] === "pending" ? archive.phase : initialView,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFilename, setSelectedFilename] = useState(
    view === "research"
      ? "research-plan.md"
      : view === "plan"
        ? "implementation-plan.md"
        : archive.documents["verification-report.md"]
          ? "verification-report.md"
          : "implementation-summary.md",
  );
  const [artifactsOpen, setArtifactsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function changeView(next: BoardView) {
    setView(next);
    setSelectedId(null);
    const preferred =
      next === "research"
        ? "research-plan.md"
        : next === "plan"
          ? "implementation-plan.md"
          : archive.documents["verification-report.md"]
            ? "verification-report.md"
            : "implementation-summary.md";
    if (archive.documents[preferred]) setSelectedFilename(preferred);
    window.history.replaceState(
      null,
      "",
      boardViewHref(window.location.href, next),
    );
  }

  const graph = view === "research" ? archive.asIs : archive.toBe;
  const nodeStatus = Object.fromEntries(
    archive.toBe.nodes.map((node) => {
      const steps =
        archive.implementationPlan?.phases.flatMap((phase) =>
          phase.steps.filter((step) => step.componentIds.includes(node.id)),
        ) ?? [];
      const status: NodeStatus = steps.some((step) => step.status === "error")
        ? "error"
        : steps.some((step) => step.status === "running")
          ? "running"
          : steps.length && steps.every((step) => step.status === "done")
            ? "done"
            : "pending";
      return [node.id, status];
    }),
  );
  const artifactUrl = (path: string) => archiveArtifactUrl(archive.id, path);

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-paper">
      <BoardChrome
        view={view}
        onViewChange={changeView}
        phaseStatuses={archive.phaseStatuses}
        status={
          <p className="hidden max-w-sm truncate text-[11px] text-muted md:block">
            Saved {new Date(archive.updatedAt).toLocaleString()}
          </p>
        }
        primaryAction={
          view === "implement" &&
          archive.phaseStatuses.implement === "complete" ? (
            <button
              type="button"
              onClick={() => setSelectedFilename("verification-report.md")}
              className="rounded-md bg-cta px-3.5 py-2 text-[12px] font-medium text-white"
            >
              Review implementation →
            </button>
          ) : null
        }
        overflow={
          <>
            <BoardOverflowItem onClick={() => setArtifactsOpen(true)}>
              Saved artifacts
            </BoardOverflowItem>
            <BoardOverflowItem href={`/b/${archive.id}`}>
              Continue live board
            </BoardOverflowItem>
            <Link
              href="/projects"
              className="px-3 py-2 text-left text-[13px] text-ink hover:bg-paper-2"
            >
              Back to projects
            </Link>
            <BoardOverflowItem
              disabled={deleting}
              onClick={() => {
                if (!window.confirm("Delete this saved refactor and its artifacts?")) {
                  return;
                }
                setDeleting(true);
                void fetch(`/api/archives/${encodeURIComponent(archive.id)}`, {
                  method: "DELETE",
                }).then((response) => {
                  if (!response.ok) return setDeleting(false);
                  router.replace("/projects");
                  router.refresh();
                });
              }}
            >
              {deleting ? "Deleting…" : "Delete project"}
            </BoardOverflowItem>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ArchitecturePane
          pane={view === "research" ? "asIs" : "toBe"}
          title={view === "research" ? "Legacy component diagram" : "Target component diagram"}
          subtitle="Saved workflow state"
          graph={graph}
          selectable
          selectedId={selectedId}
          nodeStatus={view === "implement" ? nodeStatus : {}}
          nodesDraggable={false}
          onSelect={setSelectedId}
          onMove={() => undefined}
        />
        <WorkflowDocumentPanel
          phase={view}
          documents={archive.documents}
          selectedFilename={selectedFilename}
          onSelectDocument={setSelectedFilename}
          selectedComponentId={selectedId}
          graph={graph}
          research={archive.researchReport}
          plan={archive.implementationPlan}
          implementation={archive.implementationReport}
          blockers={archive.blockers.filter((blocker) => blocker.phase === view)}
          artifactUrl={artifactUrl}
        />
      </div>

      <ArtifactDrawer
        open={artifactsOpen}
        onClose={() => setArtifactsOpen(false)}
        documents={archive.documents}
        implementation={archive.implementationReport}
        branches={archive.runBranches}
        urlFor={artifactUrl}
      />
    </div>
  );
}
