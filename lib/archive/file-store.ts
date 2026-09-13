import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  ArchiveArtifact,
  ArchiveStore,
  ArchiveUpsert,
  RefactorArchive,
} from "@/lib/archive/types";
import {
  artifactKindFor,
  sanitizeArtifactPath,
  summarizeArchive,
} from "@/lib/archive/types";
import { EMPTY_GRAPH, type Phase } from "@/lib/types";
import { defaultPhaseStatuses, legacyPhase } from "@/lib/workflow";

export function dataRoot(): string {
  return process.env.CURAL_DATA_DIR?.trim() || path.join(process.cwd(), ".data", "cural");
}

function archivePath(id: string): string {
  return path.join(dataRoot(), id, "archive.json");
}

function artifactFilePath(id: string, sourcePath: string): string {
  return path.join(dataRoot(), id, "artifacts", sourcePath);
}

function asArchive(value: unknown): RefactorArchive | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<RefactorArchive>;
  if (typeof record.id !== "string" || !record.id) return null;
  return {
    id: record.id,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
    envName: record.envName ?? "",
    legacyRepo: record.legacyRepo ?? "",
    targetRepo: record.targetRepo ?? "",
    legacyRef: record.legacyRef ?? "",
    targetRef: record.targetRef ?? "",
    prompt: record.prompt ?? "",
    legacyBaseUrl: record.legacyBaseUrl ?? "",
    targetBaseUrl: record.targetBaseUrl ?? "",
    fixtureCommand: record.fixtureCommand ?? "",
    phase: legacyPhase(record.phase as Phase),
    phaseStatuses:
      record.phaseStatuses ??
      defaultPhaseStatuses(legacyPhase(record.phase as Phase)),
    documents: record.documents ?? {},
    researchReport: record.researchReport ?? null,
    implementationPlan: record.implementationPlan ?? null,
    implementationReport: record.implementationReport ?? null,
    blockers: record.blockers ?? [],
    researchAgentId: record.researchAgentId ?? record.analyzeAgentId ?? "",
    researchRunId: record.researchRunId ?? record.analyzeRunId ?? "",
    planAgentId: record.planAgentId ?? "",
    planRunId: record.planRunId ?? "",
    implementAgentId: record.implementAgentId ?? record.executeAgentId ?? "",
    implementRunId: record.implementRunId ?? record.executeRunId ?? "",
    asIs: record.asIs ?? EMPTY_GRAPH,
    toBe: record.toBe ?? EMPTY_GRAPH,
    journeys: record.journeys ?? [],
    architectureVersion: record.architectureVersion ?? 0,
    executionSnapshot: record.executionSnapshot ?? null,
    analyzeAgentId: record.analyzeAgentId ?? "",
    analyzeRunId: record.analyzeRunId ?? "",
    executeAgentId: record.executeAgentId ?? "",
    executeRunId: record.executeRunId ?? "",
    evaluationAgentId: record.evaluationAgentId ?? "",
    evaluationRunId: record.evaluationRunId ?? "",
    workItems: record.workItems ?? {},
    executionReport: record.executionReport ?? null,
    evaluationReport: record.evaluationReport ?? null,
    evaluationVideos: record.evaluationVideos ?? [],
    runBranches: record.runBranches ?? [],
    error: record.error ?? "",
    artifacts: record.artifacts ?? [],
  };
}

async function readArchive(id: string): Promise<RefactorArchive | null> {
  try {
    const raw = await readFile(archivePath(id), "utf8");
    return asArchive(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function writeArchive(archive: RefactorArchive): Promise<void> {
  const file = archivePath(archive.id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(archive, null, 2));
}

export function createFileArchiveStore(): ArchiveStore {
  return {
    async list() {
      try {
        const ids = await readdir(/*turbopackIgnore: true*/ dataRoot());
        const archives = await Promise.all(ids.map((id) => readArchive(id)));
        return archives
          .filter((item): item is RefactorArchive => Boolean(item))
          .map(summarizeArchive)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      } catch {
        return [];
      }
    },

    async get(id) {
      return readArchive(id);
    },

    async remove(id) {
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) {
        return false;
      }
      const existing = await readArchive(id);
      if (!existing) return false;
      await rm(path.join(/*turbopackIgnore: true*/ dataRoot(), id), {
        recursive: true,
        force: true,
      });
      return true;
    },

    async upsert(input: ArchiveUpsert) {
      const previous = await readArchive(input.id);
      const now = new Date().toISOString();
      const archive: RefactorArchive = {
        ...input,
        createdAt: previous?.createdAt ?? input.createdAt ?? now,
        updatedAt: now,
        artifacts: previous?.artifacts ?? input.artifacts ?? [],
      };
      await writeArchive(archive);
      return archive;
    },

    async putArtifact({ refactorId, sourcePath, label, mime, body }) {
      const safePath = sanitizeArtifactPath(sourcePath);
      const archive = await readArchive(refactorId);
      if (!archive) throw new Error("Archive not found");
      const file = artifactFilePath(refactorId, safePath);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
      const existing = archive.artifacts.find((item) => item.sourcePath === safePath);
      const artifact: ArchiveArtifact = {
        id: existing?.id ?? nanoid(),
        refactorId,
        kind: artifactKindFor(safePath, mime),
        label,
        mime,
        sizeBytes: body.byteLength,
        sourcePath: safePath,
      };
      archive.artifacts = [
        ...archive.artifacts.filter((item) => item.sourcePath !== safePath),
        artifact,
      ];
      archive.updatedAt = new Date().toISOString();
      await writeArchive(archive);
      return artifact;
    },

    async getArtifact(refactorId, sourcePath) {
      const safePath = sanitizeArtifactPath(sourcePath);
      const archive = await readArchive(refactorId);
      if (!archive) return null;
      const meta = archive.artifacts.find((item) => item.sourcePath === safePath);
      try {
        const buffer = await readFile(artifactFilePath(refactorId, safePath));
        return {
          buffer,
          contentType: meta?.mime ?? "application/octet-stream",
          label: meta?.label ?? (safePath.split("/").pop() || safePath),
        };
      } catch {
        return null;
      }
    },
  };
}
