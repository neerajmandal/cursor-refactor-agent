import { describe, expect, it } from "vitest";
import { evaluationTargetRef, executionBranchName } from "@/lib/branch";

describe("execution branch naming", () => {
  it("builds a stable git-safe branch from the snapshot id", () => {
    expect(executionBranchName("snapshot-2-abc123")).toBe(
      "cural/exec-snapshot-2-abc123",
    );
  });

  it("prefers the orchestrator branch for user testing checkout", () => {
    expect(
      evaluationTargetRef(
        { executionBranch: "cural/exec-snapshot-1" },
        "main",
      ),
    ).toBe("cural/exec-snapshot-1");
    expect(evaluationTargetRef({ executionBranch: "" }, "main")).toBe("main");
  });
});
