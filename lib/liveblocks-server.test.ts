import { beforeEach, describe, expect, it, vi } from "vitest";

const liveblocks = vi.hoisted(() => ({
  createRoom: vi.fn(),
  initializeStorageDocument: vi.fn(),
}));

vi.mock("@liveblocks/node", () => ({
  Liveblocks: class {
    createRoom = liveblocks.createRoom;
    initializeStorageDocument = liveblocks.initializeStorageDocument;
  },
}));

import { createBoardRoom } from "@/lib/liveblocks-server";

const setup = {
  envName: "",
  legacyRepo: "https://github.com/acme/legacy",
  targetRepo: "https://github.com/acme/target",
  legacyRef: "legacy-sha",
  targetRef: "target-sha",
  prompt: "Preserve behavior",
  legacyBaseUrl: "https://legacy.example.com",
  targetBaseUrl: "https://target.example.com",
  fixtureCommand: "npm run seed",
};

describe("durable board initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIVEBLOCKS_SECRET_KEY = "sk_test";
    liveblocks.createRoom.mockResolvedValue({});
    liveblocks.initializeStorageDocument.mockResolvedValue({});
  });

  it("uses idempotent room creation and persists the complete setup", async () => {
    const storage = await createBoardRoom("board-1", setup);

    expect(liveblocks.createRoom).toHaveBeenCalledWith(
      "board-1",
      expect.objectContaining({ defaultAccesses: [] }),
      { idempotent: true },
    );
    expect(liveblocks.initializeStorageDocument).toHaveBeenCalledWith(
      "board-1",
      expect.objectContaining({
        liveblocksType: "LiveObject",
        data: expect.objectContaining({
          legacyRef: "legacy-sha",
          targetRef: "target-sha",
          phase: "research",
          phaseStatuses: {
            research: "running",
            plan: "pending",
            implement: "pending",
          },
        }),
      }),
    );
    expect(storage.legacyRepo).toBe(setup.legacyRepo);
  });

  it("treats an already-initialized room as a successful retry", async () => {
    liveblocks.initializeStorageDocument.mockRejectedValueOnce(
      new Error("Storage already initialized"),
    );
    await expect(createBoardRoom("board-1", setup)).resolves.toMatchObject(setup);
  });
});
