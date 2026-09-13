import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { createFileArchiveStore } from "@/lib/archive/file-store";
import { archiveFromBoard } from "@/lib/archive/types";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "cural-archive-"));
  process.env.CURAL_DATA_DIR = dir;
});

afterEach(async () => {
  delete process.env.CURAL_DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

test("file archive store lists, upserts, and serves artifacts", async () => {
  const store = createFileArchiveStore();
  const created = await store.upsert(
    archiveFromBoard("board-1", {
      envName: "support-chat",
      legacyRepo: "acme/legacy",
      targetRepo: "acme/next",
      prompt: "Prove parity",
      phase: "aligning",
    }),
  );

  expect(created.id).toBe("board-1");
  expect((await store.list()).map((item) => item.id)).toEqual(["board-1"]);

  const artifact = await store.putArtifact({
    refactorId: "board-1",
    sourcePath: "artifacts/walkthrough.mp4",
    label: "Walkthrough",
    mime: "video/mp4",
    body: Buffer.from("video-bytes"),
  });
  expect(artifact.kind).toBe("video");

  const loaded = await store.getArtifact("board-1", "artifacts/walkthrough.mp4");
  expect(loaded?.buffer.toString()).toBe("video-bytes");
  expect(loaded?.contentType).toBe("video/mp4");

  const archive = await store.get("board-1");
  expect(archive?.artifacts).toHaveLength(1);

  expect(await store.remove("board-1")).toBe(true);
  expect(await store.get("board-1")).toBeNull();
  expect(await store.list()).toEqual([]);
  expect(await store.remove("board-1")).toBe(false);
});

test("rejects unsafe artifact paths", async () => {
  const store = createFileArchiveStore();
  await store.upsert(archiveFromBoard("board-2", { prompt: "x" }));
  await expect(
    store.putArtifact({
      refactorId: "board-2",
      sourcePath: "../secret.mp4",
      label: "nope",
      mime: "video/mp4",
      body: Buffer.from("x"),
    }),
  ).rejects.toThrow("Invalid artifact path");
});
