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

function collectEvidencePaths(archive: ArchiveUpsert): { path: string; label: string }[] {
  const seen = new Set<string>();
  const items: { path: string; label: string }[] = [];
  function add(path: string, label?: string) {
    const trimmed = path.trim();
    if (!trimmed || trimmed.startsWith("http") || seen.has(trimmed)) return;
    seen.add(trimmed);
    items.push({
      path: trimmed,
      label: label?.trim() || trimmed.split("/").pop() || trimmed,
    });
  }
  for (const video of archive.evaluationVideos) {
    add(video.path, video.label);
  }
  for (const journey of archive.evaluationReport?.journeys ?? []) {
    for (const check of journey.checks) {
      for (const evidence of check.evidence) add(evidence, check.name);
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

  const agentId = isCloudAgentId(saved.executeAgentId)
    ? saved.executeAgentId
    : saved.evaluationAgentId;
  if (!isCloudAgentId(agentId)) return saved;

  for (const item of collectEvidencePaths(saved)) {
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
