import { describe, expect, it } from "vitest";
import { executePrompt, subagentPrompt } from "@/lib/prompts";

const component = {
  id: "fault-service",
  label: "FaultService",
  kind: "service",
  spec: {
    purpose: "Resolve a HelioDrive fault code for an operator.",
    interface: "resolveFault(code) -> FaultResponse",
    owns: "src/faults/service.ts",
    dependsOn: "FaultRepository",
    portFrom: "legacy/FaultCodeService",
    outOfScope: "Device telemetry ingestion",
    doneWhen: "Known fault returns operator guidance\nUnknown fault returns not-found",
  },
};

const migration = {
  legacyRepo: "https://github.com/acme/legacy",
  targetRepo: "https://github.com/acme/target",
  prompt: "Preserve operator-visible behavior",
};

describe("execution prompts", () => {
  it("includes the frozen component spec in both parent and subagent prompts", () => {
    const parent = executePrompt({
      ...migration,
      components: [component],
    });
    const child = subagentPrompt(component, migration);

    for (const prompt of [parent, child]) {
      expect(prompt).toContain("resolveFault(code) -> FaultResponse");
      expect(prompt).toContain("Unknown fault returns not-found");
      expect(prompt).toContain("Device telemetry ingestion");
    }
  });
});
