"use client";

import { useState } from "react";
import Link from "next/link";
import { ArchitecturePane } from "@/components/ArchitecturePane";
import { BoardChrome, BoardOverflowItem } from "@/components/BoardChrome";
import { EvidencePanel } from "@/components/EvidencePanel";
import { PHASE_LABEL } from "@/lib/types";
import type { RefactorArchive } from "@/lib/archive/types";
import { archiveArtifactUrl } from "@/lib/archive/types";

type View = "architecture" | "evidence";

export function ArchiveBoard({ archive }: { archive: RefactorArchive }) {
  const [view, setView] = useState<View>("architecture");
  const [selected, setSelected] = useState<{ pane: "asIs" | "toBe"; id: string } | null>(
    null,
  );
  const videos = archive.evaluationVideos.map((video) => ({
    ...video,
    url: video.url || archiveArtifactUrl(archive.id, video.path),
  }));

  return (
    <div className="flex h-full min-h-0 flex-col bg-paper">
      <BoardChrome
        view={view}
        onViewChange={setView}
        status={
          <p className="hidden max-w-md truncate text-[12px] text-muted lg:block">
            {archive.envName || archive.legacyRepo} · {PHASE_LABEL[archive.phase]}
          </p>
        }
        overflow={
          <>
            <BoardOverflowItem href={`/b/${archive.id}`}>
              Continue live board
            </BoardOverflowItem>
            <Link
              href="/projects"
              className="px-3 py-2 text-left text-[13px] text-ink hover:bg-paper-2"
            >
              Back to projects
            </Link>
          </>
        }
      />
      {view === "evidence" ? (
        <EvidencePanel
          workItems={archive.workItems}
          report={archive.evaluationReport}
          videos={videos}
          branches={archive.runBranches}
          journeys={archive.journeys}
          archiveId={archive.id}
        />
      ) : (
        <div className="flex min-h-0 flex-1">
          <ArchitecturePane
            pane="asIs"
            title="Current"
            subtitle="Existing architecture (as-is)"
            graph={archive.asIs}
            selectable
            selectedId={selected?.pane === "asIs" ? selected.id : null}
            nodeStatus={{}}
            nodesDraggable={false}
            onSelect={(id) => setSelected(id ? { pane: "asIs", id } : null)}
            onMove={() => undefined}
          />
          <div className="w-px bg-line" />
          <ArchitecturePane
            pane="toBe"
            title="Target"
            subtitle="Proposed architecture (to-be)"
            graph={archive.toBe}
            selectable
            selectedId={selected?.pane === "toBe" ? selected.id : null}
            nodeStatus={{}}
            nodesDraggable={false}
            onSelect={(id) => setSelected(id ? { pane: "toBe", id } : null)}
            onMove={() => undefined}
          />
        </div>
      )}
    </div>
  );
}
