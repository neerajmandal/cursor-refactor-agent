import { describe, expect, it } from "vitest";
import { executionPlan } from "@/lib/execution";
import {
  SAMPLE_UI_QUESTIONS,
  executePrompt,
  operatorNotes,
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
  it("includes every frozen component spec in the top-level master prompt", () => {
    const snapshot = {
      id: "snap-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      executionBranch: "cural/exec-snapshot-1",
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
    };
    const parent = executePrompt({
      ...migration,
      executionBranch: "cural/exec-snapshot-1",
      components: [component],
      snapshot,
    });

    expect(parent).toContain("resolveFault(code) -> FaultResponse");
    expect(parent).toContain("Unknown fault returns not-found");
    expect(parent).toContain("Device telemetry ingestion");
    expect(parent).toContain("cural/exec-snapshot-1");
    expect(parent).not.toContain("Operator notes for this run");
    expect(parent).toContain("Copy the legacy app UI");
    expect(parent).toContain("V2");
    expect(parent).toContain("Execute the frozen plan first");
    expect(parent).toContain("send the two sample questions through the legacy app");
    expect(parent).toContain("same two questions through the modern app");
    expect(parent).toContain("Neon database configured on the modern repo branch cural/exec-snapshot-1");
    expect(parent).toContain("Frozen target-architecture spec");
    expect(parent).toContain("master migration agent");
    expect(parent).toContain("Use subagents whenever possible");
    expect(parent).toContain("master agent coordinates all subagents");
    expect(parent).toContain("there are no separate component-specific custom agent prompts");
    expect(parent).toContain("computer use");
    expect(parent).toContain("Gate A — OpenAI");
    expect(parent).toContain("Gate B — Neon");
    expect(parent).toContain("Keep that loop going");
    expect(parent).toContain("OpenAI");
    expect(parent).toContain("Neon");
    expect(parent).toContain("CURAL_EVALUATION_REPORT");
    expect(parent).toContain("ask-a-question");
    for (const question of SAMPLE_UI_QUESTIONS) {
      expect(parent).toContain(question);
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

    expect(parent).toContain(notes);
    expect(parent).toContain("do not override frozen specs");
    expect(parent).toContain("resolveFault(code) -> FaultResponse");
  });

  it("gives the master the full component hierarchy and all component specs", () => {
    const controller = {
      id: "chat-controller",
      label: "ChatController",
      kind: "app",
      spec: {
        purpose: "HTTP entry for ask.",
        interface: "POST /ask",
        owns: "app/api/ask",
        dependsOn: "ChatService",
        portFrom: "legacy/ChatController",
        outOfScope: "Persistence",
        doneWhen: "Routes the question",
      },
    };
    const service = {
      id: "chat-service",
      label: "ChatService",
      kind: "service",
      spec: {
        purpose: "Answer the question.",
        interface: "ask(question)",
        owns: "chat/service.ts",
        dependsOn: "",
        portFrom: "legacy/ChatService",
        outOfScope: "HTTP",
        doneWhen: "Returns an answer",
      },
    };
    const toBe = {
      nodes: [controller, service],
      edges: [{ from: "chat-controller", to: "chat-service" }],
    };
    const plan = executionPlan(toBe);
    const parent = executePrompt({
      ...migration,
      executionBranch: "cural/exec-snapshot-1",
      components: [controller, service],
      plan,
      snapshot: {
        id: "snap-tree",
        createdAt: "2026-01-01T00:00:00.000Z",
        executionBranch: "cural/exec-snapshot-1",
        architectureVersion: 1,
        asIs: { nodes: [], edges: [] },
        toBe,
        journeys: [],
      },
    });

    expect(parent).toContain("Begin coordination with the root component(s): chat-controller");
    expect(parent).toContain("Direct child components: chat-service");
    expect(parent).toContain("POST /ask");
    expect(parent).toContain("ask(question)");
    expect(parent).toContain("master agent coordinates all subagents");
  });
});

describe("operator notes", () => {
  it("omits the section when the extra prompt is blank", () => {
    expect(operatorNotes("   ")).toBe("");
    expect(operatorNotes()).toBe("");
  });
});
