import { createFileArchiveStore } from "@/lib/archive/file-store";
import { createNeonArchiveStore } from "@/lib/archive/neon-store";
import type { ArchiveStore } from "@/lib/archive/types";

export function usesDatabaseArchive(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getArchiveStore(): ArchiveStore {
  return usesDatabaseArchive() ? createNeonArchiveStore() : createFileArchiveStore();
}
