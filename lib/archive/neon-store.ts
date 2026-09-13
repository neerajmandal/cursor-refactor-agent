import { neon } from "@neondatabase/serverless";
import { del, get, put } from "@vercel/blob";
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

let schemaPromise: Promise<void> | null = null;

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

function getSql() {
  return neon(requireDatabaseUrl());
}

function blobPathname(refactorId: string, sourcePath: string): string {
  return `cural/${refactorId}/${sourcePath}`;
}

async function ensureSchema(): Promise<void> {
  const sql = getSql();
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS refactors (
          id TEXT PRIMARY KEY,
          env_name TEXT NOT NULL DEFAULT '',
          legacy_repo TEXT NOT NULL DEFAULT '',
          target_repo TEXT NOT NULL DEFAULT '',
          legacy_ref TEXT NOT NULL DEFAULT '',
          target_ref TEXT NOT NULL DEFAULT '',
          prompt TEXT NOT NULL DEFAULT '',
          legacy_base_url TEXT NOT NULL DEFAULT '',
          target_base_url TEXT NOT NULL DEFAULT '',
          fixture_command TEXT NOT NULL DEFAULT '',
          phase TEXT NOT NULL,
          architecture_version INTEGER NOT NULL DEFAULT 0,
          as_is JSONB NOT NULL DEFAULT '{}'::jsonb,
          to_be JSONB NOT NULL DEFAULT '{}'::jsonb,
          journeys JSONB NOT NULL DEFAULT '[]'::jsonb,
          execution_snapshot JSONB,
          analyze_agent_id TEXT NOT NULL DEFAULT '',
          analyze_run_id TEXT NOT NULL DEFAULT '',
          execute_agent_id TEXT NOT NULL DEFAULT '',
          execute_run_id TEXT NOT NULL DEFAULT '',
          evaluation_agent_id TEXT NOT NULL DEFAULT '',
          evaluation_run_id TEXT NOT NULL DEFAULT '',
          work_items JSONB NOT NULL DEFAULT '{}'::jsonb,
          execution_report JSONB,
          evaluation_report JSONB,
          evaluation_videos JSONB NOT NULL DEFAULT '[]'::jsonb,
          run_branches JSONB NOT NULL DEFAULT '[]'::jsonb,
          error TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS artifacts (
          id TEXT PRIMARY KEY,
          refactor_id TEXT NOT NULL REFERENCES refactors(id) ON DELETE CASCADE,
          kind TEXT NOT NULL,
          label TEXT NOT NULL,
          mime TEXT NOT NULL,
          size_bytes INTEGER NOT NULL DEFAULT 0,
          source_path TEXT NOT NULL,
          blob_pathname TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (refactor_id, source_path)
        )
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

function asJson<T>(value: unknown, fallback: T): T {
  return (value ?? fallback) as T;
}

function rowToArchive(
  row: Record<string, unknown>,
  artifacts: ArchiveArtifact[],
): RefactorArchive {
  return {
    id: String(row.id),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
    envName: String(row.env_name ?? ""),
    legacyRepo: String(row.legacy_repo ?? ""),
    targetRepo: String(row.target_repo ?? ""),
    legacyRef: String(row.legacy_ref ?? ""),
    targetRef: String(row.target_ref ?? ""),
    prompt: String(row.prompt ?? ""),
    legacyBaseUrl: String(row.legacy_base_url ?? ""),
    targetBaseUrl: String(row.target_base_url ?? ""),
    fixtureCommand: String(row.fixture_command ?? ""),
    phase: (row.phase as Phase) ?? "analyzing_current",
    asIs: asJson(row.as_is, EMPTY_GRAPH),
    toBe: asJson(row.to_be, EMPTY_GRAPH),
    journeys: asJson(row.journeys, []),
    architectureVersion: Number(row.architecture_version ?? 0),
    executionSnapshot: asJson(row.execution_snapshot, null),
    analyzeAgentId: String(row.analyze_agent_id ?? ""),
    analyzeRunId: String(row.analyze_run_id ?? ""),
    executeAgentId: String(row.execute_agent_id ?? ""),
    executeRunId: String(row.execute_run_id ?? ""),
    evaluationAgentId: String(row.evaluation_agent_id ?? ""),
    evaluationRunId: String(row.evaluation_run_id ?? ""),
    workItems: asJson(row.work_items, {}),
    executionReport: asJson(row.execution_report, null),
    evaluationReport: asJson(row.evaluation_report, null),
    evaluationVideos: asJson(row.evaluation_videos, []),
    runBranches: asJson(row.run_branches, []),
    error: String(row.error ?? ""),
    artifacts,
  };
}

function artifactFromRow(row: Record<string, unknown>): ArchiveArtifact {
  return {
    id: String(row.id),
    refactorId: String(row.refactor_id),
    kind: row.kind as ArchiveArtifact["kind"],
    label: String(row.label),
    mime: String(row.mime),
    sizeBytes: Number(row.size_bytes ?? 0),
    sourcePath: String(row.source_path),
    blobPathname: String(row.blob_pathname),
  };
}

async function loadArtifacts(
  sql: ReturnType<typeof getSql>,
  refactorId: string,
): Promise<ArchiveArtifact[]> {
  const rows = (await sql`
    SELECT id, refactor_id, kind, label, mime, size_bytes, source_path, blob_pathname
    FROM artifacts
    WHERE refactor_id = ${refactorId}
    ORDER BY source_path
  `) as Record<string, unknown>[];
  return rows.map(artifactFromRow);
}

export function createNeonArchiveStore(): ArchiveStore {
  const sql = neon(requireDatabaseUrl());

  return {
    async list() {
      await ensureSchema();
      const rows = (await sql`
        SELECT
          id, env_name, legacy_repo, target_repo, prompt, phase,
          created_at, updated_at, evaluation_report
        FROM refactors
        ORDER BY updated_at DESC
      `) as Record<string, unknown>[];
      return rows.map((row) => {
        const archive = rowToArchive(row, []);
        return summarizeArchive(archive);
      });
    },

    async get(id) {
      await ensureSchema();
      const rows = (await sql`SELECT * FROM refactors WHERE id = ${id} LIMIT 1`) as Record<
        string,
        unknown
      >[];
      const row = rows[0];
      if (!row) return null;
      return rowToArchive(row, await loadArtifacts(sql, id));
    },

    async remove(id) {
      await ensureSchema();
      const existing = await this.get(id);
      if (!existing) return false;
      const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
      const blobPaths = existing.artifacts
        .map((artifact) => artifact.blobPathname)
        .filter((pathname): pathname is string => Boolean(pathname));
      if (token && blobPaths.length) {
        try {
          await del(blobPaths, { token });
        } catch {
          // Archive rows still go away if blob cleanup fails.
        }
      }
      await sql`DELETE FROM refactors WHERE id = ${id}`;
      return true;
    },

    async upsert(input: ArchiveUpsert) {
      await ensureSchema();
      const now = new Date().toISOString();
      await sql`
        INSERT INTO refactors (
          id, env_name, legacy_repo, target_repo, legacy_ref, target_ref, prompt,
          legacy_base_url, target_base_url, fixture_command, phase, architecture_version,
          as_is, to_be, journeys, execution_snapshot, analyze_agent_id, analyze_run_id,
          execute_agent_id, execute_run_id, evaluation_agent_id, evaluation_run_id,
          work_items, execution_report, evaluation_report, evaluation_videos, run_branches,
          error, created_at, updated_at
        ) VALUES (
          ${input.id}, ${input.envName}, ${input.legacyRepo}, ${input.targetRepo},
          ${input.legacyRef}, ${input.targetRef}, ${input.prompt}, ${input.legacyBaseUrl},
          ${input.targetBaseUrl}, ${input.fixtureCommand}, ${input.phase},
          ${input.architectureVersion}, ${JSON.stringify(input.asIs)},
          ${JSON.stringify(input.toBe)}, ${JSON.stringify(input.journeys)},
          ${input.executionSnapshot ? JSON.stringify(input.executionSnapshot) : null},
          ${input.analyzeAgentId}, ${input.analyzeRunId}, ${input.executeAgentId},
          ${input.executeRunId}, ${input.evaluationAgentId}, ${input.evaluationRunId},
          ${JSON.stringify(input.workItems)},
          ${input.executionReport ? JSON.stringify(input.executionReport) : null},
          ${input.evaluationReport ? JSON.stringify(input.evaluationReport) : null},
          ${JSON.stringify(input.evaluationVideos)}, ${JSON.stringify(input.runBranches)},
          ${input.error}, ${input.createdAt ?? now}, ${now}
        )
        ON CONFLICT (id) DO UPDATE SET
          env_name = EXCLUDED.env_name,
          legacy_repo = EXCLUDED.legacy_repo,
          target_repo = EXCLUDED.target_repo,
          legacy_ref = EXCLUDED.legacy_ref,
          target_ref = EXCLUDED.target_ref,
          prompt = EXCLUDED.prompt,
          legacy_base_url = EXCLUDED.legacy_base_url,
          target_base_url = EXCLUDED.target_base_url,
          fixture_command = EXCLUDED.fixture_command,
          phase = EXCLUDED.phase,
          architecture_version = EXCLUDED.architecture_version,
          as_is = EXCLUDED.as_is,
          to_be = EXCLUDED.to_be,
          journeys = EXCLUDED.journeys,
          execution_snapshot = EXCLUDED.execution_snapshot,
          analyze_agent_id = EXCLUDED.analyze_agent_id,
          analyze_run_id = EXCLUDED.analyze_run_id,
          execute_agent_id = EXCLUDED.execute_agent_id,
          execute_run_id = EXCLUDED.execute_run_id,
          evaluation_agent_id = EXCLUDED.evaluation_agent_id,
          evaluation_run_id = EXCLUDED.evaluation_run_id,
          work_items = EXCLUDED.work_items,
          execution_report = EXCLUDED.execution_report,
          evaluation_report = EXCLUDED.evaluation_report,
          evaluation_videos = EXCLUDED.evaluation_videos,
          run_branches = EXCLUDED.run_branches,
          error = EXCLUDED.error,
          updated_at = EXCLUDED.updated_at
      `;
      const stored = await this.get(input.id);
      if (!stored) throw new Error("Failed to persist archive");
      return stored;
    },

    async putArtifact({ refactorId, sourcePath, label, mime, body }) {
      await ensureSchema();
      const existing = await this.get(refactorId);
      if (!existing) throw new Error("Archive not found");
      const safePath = sanitizeArtifactPath(sourcePath);
      const pathname = blobPathname(refactorId, safePath);
      if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
        throw new Error("BLOB_READ_WRITE_TOKEN is not set");
      }
      await put(pathname, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: mime,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const previous = existing.artifacts.find((item) => item.sourcePath === safePath);
      const artifact: ArchiveArtifact = {
        id: previous?.id ?? nanoid(),
        refactorId,
        kind: artifactKindFor(safePath, mime),
        label,
        mime,
        sizeBytes: body.byteLength,
        sourcePath: safePath,
        blobPathname: pathname,
      };
      await sql`
        INSERT INTO artifacts (
          id, refactor_id, kind, label, mime, size_bytes, source_path, blob_pathname
        ) VALUES (
          ${artifact.id}, ${refactorId}, ${artifact.kind}, ${label}, ${mime},
          ${artifact.sizeBytes}, ${safePath}, ${pathname}
        )
        ON CONFLICT (refactor_id, source_path) DO UPDATE SET
          kind = EXCLUDED.kind,
          label = EXCLUDED.label,
          mime = EXCLUDED.mime,
          size_bytes = EXCLUDED.size_bytes,
          blob_pathname = EXCLUDED.blob_pathname
      `;
      await sql`UPDATE refactors SET updated_at = NOW() WHERE id = ${refactorId}`;
      return artifact;
    },

    async getArtifact(refactorId, sourcePath) {
      await ensureSchema();
      const safePath = sanitizeArtifactPath(sourcePath);
      const rows = (await sql`
        SELECT id, refactor_id, kind, label, mime, size_bytes, source_path, blob_pathname
        FROM artifacts
        WHERE refactor_id = ${refactorId} AND source_path = ${safePath}
        LIMIT 1
      `) as Record<string, unknown>[];
      const row = rows[0];
      if (!row) return null;
      const meta = artifactFromRow(row);
      const pathname = meta.blobPathname;
      if (!pathname) return null;
      const result = await get(pathname, {
        access: "private",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
      return {
        buffer,
        contentType: meta.mime || result.blob.contentType || "application/octet-stream",
        label: meta.label,
      };
    },
  };
}
