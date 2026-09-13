import { downloadAgentArtifact } from "@/lib/cursor";
import { getArchiveStore } from "@/lib/archive/store";
import {
  archiveArtifactUrl,
  archiveFromBoard,
  mimeFromPath,
  type ArchiveUpsert,
  type RefactorArchive,
} from "@/lib/archive/types";
import { isCloudAgentId, type BoardStorage, type EvaluationVideo } from "@/lib/types";

function collectEvidencePaths(
  archive: ArchiveUpsert,
): { path: string; label: string; agentId: string }[] {
  const seen = new Set<string>();
  const items: { path: string; label: string; agentId: string }[] = [];
  function add(path: string, label: string | undefined, agentId: string) {
    const trimmed = path.trim();
    if (!trimmed || trimmed.startsWith("http") || seen.has(trimmed)) return;
    seen.add(trimmed);
    items.push({
      path: trimmed,
      label: label?.trim() || trimmed.split("/").pop() || trimmed,
      agentId,
    });
  }
  for (const document of Object.values(archive.documents)) {
    add(document.artifactPath, document.filename, document.agentId);
  }
  for (const video of archive.evaluationVideos) {
    add(video.path, video.label, archive.implementAgentId);
  }
  for (const journey of archive.evaluationReport?.journeys ?? []) {
    for (const check of journey.checks) {
      for (const evidence of check.evidence) {
        add(evidence, check.name, archive.implementAgentId);
      }
    }
  }
  for (const observation of archive.implementationReport?.observations ?? []) {
    for (const evidence of observation.evidence) {
      add(evidence, observation.question, archive.implementAgentId);
    }
  }
  return items;
}

function withDurableVideoUrls(
  videos: EvaluationVideo[],
  refactorId: string,
): EvaluationVideo[] {
  return videos.map((video) => ({
    ...video,
    url: archiveArtifactUrl(refactorId, video.path),
  }));
}

export async function persistBoardArchive(
  boardId: string,
  board: Partial<BoardStorage>,
  options: { ingestArtifacts?: boolean } = {},
): Promise<RefactorArchive> {
  const store = getArchiveStore();
  const previous = await store.get(boardId);
  const draft = archiveFromBoard(boardId, board, previous);
  const saved = await store.upsert(draft);

  if (!options.ingestArtifacts) return saved;

  for (const item of collectEvidencePaths(saved)) {
    const agentId = isCloudAgentId(item.agentId)
      ? item.agentId
      : isCloudAgentId(saved.implementAgentId)
        ? saved.implementAgentId
        : saved.executeAgentId;
    if (!isCloudAgentId(agentId)) continue;
    try {
      const { buffer, contentType } = await downloadAgentArtifact(agentId, item.path);
      await store.putArtifact({
        refactorId: boardId,
        sourcePath: item.path,
        label: item.label,
        mime: mimeFromPath(item.path, contentType),
        body: buffer,
      });
    } catch {
      // Keep the archive even if a single VM file is already gone.
    }
  }

  const refreshed = await store.get(boardId);
  if (!refreshed) return saved;
  const videos = withDurableVideoUrls(refreshed.evaluationVideos, boardId);
  if (videos.some((video, index) => video.url !== refreshed.evaluationVideos[index]?.url)) {
    return store.upsert({ ...refreshed, evaluationVideos: videos });
  }
  return refreshed;
}
