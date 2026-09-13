import { describe, expect, it } from "vitest";
import {
  SAMPLE_UI_QUESTIONS,
  evaluationPrompt,
  executePrompt,
  operatorNotes,
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
      executionBranch: "cural/exec-snapshot-1",
      components: [component],
    });
    const child = subagentPrompt(component, {
      ...migration,
      executionBranch: "cural/exec-snapshot-1",
    });

    for (const prompt of [parent, child]) {
      expect(prompt).toContain("resolveFault(code) -> FaultResponse");
      expect(prompt).toContain("Unknown fault returns not-found");
      expect(prompt).toContain("Device telemetry ingestion");
      expect(prompt).toContain("cural/exec-snapshot-1");
      expect(prompt).toContain("Copy the legacy app UI");
      expect(prompt).toContain("V2");
      expect(prompt).not.toContain("Operator notes for this run");
    }
  });

  it("appends operator notes without replacing the frozen contract", () => {
    const notes = "Skip the payments adapter; use the in-memory stub.";
    const parent = executePrompt({
      ...migration,
      executionBranch: "cural/exec-snapshot-1",
      components: [component],
      extraPrompt: notes,
    });
    const child = subagentPrompt(component, {
      ...migration,
      executionBranch: "cural/exec-snapshot-1",
      extraPrompt: notes,
    });

    for (const prompt of [parent, child]) {
      expect(prompt).toContain(notes);
      expect(prompt).toContain("do not override frozen specs");
      expect(prompt).toContain("resolveFault(code) -> FaultResponse");
    }
  });
});

describe("evaluation prompts", () => {
  it("asks the agent to run both apps in the UI with two sample questions", () => {
    const prompt = evaluationPrompt({
      ...migration,
      legacyBaseUrl: "http://legacy.local",
      targetBaseUrl: "http://target.local",
      fixtureCommand: "npm run seed",
      snapshot: {
        id: "snap-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        executionBranch: "cural/exec-snap-1",
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

    expect(prompt).toContain("Do UI testing");
    expect(prompt).toContain("Start both apps");
    expect(prompt).toMatch(/Do not use Playwright/i);
    for (const question of SAMPLE_UI_QUESTIONS) {
      expect(prompt).toContain(question);
    }
    expect(prompt).toContain("legacy app");
    expect(prompt).toContain("modern (V2) app");
    expect(prompt).toContain("V2");
    expect(prompt).toContain("cural/exec-snap-1");
    expect(prompt).toContain("ask-a-question");
    expect(prompt).not.toContain("tests/parity");
    expect(prompt).not.toContain("Operator notes for this run");
  });

  it("appends operator notes after the frozen journey contract", () => {
    const prompt = evaluationPrompt({
      ...migration,
      legacyBaseUrl: "http://legacy.local",
      targetBaseUrl: "http://target.local",
      fixtureCommand: "npm run seed",
      extraPrompt: "Legacy is on :3001 today.",
      snapshot: {
        id: "snap-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        executionBranch: "cural/exec-snap-1",
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

    expect(prompt).toContain("Legacy is on :3001 today.");
    expect(prompt).toContain("do not override frozen specs");
    expect(prompt).toContain("ask-a-question");
  });
});

describe("operator notes", () => {
  it("omits the section when the extra prompt is blank", () => {
    expect(operatorNotes("   ")).toBe("");
    expect(operatorNotes()).toBe("");
  });
});
