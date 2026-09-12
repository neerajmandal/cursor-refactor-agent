import { describe, expect, it } from "vitest";
import {
  evaluationPrompt,
  executePrompt,
  subagentPrompt,
} from "@/lib/prompts";

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

describe("evaluation prompts", () => {
  it("requires Cursor VM computer use instead of Playwright", () => {
    const prompt = evaluationPrompt({
      ...migration,
      legacyBaseUrl: "http://legacy.local",
      targetBaseUrl: "http://target.local",
      fixtureCommand: "npm run seed",
      snapshot: {
        id: "snap-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        architectureVersion: 1,
        asIs: { nodes: [], edges: [] },
        toBe: { nodes: [], edges: [] },
        journeys: [{
          id: "ask-a-question",
          title: "Ask a question",
          actor: "Customer",
          preconditions: [],
          steps: ["Ask"],
          outcomes: ["Answer"],
          fixtures: [],
          normalizationRules: [],
          componentIds: [],
          sourceEvidence: [],
          required: true,
        }],
      },
    });

    expect(prompt).toContain("Cursor cloud VM");
    expect(prompt).toContain("computer use");
    expect(prompt).toMatch(/Do not use Playwright/i);
    expect(prompt).toContain("videos");
    expect(prompt).not.toContain("tests/parity");
  });
});
