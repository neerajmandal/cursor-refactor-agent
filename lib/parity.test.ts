import { describe, expect, it } from "vitest";
import { compareObservables, normalizeObservable } from "@/lib/parity";

describe("parity normalization", () => {
  it("removes only approved volatile fields", () => {
    const value = normalizeObservable(
      {
        id: "generated-123",
        answer: "Created at 2026-09-10T12:00:00Z",
        stable: true,
      },
      ["omit:id", "\\d{4}-\\d{2}-\\d{2}T[^ ]+ => <timestamp>"],
    );
    expect(value).toEqual({
      answer: "Created at <timestamp>",
      stable: true,
    });
  });

  it("reports semantic mismatches after normalization", () => {
    const result = compareObservables(
      { answer: "Approved", requestId: "legacy-1" },
      { answer: "Rejected", requestId: "target-9" },
      ["omit:requestId"],
    );
    expect(result.equal).toBe(false);
    expect(result.difference).toContain("Approved");
    expect(result.difference).toContain("Rejected");
  });
});
