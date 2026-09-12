import { createFileArchiveStore } from "@/lib/archive/file-store";
import { createNeonArchiveStore } from "@/lib/archive/neon-store";
import type { ArchiveStore } from "@/lib/archive/types";

export function usesDatabaseArchive(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getArchiveStore(): ArchiveStore {
  if (usesDatabaseArchive()) return createNeonArchiveStore();
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. Vercel cannot write local .data archives — add the Neon connection string to the project environment variables.",
    );
  }
  return createFileArchiveStore();
}
