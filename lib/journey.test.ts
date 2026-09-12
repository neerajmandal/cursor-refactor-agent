import { describe, expect, it } from "vitest";
import {
  createMigrationSnapshot,
  extractAnalysis,
  reconcileJourneyComponents,
  validateAlignment,
  workItemsFromSnapshot,
} from "@/lib/journey";

const analysis = {
  caption: "A user submits a question and receives an answer.",
  nodes: [
    {
      id: "chat",
      label: "ChatService",
      spec: {
        purpose: "Answers user questions.",
        interface: "ask(question)",
        owns: "chat/service.ts",
        dependsOn: "",
        portFrom: "legacy/chat.ts",
        outOfScope: "Authentication",
        doneWhen: "Returns an answer",
      },
    },
  ],
  edges: [],
  journeys: [
    {
      id: "ask-question",
      title: "Ask a question",
      actor: "Customer",
      steps: ["Enter a question", "Submit"],
      outcomes: ["An answer is shown"],
      componentIds: ["chat"],
      sourceEvidence: ["legacy/chat.ts:ask"],
      required: true,
    },
  ],
};

describe("migration alignment artifacts", () => {
  it("extracts a graph and structured legacy journey", () => {
    const result = extractAnalysis(`\`\`\`json\n${JSON.stringify(analysis)}\n\`\`\``);
    expect(result.graph.nodes[0].id).toBe("chat");
    expect(result.journeys[0]).toMatchObject({
      id: "ask-question",
      actor: "Customer",
      outcomes: ["An answer is shown"],
      required: true,
    });
  });

  it("validates, freezes, and creates traceable work items", () => {
    const { graph, journeys } = extractAnalysis(JSON.stringify(analysis));
    expect(validateAlignment(graph, journeys)).toEqual([]);

    const snapshot = createMigrationSnapshot({
      asIs: graph,
      toBe: graph,
      journeys,
      architectureVersion: 2,
    });
    const workItems = workItemsFromSnapshot(snapshot);

    expect(snapshot.architectureVersion).toBe(2);
    expect(snapshot.executionBranch).toBe(`cural/exec-${snapshot.id}`);
    expect(workItems.chat).toMatchObject({
      componentId: "chat",
      status: "pending",
      attempts: 1,
    });
  });

  it("rejects plans without executable acceptance information", () => {
    const { graph } = extractAnalysis(JSON.stringify(analysis));
    expect(validateAlignment(graph, [])).toContain(
      "At least one required end-user journey is needed",
    );
  });

  it("remaps legacy journey coverage through target portFrom evidence", () => {
    const legacy = {
      caption: "",
      nodes: [{ id: "legacy-saga", label: "ChatRequestSaga" }],
      edges: [],
    };
    const target = {
      caption: "",
      nodes: [{
        id: "chat-service",
        label: "ChatService",
        spec: {
          purpose: "Orchestrates chat.",
          interface: "ask(question)",
          owns: "chat/service.ts",
          dependsOn: "",
          portFrom: "ChatRequestSaga",
          outOfScope: "HTTP",
          doneWhen: "Returns an answer",
        },
      }],
      edges: [],
    };
    const journeys = [{
      ...extractAnalysis(JSON.stringify(analysis)).journeys[0],
      componentIds: ["legacy-saga"],
    }];

    expect(reconcileJourneyComponents(legacy, target, journeys)[0].componentIds)
      .toEqual(["chat-service"]);
  });
});
