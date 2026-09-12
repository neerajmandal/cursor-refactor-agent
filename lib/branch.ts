import type { MigrationSnapshot } from "@/lib/types";

export function executionBranchName(snapshotId: string): string {
  const slug =
    snapshotId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "migration";
  return `cural/exec-${slug}`;
}

export function evaluationTargetRef(
  snapshot: Pick<MigrationSnapshot, "executionBranch">,
  fallback = "",
): string {
  return snapshot.executionBranch?.trim() || fallback;
}
